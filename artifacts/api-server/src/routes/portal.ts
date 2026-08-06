import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  announcementsTable,
  auditLogsTable,
  bookingsTable,
  clientAccountsTable,
  messageTemplatesTable,
  collaborationItemsTable,
  supportMessagesTable,
  supportThreadsTable,
  wellnessResourcesTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { getStaffAccess, hasPermission, requireAuth, requireClientAuth, type RequestWithClientSession } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();

router.get("/staff/access", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  res.json({ ...access, isAdmin: access.role === "founder" });
});

router.get("/analytics", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "viewAnalytics")) {
    res.status(403).json({ error: "Analytics access required." });
    return;
  }
  const all = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
  const uniqueClients = new Set(all.map((b) => b.phone)).size;
  const returning = [...new Set(all.map((b) => b.phone))].filter((phone) => all.filter((b) => b.phone === phone).length > 1).length;
  const status = (name: string) => all.filter((b) => b.status === name).length;
  const byMonth = new Map<string, number>();
  const byDay = new Map<string, number>();
  const byHour = new Map<string, number>();
  for (const booking of all) {
    byMonth.set(booking.preferredDate.slice(0, 7), (byMonth.get(booking.preferredDate.slice(0, 7)) ?? 0) + 1);
    const date = new Date(`${booking.preferredDate}T12:00:00`);
    const day = date.toLocaleDateString("en-US", { weekday: "long" });
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const hour = booking.preferredTime.slice(0, 2);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  res.json({
    totalAppointments: all.length,
    clientCount: uniqueClients,
    returningPercentage: uniqueClients ? Math.round((returning / uniqueClients) * 100) : 0,
    completionRate: all.length ? Math.round((status("completed") / all.length) * 100) : 0,
    cancellationRate: all.length ? Math.round((status("cancelled") / all.length) * 100) : 0,
    noShowRate: all.length ? Math.round((status("no_show") / all.length) * 100) : 0,
    weeklyAverage: Math.round((all.length / Math.max(1, Math.ceil((Date.now() - (all.at(-1)?.createdAt.getTime() ?? Date.now())) / 604800000))) * 10) / 10,
    popularDay: [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
    peakHour: [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ? `${[...byHour.entries()].sort((a, b) => b[1] - a[1])[0][0]}:00` : "—",
    monthly: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
  });
});

router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "viewAuditLogs")) {
    res.status(403).json({ error: "Activity history access required." });
    return;
  }
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(80);
  res.json(logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })));
});

router.get("/announcements", async (req, res) => {
  const audience = req.query.audience === "staff" ? "staff" : "client";
  if (audience === "staff") {
    const access = await getStaffAccess(req);
    if (!access) {
      res.status(401).json({ error: "Staff authentication required." });
      return;
    }
  }
  const announcements = await db.select().from(announcementsTable).where(and(eq(announcementsTable.audience, audience), eq(announcementsTable.active, true))).orderBy(desc(announcementsTable.createdAt));
  res.json(announcements.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })));
});

router.post("/announcements", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "postAnnouncements")) {
    res.status(403).json({ error: "Manager access required." });
    return;
  }
  const { title, body, audience = "staff" } = req.body as { title?: string; body?: string; audience?: string };
  if (!title?.trim() || !body?.trim() || !["staff", "client"].includes(audience)) {
    res.status(400).json({ error: "Title, body, and a valid audience are required." });
    return;
  }
  const [created] = await db.insert(announcementsTable).values({ title: title.trim(), body: body.trim(), audience, publishedBy: access.name }).returning();
  await recordAudit(req, "posted_announcement", "announcement", String(created.id), audience);
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/resources", async (_req, res) => {
  let resources = await db.select().from(wellnessResourcesTable).where(eq(wellnessResourcesTable.published, true)).orderBy(desc(wellnessResourcesTable.createdAt));
  if (!resources.length) {
    await db.insert(wellnessResourcesTable).values([
      { category: "Coping strategies", title: "A grounding reset", description: "A simple five-senses exercise for overwhelming moments.", content: "Name five things you can see, four you can feel, three you can hear, two you can smell, and one you can taste. Let the exercise bring you back to the present.", isEmergency: false },
      { category: "Self-care", title: "A small care plan", description: "Choose one gentle action for your body, mind, and connection today.", content: "Try a glass of water, ten minutes away from your screen, and a message to someone safe. Small steps count.", isEmergency: false },
      { category: "Emergency resources", title: "Immediate support", description: "If you may hurt yourself or someone else, seek immediate help.", content: "Call or text 988 in the United States and Canada, call 911 for immediate danger, or go to the nearest emergency department.", isEmergency: true },
    ]);
    resources = await db.select().from(wellnessResourcesTable).where(eq(wellnessResourcesTable.published, true)).orderBy(desc(wellnessResourcesTable.createdAt));
  }
  res.json(resources);
});

