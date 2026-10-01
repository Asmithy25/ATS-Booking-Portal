import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, announcementsTable, bookingsTable, clientNotificationsTable, clientAccountsTable } from "@workspace/db";
import { extractClientSession , extractStaffSession, getStaffAccess, requireClientAuth, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/v1/health", (_req, res) => {
  res.json({ ok: true, apiVersion: "v1", service: "aydens-wellness" });
});

router.get("/v1/me", async (req, res) => {
  const client = extractClientSession(req);
  if (client) {
    const [account] = await db.select({
      id: clientAccountsTable.id, email: clientAccountsTable.email, name: clientAccountsTable.name,
      phone: clientAccountsTable.phone, updatesOptIn: clientAccountsTable.updatesOptIn,
    }).from(clientAccountsTable).where(eq(clientAccountsTable.id, Number(client.id))).limit(1);
    if (!account) return res.status(401).json({ error: "Client account not found." });
    return res.json({ type: "client", authenticated: true, account });
  }
  const staff = await getStaffAccess(req);
  if (staff) return res.json({ type: "staff", authenticated: true, staff });
  return res.status(401).json({ error: "Authentication required." });
});

router.get("/v1/appointments", async (req, res) => {
  const client = extractClientSession(req);
  if (client) {
    const [account] = await db.select({ phone: clientAccountsTable.phone }).from(clientAccountsTable)
      .where(eq(clientAccountsTable.id, Number(client.id))).limit(1);
    if (!account) return res.status(401).json({ error: "Client account not found." });
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.phone, account.phone))
      .orderBy(desc(bookingsTable.preferredDate), desc(bookingsTable.preferredTime));
    return res.json({ type: "client", appointments: bookings });
  }
  const staff = await getStaffAccess(req);
  if (!staff) return res.status(401).json({ error: "Authentication required." });
  if (!["founder", "manager", "therapist", "customer_service_representative"].includes(staff.role)) return res.status(403).json({ error: "Staff access required." });
  const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.preferredDate), desc(bookingsTable.preferredTime)).limit(200);
  return res.json({ type: "staff", appointments: bookings });
});

router.get("/v1/notifications", requireClientAuth, async (req, res) => {
  const client = extractClientSession(req)!;
  const notifications = await db.select().from(clientNotificationsTable)
    .where(eq(clientNotificationsTable.clientAccountId, Number(client.id)))
    .orderBy(desc(clientNotificationsTable.createdAt)).limit(100);
  res.json({ notifications });
});

router.get("/v1/announcements", async (_req, res) => {
  const now = Date.now();
  const rows = await db.select().from(announcementsTable).where(eq(announcementsTable.active, true)).orderBy(desc(announcementsTable.createdAt));
  res.json({ announcements: rows.filter((item) => {
    const meta = item.metadata ?? {};
    return (!meta.status || meta.status === "published") &&
      (!meta.startsAt || new Date(meta.startsAt).getTime() <= now) &&
      (!meta.endsAt || new Date(meta.endsAt).getTime() >= now);
  }) });
});

export default router;
