import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, announcementsTable, bookingsTable, clientNotificationsTable, clientAccountsTable, settingsTable } from "@workspace/db";
import { extractClientSession, getStaffAccess, requireClientAuth } from "../middleware/auth";

const router = Router();

router.get("/v1/health", (_req, res) => {
  res.json({ ok: true, apiVersion: "v1", service: "aydens-wellness" });
});

router.get("/v1/config", async (_req, res) => {
  const [settings] = await db.select({
    siteName: settingsTable.siteName,
    siteTagline: settingsTable.siteTagline,
    logoUrl: settingsTable.logoUrl,
    acceptingClients: settingsTable.acceptingClients,
    sessionRequestsOpen: settingsTable.sessionRequestsOpen,
    vacationMode: settingsTable.vacationMode,
  }).from(settingsTable).limit(1);
  res.json({
    apiVersion: "v1",
    appName: settings?.siteName ?? "Aydens Wellness Services",
    tagline: settings?.siteTagline ?? "Reset. Rebuild. Thrive.",
    logoUrl: settings?.logoUrl ?? "",
    acceptingClients: settings?.acceptingClients ?? true,
    sessionRequestsOpen: settings?.sessionRequestsOpen ?? true,
    vacationMode: settings?.vacationMode ?? false,
  });
});

router.get("/v1/status", async (_req, res) => {
  const [settings] = await db.select({
    acceptingClients: settingsTable.acceptingClients,
    sessionRequestsOpen: settingsTable.sessionRequestsOpen,
    vacationMode: settingsTable.vacationMode,
  }).from(settingsTable).limit(1);
  const open = Boolean(settings?.acceptingClients !== false && settings?.sessionRequestsOpen !== false && settings?.vacationMode !== true);
  res.json({
    status: open ? "open" : "paused",
    label: open ? "Accepting new requests" : "Request window paused",
    phoneOnly: true,
  });
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
  const rows = await db.select().from(announcementsTable)
    .where(and(eq(announcementsTable.active, true), eq(announcementsTable.audience, "client")))
    .orderBy(desc(announcementsTable.createdAt));
  res.json({ announcements: rows.filter((item) => {
    const meta = item.metadata ?? {};
    return (!meta.status || meta.status === "published") &&
      (!meta.startsAt || new Date(meta.startsAt).getTime() <= now) &&
      (!meta.endsAt || new Date(meta.endsAt).getTime() >= now);
  }) });
});

export default router;
