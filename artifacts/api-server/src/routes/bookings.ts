import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  auditLogsTable,
  bookingsTable,
  sessionFeedbackTable,
  wellnessAssignmentsTable,
} from "@workspace/db";
import { requirePermission, signPayload, verifyPayload } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { validateBookingSlot } from "../lib/scheduling";
import { generateConfirmationCode } from "../lib/booking-utils";
import { findClientAccountByPhone } from "../lib/client-data-repair";

const router = Router();

const normalizeCode = (value: unknown) => String(value ?? "").toUpperCase().trim();
const normalizePhone = (value: string) => value.replace(/\D/g, "");

type BusinessHoursChallenge = {
  kind: "booking_business_hours";
  action: "create" | "update";
  staffEmail: string;
  bookingId?: string;
  preferredDate: string;
  preferredTime: string;
  expiresAt: number;
};

function issueBusinessHoursChallenge(challenge: Omit<BusinessHoursChallenge, "kind" | "expiresAt">) {
  return signPayload({ ...challenge, kind: "booking_business_hours", expiresAt: Date.now() + 5 * 60 * 1000 });
}

function acceptsBusinessHoursChallenge(token: string | undefined, expected: Omit<BusinessHoursChallenge, "kind" | "expiresAt">) {
  if (!token) return false;
  const payload = verifyPayload(token);
  return Boolean(
    payload?.kind === "booking_business_hours" &&
      payload.action === expected.action &&
      payload.staffEmail === expected.staffEmail &&
      payload.preferredDate === expected.preferredDate &&
      payload.preferredTime === expected.preferredTime &&
      (expected.bookingId === undefined || payload.bookingId === expected.bookingId) &&
      Number(payload.expiresAt) > Date.now(),
  );
}

function businessHoursConfirmation(slot: { error: string }, challenge: Omit<BusinessHoursChallenge, "kind" | "expiresAt">) {
  return {
    error: slot.error,
    code: "BUSINESS_HOURS_CONFIRMATION_REQUIRED",
    requiresConfirmation: true,
    confirmationToken: issueBusinessHoursChallenge(challenge),
  };
}

function serializeBooking(booking: typeof bookingsTable.$inferSelect, feedback: any = null) {
  return {
    ...booking,
    claimedBy: booking.claimedBy ?? null,
    sessionNotes: booking.sessionNotes ?? null,
    createdAt: booking.createdAt.toISOString(),
    feedback,
  };
}

async function getFeedback(bookingId: number) {
  const [feedback] = await db.select().from(sessionFeedbackTable).where(eq(sessionFeedbackTable.bookingId, bookingId)).limit(1);
  return feedback
    ? { id: feedback.id, rating: feedback.rating, comment: feedback.comment ?? null, createdAt: feedback.createdAt.toISOString() }
    : null;
}

async function createConfirmationCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateConfirmationCode();
    const [existing] = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.confirmationCode, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error("Unable to generate a unique confirmation code.");
}

async function resolveClientAccountId(phone: string) {
  return (await findClientAccountByPhone(phone))?.id ?? null;
}