router.get("/templates", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails")) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  res.json(await db.select().from(messageTemplatesTable).orderBy(messageTemplatesTable.key));
});

router.get("/collaboration", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) {
    res.status(401).json({ error: "Staff authentication required." });
    return;
  }
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const items = await db
    .select()
    .from(collaborationItemsTable)
    .where(kind ? eq(collaborationItemsTable.kind, kind) : undefined)
    .orderBy(desc(collaborationItemsTable.updatedAt), desc(collaborationItemsTable.createdAt))
    .limit(200);
  res.json(items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  })));
});

router.post("/collaboration", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) {
    res.status(401).json({ error: "Staff authentication required." });
    return;
  }

  const input = req.body as {
    kind?: string;
    title?: string;
    body?: string;
    assignedTo?: string;
    status?: string;
    dueDate?: string;
  };
  const allowedKinds = ["chat", "inbox", "task", "shift_note"];
  const allowedStatuses = ["open", "in_progress", "done"];
  const kind = input.kind ?? "chat";
  const body = input.body?.trim() ?? "";
  if (!allowedKinds.includes(kind) || !body) {
    res.status(400).json({ error: "A valid collaboration type and message are required." });
    return;
  }
  const status = input.status && allowedStatuses.includes(input.status) ? input.status : "open";
  const [created] = await db.insert(collaborationItemsTable).values({
    kind,
    title: input.title?.trim().slice(0, 160) ?? "",
    body: body.slice(0, 5000),
    authorName: access.name,
    assignedTo: input.assignedTo?.trim().slice(0, 120) || null,
    status,
    dueDate: input.dueDate?.trim().slice(0, 10) || null,
  }).returning();
  await recordAudit(req, `created_${kind}`, "collaboration_item", String(created.id));
  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.patch("/collaboration/:id", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) {
    res.status(401).json({ error: "Staff authentication required." });
    return;
  }
  const id = Number(req.params.id);
  const input = req.body as { status?: string; assignedTo?: string; body?: string; title?: string };
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid collaboration item." });
    return;
  }
  const updates: Partial<typeof collaborationItemsTable.$inferInsert> = { updatedAt: new Date() };
  if (input.status && ["open", "in_progress", "done"].includes(input.status)) updates.status = input.status;
  if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo.trim().slice(0, 120) || null;
  if (input.body !== undefined && input.body.trim()) updates.body = input.body.trim().slice(0, 5000);
  if (input.title !== undefined) updates.title = input.title.trim().slice(0, 160);
  const [updated] = await db.update(collaborationItemsTable).set(updates).where(eq(collaborationItemsTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Collaboration item not found." });
    return;
  }
  await recordAudit(req, "updated_collaboration_item", "collaboration_item", String(id));
  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.patch("/templates/:key", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails")) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  const { subject, body, label } = req.body as { subject?: string; body?: string; label?: string };
  const [updated] = await db.update(messageTemplatesTable).set({
    subject: subject?.trim() ?? "",
    body: body?.trim() ?? "",
    ...(label ? { label: label.trim() } : {}),
    updatedBy: access.name,
    updatedAt: new Date(),
  }).where(eq(messageTemplatesTable.key, String(req.params.key))).returning();
  if (!updated) {
    res.status(404).json({ error: "Message template not found." });
    return;
  }
  await recordAudit(req, "updated_message_template", "message_template", String(updated.id));
  res.json(updated);
});

