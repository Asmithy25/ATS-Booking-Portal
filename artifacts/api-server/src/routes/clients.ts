import { Router } from "express";
import { db, bookingsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "../middleware/auth";

const router = Router();

// GET /clients/search?q=... - search by name, phone, or confirmation code
router.get("/search", requirePermission("viewClients"), async (req, res) => {
  const query = String(req.query.q ?? "").trim().toLowerCase();
  if (query.length < 2) {
    res.status(400).json({ error: "Enter at least 2 characters to search." });
    return;
  }

  try {
    const all = await db.select().from(bookingsTable).orderBy(asc(bookingsTable.createdAt));
    const matches = all.filter((booking) =>
      booking.clientName.toLowerCase().includes(query) ||
      booking.phone.toLowerCase().includes(query) ||
      booking.confirmationCode.toLowerCase() === query.toUpperCase(),
    );

    const byPhone = new Map<string, typeof all>();
    for (const booking of matches) {
      const existing = byPhone.get(booking.phone) ?? [];
      existing.push(...all.filter((candidate) => candidate.phone === booking.phone && !existing.some((item) => item.id === candidate.id)));
      byPhone.set(booking.phone, existing);
    }

    const clients = [...byPhone.entries()].map(([phone, bookings]) => ({
      phone,
      clientName: bookings[bookings.length - 1]?.clientName ?? "",
      sessionCount: bookings.length,
      bookings: bookings.map((b, idx) => ({
        ...b,
        claimedBy: b.claimedBy ?? null,
        sessionNotes: b.sessionNotes ?? null,
        isReturningClient: idx > 0,
        previousSessionCount: idx,
        createdAt: b.createdAt.toISOString(),
      })),
    }));

    res.json({ clients });
  } catch (err) {
    req.log.error({ err }, "Failed to search clients");
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /clients/:phone - client history (staff only)
router.get("/:phone", requirePermission("viewClients"), async (req, res) => {
  const phone = String(req.params.phone);

  try {
    const all = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.phone, phone))
      .orderBy(asc(bookingsTable.createdAt));

    if (all.length === 0) {
      res.status(404).json({ error: "No bookings found for this phone number." });
      return;
    }

    const clientName = all[all.length - 1].clientName; // most recent name

    const enriched = all.map((b, idx) => ({
      ...b,
      claimedBy: b.claimedBy ?? null,
      sessionNotes: b.sessionNotes ?? null,
      isReturningClient: idx > 0,
      previousSessionCount: idx,
      createdAt: b.createdAt.toISOString(),
    }));

    res.json({
      phone,
      clientName,
      sessionCount: all.length,
      bookings: enriched,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get client history");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