router.get("/", requirePermission("viewClients"), async (req, res) => {
  try {
    const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
    const feedbacks = await db.select().from(sessionFeedbackTable);
    const feedbackMap = new Map(feedbacks.map((f) => [f.bookingId, { id: f.id, rating: f.rating, comment: f.comment ?? null, createdAt: f.createdAt.toISOString() }]));
    const enriched = bookings.map((booking, index) => {
      const previous = bookings.slice(index + 1).filter((item) => normalizePhone(item.phone) === normalizePhone(booking.phone)).length;
      return { ...serializeBooking(booking, feedbackMap.get(booking.id) ?? null), isReturningClient: previous > 0, previousSessionCount: previous };
    });
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/", async (req, res) => {
  const { clientName, phone, reason, preferredDate, preferredTime } = req.body as Record<string, string>;
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
    const confirmationCode = await createConfirmationCode();
    const clientAccountId = await resolveClientAccountId(phone);
    const [created] = await db.insert(bookingsTable).values({ confirmationCode, clientAccountId, clientName, phone, reason, preferredDate, preferredTime, status: "pending" }).returning();
    const prior = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.phone, phone));
    res.status(201).json({ ...serializeBooking(created), isReturningClient: prior.length > 1, previousSessionCount: Math.max(0, prior.length - 1) });
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/stats", requirePermission("viewAnalytics"), async (req, res) => {
  try {
    const all = await db.select().from(bookingsTable);
    const counts = Object.fromEntries(["pending", "claimed", "completed", "cancelled", "no_show"].map((status) => [status, all.filter((b) => b.status === status).length]));
    const phoneCounts = new Map<string, number>();
    for (const booking of all) phoneCounts.set(normalizePhone(booking.phone), (phoneCounts.get(normalizePhone(booking.phone)) ?? 0) + 1);
    res.json({ total: all.length, ...counts, returningClients: [...phoneCounts.values()].filter((count) => count > 1).length });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking stats");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/confirm/:code", async (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!code) return res.status(400).json({ error: "Confirmation code is required." });
  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.confirmationCode, code)).limit(1);
    if (!booking) return res.status(404).json({ error: "No booking found with that confirmation code." });
    res.json({ ...serializeBooking(booking, await getFeedback(booking.id)) });
  } catch (err) {
    req.log.error({ err }, "Failed to look up booking by code");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.patch("/confirm/:code", async (req, res) => {
  const code = normalizeCode(req.params.code);
  const { preferredDate, preferredTime, status } = req.body as { preferredDate?: string; preferredTime?: string; status?: string };
  if (!code) return res.status(400).json({ error: "Confirmation code is required." });
  if (status && status !== "cancelled") return res.status(400).json({ error: "Clients may only cancel a booking." });
  try {
    const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.confirmationCode, code)).limit(1);
    if (!current) return res.status(404).json({ error: "No booking found with that confirmation code." });
    if (["completed", "cancelled"].includes(current.status)) return res.status(400).json({ error: `This booking is already ${current.status} and cannot be changed.` });
    if (preferredDate || preferredTime) {
      const slot = await validateBookingSlot(preferredDate ?? current.preferredDate, preferredTime ?? current.preferredTime, { excludeBookingId: current.id });
      if (!slot.ok) return res.status(409).json({ error: slot.error });
    }
    const updates: Partial<typeof bookingsTable.$inferInsert> = {};
    if (preferredDate) updates.preferredDate = preferredDate;
    if (preferredTime) updates.preferredTime = preferredTime;
    if (status) updates.status = status;
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields to update." });
    const [updated] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, current.id)).returning();
    await recordAudit(req, status === "cancelled" ? "cancelled_booking" : "rescheduled_booking", "booking", String(updated.id));
    res.json(serializeBooking(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update booking by code");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/confirm/:code/feedback", async (req, res) => {
  const code = normalizeCode(req.params.code);
  try {
    const [booking] = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.confirmationCode, code)).limit(1);
    if (!booking) return res.status(404).json({ error: "No booking found with that confirmation code." });
    res.json({ feedback: await getFeedback(booking.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking feedback");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/confirm/:code/feedback", async (req, res) => {
  const code = normalizeCode(req.params.code);
  const { rating, comment } = req.body as { rating?: unknown; comment?: unknown };
  if (!Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5) return res.status(400).json({ error: "Rating must be a whole number between 1 and 5." });
  if (comment !== undefined && comment !== null && typeof comment !== "string") return res.status(400).json({ error: "Comment must be a text string." });
  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.confirmationCode, code)).limit(1);
    if (!booking) return res.status(404).json({ error: "No booking found with that confirmation code." });
    if (booking.status !== "completed") return res.status(400).json({ error: "Feedback can only be submitted for completed sessions." });
    const existing = await getFeedback(booking.id);
    if (existing) return res.status(409).json({ error: "Feedback has already been submitted for this session." });
    const [created] = await db.insert(sessionFeedbackTable).values({ bookingId: booking.id, confirmationCode: booking.confirmationCode, clientAccountId: booking.clientAccountId ?? null, clientName: booking.clientName, rating: Number(rating), comment: typeof comment === "string" && comment.trim() ? comment.trim().slice(0, 2000) : null }).returning();
    await db.insert(auditLogsTable).values({ actorEmail: "public-client", actorName: booking.clientName, action: "submitted_session_feedback", entityType: "session_feedback", entityId: String(created.id), details: `Rating: ${rating}/5 for booking ${booking.confirmationCode}` });
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to submit feedback");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/confirm/:code/wellness-assignments", async (req, res) => {
  const code = normalizeCode(req.params.code);
  try {
    const [booking] = await db.select({ id: bookingsTable.id, clientAccountId: bookingsTable.clientAccountId }).from(bookingsTable).where(eq(bookingsTable.confirmationCode, code)).limit(1);
    if (!booking) return res.status(404).json({ error: "No booking found with that confirmation code." });
    if (!booking.clientAccountId) return res.json([]);
    const assignments = await db.select().from(wellnessAssignmentsTable).where(eq(wellnessAssignmentsTable.clientAccountId, booking.clientAccountId)).orderBy(desc(wellnessAssignmentsTable.createdAt));
    res.json(assignments.filter((item) => item.bookingId === null || item.bookingId === booking.id));
  } catch (err) {
    req.log.error({ err }, "Failed to get wellness assignments");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/staff", requirePermission("editAppointments"), async (req, res) => {
  const { clientName, phone, reason, preferredDate, preferredTime, status = "claimed", priority = 1, sessionNotes, businessHoursConfirmationToken } = req.body as Record<string, any>;
  if (!clientName || !phone || !reason || !preferredDate || !preferredTime) return res.status(400).json({ error: "clientName, phone, reason, preferredDate and preferredTime are required." });
  const allowed = ["pending", "claimed", "completed", "waitlisted"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) return res.status(400).json({ error: "priority must be a whole number from 0 to 3." });
  try {
    const staffSession = (req as any).staffSession;
    const bypass = status !== "waitlisted" && acceptsBusinessHoursChallenge(businessHoursConfirmationToken, { action: "create", staffEmail: staffSession?.email ?? "", preferredDate, preferredTime });
    const slot = await validateBookingSlot(preferredDate, preferredTime, status === "waitlisted" ? { skipAvailability: true, allowPastDate: true } : { bypassBusinessHours: bypass, allowPastDate: true });
    if (!slot.ok) {
      if (slot.code === "BUSINESS_HOURS" && staffSession) return res.status(409).json(businessHoursConfirmation(slot, { action: "create", staffEmail: staffSession.email, preferredDate, preferredTime }));
      return res.status(409).json({ error: slot.error });
    }
    const [created] = await db.insert(bookingsTable).values({ confirmationCode: await createConfirmationCode(), clientAccountId: await resolveClientAccountId(phone), clientName, phone, reason, preferredDate, preferredTime, status, priority: status === "waitlisted" ? priority : 1, claimedBy: status === "claimed" ? staffSession?.name ?? null : null, sessionNotes: sessionNotes ?? null }).returning();
    res.status(201).json(serializeBooking(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create staff booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/:id", requirePermission("viewClients"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id." });
  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    const all = await db.select().from(bookingsTable).where(eq(bookingsTable.phone, booking.phone));
    const previous = all.filter((item) => item.createdAt < booking.createdAt).length;
    res.json({ ...serializeBooking(booking, await getFeedback(id)), isReturningClient: previous > 0, previousSessionCount: previous });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.patch("/:id", requirePermission("editAppointments"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id." });
  const { status, priority, claimedBy, sessionNotes, preferredDate, preferredTime, businessHoursConfirmationToken } = req.body as Record<string, any>;
  const allowed = ["pending", "claimed", "completed", "cancelled", "no_show", "waitlisted"];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 3)) return res.status(400).json({ error: "priority must be a whole number from 0 to 3." });
  try {
    const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!current) return res.status(404).json({ error: "Booking not found." });
    const requestedDate = preferredDate ?? current.preferredDate;
    const requestedTime = preferredTime ?? current.preferredTime;
    const staffSession = (req as any).staffSession;
    const bypass = acceptsBusinessHoursChallenge(businessHoursConfirmationToken, { action: "update", staffEmail: staffSession?.email ?? "", bookingId: String(id), preferredDate: requestedDate, preferredTime: requestedTime });
    if (preferredDate || preferredTime) {
      const slot = await validateBookingSlot(requestedDate, requestedTime, { excludeBookingId: id, skipAvailability: status === "waitlisted", bypassBusinessHours: bypass, allowPastDate: true });
      if (!slot.ok) {
        if (slot.code === "BUSINESS_HOURS" && staffSession) return res.status(409).json(businessHoursConfirmation(slot, { action: "update", staffEmail: staffSession.email, bookingId: String(id), preferredDate: requestedDate, preferredTime: requestedTime }));
        return res.status(409).json({ error: slot.error });
      }
    }
    const updates: Partial<typeof bookingsTable.$inferInsert> = {};
    if (status) updates.status = status;
    if (priority !== undefined) updates.priority = status === "waitlisted" || current.status === "waitlisted" ? priority : 1;
    if (claimedBy !== undefined) updates.claimedBy = claimedBy;
    if (sessionNotes !== undefined) updates.sessionNotes = sessionNotes;
    if (preferredDate) updates.preferredDate = preferredDate;
    if (preferredTime) updates.preferredTime = preferredTime;
    const [updated] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
    await recordAudit(req, status ? `booking_status_${status}` : preferredDate || preferredTime ? "rescheduled_booking" : "updated_booking", "booking", String(id));
    res.json({ ...serializeBooking(updated, await getFeedback(id)) });
  } catch (err) {
    req.log.error({ err }, "Failed to update booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.delete("/:id", requirePermission("editAppointments"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id." });
  try {
    const [deleted] = await db.delete(bookingsTable).where(eq(bookingsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Booking not found." });
    await recordAudit(req, "deleted_booking", "booking", String(id));
    res.json({ message: "Booking deleted." });
  } catch (err) {
    req.log.error({ err }, "Failed to delete booking");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