router.get("/support", requireClientAuth, async (req, res) => {
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const threads = await db.select().from(supportThreadsTable).where(eq(supportThreadsTable.clientAccountId, clientId)).orderBy(desc(supportThreadsTable.updatedAt));
  const result = [];
  for (const thread of threads) {
    const messages = await db.select().from(supportMessagesTable).where(eq(supportMessagesTable.threadId, thread.id)).orderBy(supportMessagesTable.createdAt);
    result.push({ ...thread, messages });
  }
  res.json(result);
});

router.get("/support/staff", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "viewClients")) {
    res.status(403).json({ error: "Client support access required." });
    return;
  }
  const threads = await db.select().from(supportThreadsTable).orderBy(desc(supportThreadsTable.updatedAt));
  const result = [];
  for (const thread of threads) {
    const messages = await db.select().from(supportMessagesTable).where(eq(supportMessagesTable.threadId, thread.id)).orderBy(supportMessagesTable.createdAt);
    result.push({ ...thread, messages });
  }
  res.json(result);
});

router.post("/support/:id/reply", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "viewClients")) {
    res.status(403).json({ error: "Client support access required." });
    return;
  }
  const threadId = Number(req.params.id);
  const body = String((req.body as { body?: string }).body ?? "").trim();
  if (!Number.isInteger(threadId) || !body) {
    res.status(400).json({ error: "A message is required." });
    return;
  }
  const [thread] = await db.select().from(supportThreadsTable).where(eq(supportThreadsTable.id, threadId)).limit(1);
  if (!thread) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  await db.insert(supportMessagesTable).values({ threadId, senderType: "staff", senderName: access.name, body });
  const [updated] = await db.update(supportThreadsTable).set({ status: "open", updatedAt: new Date() }).where(eq(supportThreadsTable.id, threadId)).returning();
  await recordAudit(req, "replied_to_support_thread", "support_thread", String(threadId));
  res.status(201).json(updated);
});

router.post("/support", requireClientAuth, async (req, res): Promise<void> => {
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const client = await db.select({ name: clientAccountsTable.name }).from(clientAccountsTable).where(eq(clientAccountsTable.id, clientId)).limit(1);
  const { subject, body } = req.body as { subject?: string; body?: string };
  if (!client[0] || !subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Subject and message are required." });
    return;
  }
  const [thread] = await db.insert(supportThreadsTable).values({ clientAccountId: clientId, subject: subject.trim() }).returning();
  await db.insert(supportMessagesTable).values({ threadId: thread.id, senderType: "client", senderName: client[0].name, body: body.trim() });
  res.status(201).json(thread);
});

router.get("/client/bookings", requireClientAuth, async (req, res): Promise<void> => {
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const [client] = await db.select({ phone: clientAccountsTable.phone }).from(clientAccountsTable).where(eq(clientAccountsTable.id, clientId)).limit(1);
  if (!client) {
    res.status(401).json({ error: "Account not found." });
    return;
  }
  const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.phone, client.phone)).orderBy(desc(bookingsTable.preferredDate), desc(bookingsTable.preferredTime));
  res.json(bookings.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })));
});

router.patch("/client/profile", requireClientAuth, async (req, res): Promise<void> => {
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const { name, phone } = req.body as { name?: string; phone?: string };
  if (!name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: "Name and phone are required." });
    return;
  }
  const [updated] = await db.update(clientAccountsTable).set({ name: name.trim().slice(0, 120), phone: phone.trim().slice(0, 40), updatedAt: new Date() }).where(eq(clientAccountsTable.id, clientId)).returning({ id: clientAccountsTable.id, email: clientAccountsTable.email, name: clientAccountsTable.name, phone: clientAccountsTable.phone });
  res.json(updated);
});

export default router;