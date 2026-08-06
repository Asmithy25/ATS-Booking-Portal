import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { validateBookingSlot } from "../lib/scheduling";
import { generateConfirmationCode } from "../lib/booking-utils";

const router = Router();

function serializeBooking(b: typeof bookingsTable.$inferSelect & { isReturningClient?: boolean; previousSessionCount?: number }) {
  return {
    ...b,
    claimedBy: b.claimedBy ?? null,
    sessionNotes: b.sessionNotes ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

// GET /bookings - list all (staff only)
router.get("/", requirePermission("viewClients"), async (req, res) => {
  try {
    const all = await db
      .select()
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.createdAt));

    const enriched = all.map((b, idx) => {
      const priorCount = all
        .slice(idx + 1)
        .filter((x) => x.phone === b.phone).length;
      return {
        ...serializeBooking(b),
        isReturningClient: priorCount > 0,
        previousSessionCount: priorCount,
      };
    });

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /bookings - create (public)
router.post("/", async (req, res) => {
  const { clientName, phone, reason, preferredDate, preferredTime } =
    req.body as {
      clientName: string;
      phone: string;
      reason: string;
      preferredDate: string;
      preferredTime: string;
    };

  if (!clientName || !phone || !reason || !preferredDate || !preferredTime) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  try {
    const slot = await validateBookingSlot(preferredDate, preferredTime);
    if (!slot.ok) {
      res.status(409).json({ error: slot.error });
      return;
    }

    // Generate a unique confirmation code
    let confirmationCode = generateConfirmationCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(eq(bookingsTable.confirmationCode, confirmationCode));
      if (existing.length === 0) break;
      confirmationCode = generateConfirmationCode();
      attempts++;
    }

    const [created] = await db
      .insert(bookingsTable)
      .values({
        confirmationCode,
        clientName,
        phone,
        reason,
        preferredDate,
        preferredTime,
        status: "pending",
      })
      .returning();

    const prior = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.phone, phone));
    const priorCount = prior.length - 1;

    res.status(201).json({
      ...serializeBooking(created),
      isReturningClient: priorCount > 0,
      previousSessionCount: priorCount > 0 ? priorCount : 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /bookings/stats - stats (staff only) — MUST be before /:id
router.get("/stats", requirePermission("viewAnalytics"), async (req, res) => {
  try {
    const all = await db.select().from(bookingsTable);
    const total = all.length;
    const pending = all.filter((b) => b.status === "pending").length;
    const claimed = all.filter((b) => b.status === "claimed").length;
    const completed = all.filter((b) => b.status === "completed").length;
    const cancelled = all.filter((b) => b.status === "cancelled").length;
    const noShow = all.filter((b) => b.status === "no_show").length;

    const phoneCounts: Record<string, number> = {};
    for (const b of all) {
      phoneCounts[b.phone] = (phoneCounts[b.phone] ?? 0) + 1;
    }
    const returningClients = Object.values(phoneCounts).filter(
      (c) => c > 1,
    ).length;

    res.json({ total, pending, claimed, completed, cancelled, noShow, returningClients });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /bookings/confirm/:code - public lookup by confirmation code
router.get("/confirm/:code", async (req, res) => {
  const code = (req.params.code ?? "").toUpperCase().trim();
  if (!code) {
    res.status(400).json({ error: "Confirmation code is required." });
    return;
  }
  try {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.confirmationCode, code));
    if (!booking) {
      res.status(404).json({ error: "No booking found with that confirmation code." });
      return;
    }
    // Return limited fields to the public (no sessionNotes, no claimedBy details)
    res.json({
      id: booking.id,
      confirmationCode: booking.confirmationCode,
      clientName: booking.clientName,
      phone: booking.phone,
      reason: booking.reason,
      preferredDate: booking.preferredDate,
      preferredTime: booking.preferredTime,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to look up booking by code");
    res.status(500).json({ error: "Internal server error." });
  }
});

// PATCH /bookings/confirm/:code - public update (reschedule / cancel) — no auth, just code
router.patch("/confirm/:code", async (req, res) => {
  const code = (req.params.code ?? "").toUpperCase().trim();
  if (!code) {
    res.status(400).json({ error: "Confirmation code is required." });
    return;
  }

  const { preferredDate, preferredTime, status } = req.body as {
    preferredDate?: string;
    preferredTime?: string;
    status?: string;
  };

  // Only allow reschedule (date/time) or cancel
  const allowedStatuses = ["cancelled"];
  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ error: "Clients may only cancel a booking." });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.confirmationCode, code));

    if (!existing) {
      res.status(404).json({ error: "No booking found with that confirmation code." });
      return;
    }

    if (existing.status === "completed" || existing.status === "cancelled") {
      res.status(400).json({ error: `This booking is already ${existing.status} and cannot be changed.` });
      return;
    }

    if (preferredDate || preferredTime) {
      const slot = await validateBookingSlot(
        preferredDate ?? existing.preferredDate,
        preferredTime ?? existing.preferredTime,
        { excludeBookingId: existing.id },
      );
      if (!slot.ok) {
        res.status(409).json({ error: slot.error });
        return;
      }
    }

    const updates: Partial<typeof bookingsTable.$inferInsert> = {};
    if (preferredDate) updates.preferredDate = preferredDate;
    if (preferredTime) updates.preferredTime = preferredTime;
    if (status === "cancelled") updates.status = "cancelled";

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update." });
      return;
    }

    const [updated] = await db
      .update(bookingsTable)
      .set(updates)
      .where(eq(bookingsTable.confirmationCode, code))
      .returning();

    res.json({
      id: updated.id,
      confirmationCode: updated.confirmationCode,
      clientName: updated.clientName,
      phone: updated.phone,
      reason: updated.reason,
      preferredDate: updated.preferredDate,
      preferredTime: updated.preferredTime,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update booking by code");
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /bookings/staff - staff-initiated booking (auth required)
router.post("/staff", requirePermission("editAppointments"), async (req, res) => {
  const {
    clientName,
    phone,
    reason,
    preferredDate,
    preferredTime,
    status = "claimed",
    priority = 1,
    sessionNotes,
  } = req.body as {
    clientName: string;
    phone: string;
    reason: string;
    preferredDate: string;
    preferredTime: string;
    status?: string;
    priority?: number;
    sessionNotes?: string;
  };

  if (!clientName || !phone || !reason || !preferredDate || !preferredTime) {
    res.status(400).json({ error: "clientName, phone, reason, preferredDate and preferredTime are required." });
    return;
  }

  const allowedStatuses = ["pending", "claimed", "completed", "waitlisted"];
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: "status must be pending, claimed, completed, or waitlisted." });
    return;
  }
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) {
    res.status(400).json({ error: "priority must be a whole number from 0 to 3." });
    return;
  }
  if (status !== "waitlisted" && priority !== 1) {
    res.status(400).json({ error: "Only waitlisted bookings may have a custom priority." });
    return;
  }

  try {
    const slot = await validateBookingSlot(
      preferredDate,
      preferredTime,
      status === "waitlisted" ? { skipAvailability: true } : undefined,
    );
    if (!slot.ok) {
      res.status(409).json({ error: slot.error });
      return;
    }

    // Generate unique confirmation code
    let confirmationCode = generateConfirmationCode();
    for (let i = 0; i < 5; i++) {
      const existing = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(eq(bookingsTable.confirmationCode, confirmationCode));
      if (existing.length === 0) break;
      confirmationCode = generateConfirmationCode();
    }

    const session = (req as import("express").Request & { staffSession?: { email: string; name: string } }).staffSession;
    const claimedBy = status === "claimed" ? (session?.name ?? null) : null;

    const [created] = await db
      .insert(bookingsTable)
      .values({
        confirmationCode,
        clientName,
        phone,
        reason,
        preferredDate,
        preferredTime,
        status,
        priority: status === "waitlisted" ? priority : 1,
        claimedBy,
        sessionNotes: sessionNotes ?? null,
      })
      .returning();

    const prior = await db.select().from(bookingsTable).where(eq(bookingsTable.phone, phone));
    const priorCount = prior.length - 1;

    res.status(201).json({
      ...serializeBooking(created),
      isReturningClient: priorCount > 0,
      previousSessionCount: priorCount > 0 ? priorCount : 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create staff booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /bookings/:id - single booking (staff only)
router.get("/:id", requirePermission("viewClients"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  try {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id));
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    const allForPhone = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.phone, booking.phone));
    const priorCount = allForPhone.filter(
      (b) => b.createdAt < booking.createdAt,
    ).length;

    res.json({
      ...serializeBooking(booking),
      isReturningClient: priorCount > 0,
      previousSessionCount: priorCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

// PATCH /bookings/:id - update (staff only)
router.patch("/:id", requirePermission("editAppointments"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const { status, priority, claimedBy, sessionNotes, preferredDate, preferredTime } =
    req.body as {
      status?: string;
      priority?: number;
      claimedBy?: string;
      sessionNotes?: string;
      preferredDate?: string;
      preferredTime?: string;
    };

  const allowedStatuses = ["pending", "claimed", "completed", "cancelled", "no_show", "waitlisted"];
  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status." });
    return;
  }
  if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 3)) {
    res.status(400).json({ error: "priority must be a whole number from 0 to 3." });
    return;
  }

  try {
    const [current] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id));
    if (!current) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    if (current.status === "waitlisted" && status && status !== "waitlisted" && (!preferredDate || !preferredTime)) {
      res.status(400).json({ error: "Choose a valid date and time when promoting a waitlisted request." });
      return;
    }

    if (preferredDate || preferredTime) {
      const slot = await validateBookingSlot(
        preferredDate ?? current.preferredDate,
        preferredTime ?? current.preferredTime,
        {
          excludeBookingId: id,
          skipAvailability: status === "waitlisted" || current.status === "waitlisted",
        },
      );
      if (!slot.ok) {
        res.status(409).json({ error: slot.error });
        return;
      }
    }

    const updates: Partial<typeof bookingsTable.$inferInsert> = {};
    if (status) updates.status = status;
    if (priority !== undefined) updates.priority = status === "waitlisted" || current.status === "waitlisted" ? priority : 1;
    if (claimedBy !== undefined) updates.claimedBy = claimedBy;
    if (sessionNotes !== undefined) updates.sessionNotes = sessionNotes;
    if (preferredDate) updates.preferredDate = preferredDate;
    if (preferredTime) updates.preferredTime = preferredTime;

    const [updated] = await db
      .update(bookingsTable)
      .set(updates)
      .where(eq(bookingsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    await recordAudit(
      req,
      status ? `booking_status_${status}` : preferredDate || preferredTime ? "rescheduled_booking" : "updated_booking",
      "booking",
      String(updated.id),
      sessionNotes !== undefined ? "Updated session notes" : undefined,
    );

    const allForPhone = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.phone, updated.phone));
    const priorCount = allForPhone.filter(
      (b) => b.createdAt < updated.createdAt,
    ).length;

    res.json({
      ...serializeBooking(updated),
      isReturningClient: priorCount > 0,
      previousSessionCount: priorCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

// DELETE /bookings/:id - delete (staff only)
router.delete("/:id", requirePermission("editAppointments"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  try {
    const [deleted] = await db
      .delete(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    await recordAudit(req, "deleted_booking", "booking", String(deleted.id));
    res.json({ message: "Booking deleted." });
  } catch (err) {
    req.log.error({ err }, "Failed to delete booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
