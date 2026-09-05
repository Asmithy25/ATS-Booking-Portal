import { Router } from "express";
import { db, bookingsTable, clientAccountsTable, sessionFeedbackTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "../middleware/auth";
import { repairClientData } from "../lib/client-data-repair";

const router = Router();

const normalizePhone = (value: string) => value.replace(/\D/g, "");

// GET /clients/search?q=... - search by name, phone, confirmation code/number, or client account
router.get("/search", requirePermission("viewClients"), async (req, res) => {
  const query = String(req.query.q ?? "").trim().toLowerCase();
  if (query.length < 2) {
    res.status(400).json({ error: "Enter at least 2 characters to search." });
    return;
  }

  try {
    const all = await db.select().from(bookingsTable).orderBy(asc(bookingsTable.createdAt));
    const accounts = await db.select().from(clientAccountsTable);
    const allFeedback = await db.select().from(sessionFeedbackTable);
    const feedbackMap = new Map(
      allFeedback.map((f) => [
        f.bookingId,
        { id: f.id, rating: f.rating, comment: f.comment ?? null, createdAt: f.createdAt.toISOString() },
      ]),
    );

    const normalizedQueryPhone = normalizePhone(query);
    const matchingAccounts = accounts.filter((account) =>
      account.name.toLowerCase().includes(query) ||
      account.email.toLowerCase().includes(query) ||
      account.phone.toLowerCase().includes(query) ||
      (normalizedQueryPhone.length >= 2 && normalizePhone(account.phone).includes(normalizedQueryPhone)),
    );

    // Repair legacy/imported orphan bookings before building the client list.
    for (const account of matchingAccounts) {
      await repairClientData(account.id, account.phone);
    }

    const matches = all.filter((booking) =>
      booking.clientName.toLowerCase().includes(query) ||
      booking.phone.toLowerCase().includes(query) ||
      (normalizedQueryPhone.length >= 2 && normalizePhone(booking.phone).includes(normalizedQueryPhone)) ||
      booking.confirmationCode.toLowerCase().includes(query),
    );

    const phones = new Set<string>(matches.map((booking) => normalizePhone(booking.phone)));
    for (const account of matchingAccounts) phones.add(normalizePhone(account.phone));

    const byPhone = new Map<string, typeof all>();
    for (const phone of phones) {
      const bookings = all.filter((booking) => normalizePhone(booking.phone) === phone);
      byPhone.set(phone, bookings);
    }

    const clients = [...byPhone.entries()]
      .map(([normalizedPhone, bookings]) => {
        const accountByPhone = accounts.find((account) => normalizePhone(account.phone) === normalizedPhone);
        const latestBooking = bookings[bookings.length - 1];
        const linkedAccountId = bookings.find((booking) => booking.clientAccountId !== null)?.clientAccountId ?? null;
        const clientAccountId = linkedAccountId ?? accountByPhone?.id ?? null;

        return {
          clientAccountId,
          phone: latestBooking?.phone ?? accountByPhone?.phone ?? normalizedPhone,
          clientName: latestBooking?.clientName ?? accountByPhone?.name ?? "",
          sessionCount: bookings.length,
          bookings: bookings.map((b, idx) => ({
            ...b,
            claimedBy: b.claimedBy ?? null,
            sessionNotes: b.sessionNotes ?? null,
            feedback: feedbackMap.get(b.id) ?? null,
            isReturningClient: idx > 0,
            previousSessionCount: idx,
            createdAt: b.createdAt.toISOString(),
          })),
        };
      })
      .filter((client) => client.clientAccountId !== null);

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

    const clientName = all[all.length - 1].clientName;
    const allFeedback = await db.select().from(sessionFeedbackTable);
    const feedbackMap = new Map(
      allFeedback.map((f) => [
        f.bookingId,
        { id: f.id, rating: f.rating, comment: f.comment ?? null, createdAt: f.createdAt.toISOString() },
      ]),
    );

    const enriched = all.map((b, idx) => ({
      ...b,
      claimedBy: b.claimedBy ?? null,
      sessionNotes: b.sessionNotes ?? null,
      feedback: feedbackMap.get(b.id) ?? null,
      isReturningClient: idx > 0,
      previousSessionCount: idx,
      createdAt: b.createdAt.toISOString(),
    }));

    res.json({ phone, clientName, sessionCount: all.length, bookings: enriched });
  } catch (err) {
    req.log.error({ err }, "Failed to get client history");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
