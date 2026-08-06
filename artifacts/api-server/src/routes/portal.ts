import { Router } from "express";
import { randomUUID } from "node:crypto";
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
  settingsTable,
  clientTemplatesTable,
  clientNotificationsTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { getStaffAccess, hasPermission, requireAuth, requireClientAuth, type RequestWithClientSession } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { generateConfirmationCode } from "../lib/booking-utils";
import { validateBookingSlot } from "../lib/scheduling";

const router = Router();

const DEFAULT_MESSAGE_TEMPLATES = [
  { key: "booking_confirmation", label: "Booking confirmation", icon: "calendar-check", subject: "Your session request is received", body: "Hi {{clientName}},\n\nWe received your session request for {{date}} at {{time}}. We’ll follow up shortly with confirmation.\n\nAyden’s Therapy Services" },
  { key: "appointment_reminder", label: "Appointment reminder", icon: "bell", subject: "Reminder: your session is {{date}} at {{time}}", body: "Hi {{clientName}},\n\nThis is a gentle reminder that your phone session is scheduled for {{date}} at {{time}}.\n\nPlease keep your confirmation details nearby, and reach out if you need support." },
  { key: "starting_soon", label: "Starting soon", icon: "clock-3", subject: "Your session is starting soon", body: "Hi {{clientName}},\n\nYour session is starting soon at {{time}}. Find a quiet, comfortable place and keep your phone close.\n\nYou’ve got this." },
  { key: "cancellation", label: "Cancellation", icon: "calendar-x", subject: "Update about your session request", body: "Hi {{clientName}},\n\nWe’re sorry, but we need to update your session request for {{date}} at {{time}}. Please reply here so we can help find another time." },
  { key: "business_update", label: "Business update", icon: "megaphone", subject: "An update from Ayden’s Therapy Services", body: "Hi {{clientName}},\n\nWe wanted to share an update from Ayden’s Therapy Services.\n\nPlease reply if you have any questions." },
];

const MESSAGE_TEMPLATE_ICONS = new Set([
  "mail", "bell", "calendar", "calendar-check", "calendar-x", "clock-3",
  "heart-handshake", "heart", "sparkles", "megaphone", "message-circle",
  "phone", "shield-check", "star", "party-popper", "file-text",
]);

const DEFAULT_CLIENT_TEMPLATES = [
  { key: "grounding_checkin", label: "Grounding check-in", icon: "heart", body: "Pause for a moment. Name five things you can see, four you can feel, three you can hear, two you can smell, and one you can taste." },
  { key: "session_preparation", label: "Session preparation", icon: "calendar", body: "Before your session, consider what feels most important to bring into the conversation. You do not need to have the perfect words." },
  { key: "care_followup", label: "Care follow-up", icon: "sparkles", body: "Small steps count. Consider one gentle action for your body, one for your mind, and one point of connection today." },
];

async function ensureMessageTemplates() {
  const existing = await db.select().from(messageTemplatesTable);
  const existingKeys = new Set(existing.map((template) => template.key));
  const missing = DEFAULT_MESSAGE_TEMPLATES.filter((template) => !existingKeys.has(template.key));
  if (missing.length) {
    await db.insert(messageTemplatesTable).values(missing.map((template) => ({ ...template, updatedBy: "Ayden" })));
  }
  return db.select().from(messageTemplatesTable).orderBy(messageTemplatesTable.key);
}

async function ensureClientTemplates() {
  const existing = await db.select().from(clientTemplatesTable);
  const existingKeys = new Set(existing.map((template) => template.key));
  const missing = DEFAULT_CLIENT_TEMPLATES.filter((template) => !existingKeys.has(template.key));
  if (missing.length) {
    await db.insert(clientTemplatesTable).values(missing.map((template) => ({ ...template, updatedBy: "Ayden" })));
  }
  return db.select().from(clientTemplatesTable).orderBy(clientTemplatesTable.key);
}

async function featureEnabled(key: string) {
  const [settings] = await db
    .select({ featureFlags: settingsTable.featureFlags })
    .from(settingsTable)
    .limit(1);
  return (settings?.featureFlags as Record<string, boolean> | undefined)?.[key] !== false;
}

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
  res.json(await ensureMessageTemplates());
});

router.post("/templates", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  const { label, icon = "mail", subject, body } = req.body as {
    label?: string;
    icon?: string;
    subject?: string;
    body?: string;
  };
  if (!label?.trim() || !subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Template name, subject, and message are required." });
    return;
  }
  if (!MESSAGE_TEMPLATE_ICONS.has(icon)) {
    res.status(400).json({ error: "Choose an icon from the available set." });
    return;
  }
  const template = {
    key: `custom_${randomUUID()}`,
    label: label.trim().slice(0, 120),
    icon,
    subject: subject.trim().slice(0, 240),
    body: body.trim().slice(0, 5000),
    updatedBy: access.name,
  };
  const [created] = await db.insert(messageTemplatesTable).values(template).returning();
  await recordAudit(req, "created_message_template", "message_template", String(created.id));
  res.status(201).json(created);
});

router.get("/client-templates", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  if (!await featureEnabled("clientTemplates")) {
    res.status(403).json({ error: "Client Templates are currently disabled." });
    return;
  }
  res.json(await ensureClientTemplates());
});

router.post("/client-templates", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  if (!await featureEnabled("clientTemplates")) {
    res.status(403).json({ error: "Client Templates are currently disabled." });
    return;
  }
  const { label, icon = "file-text", body } = req.body as {
    label?: string;
    icon?: string;
    body?: string;
  };
  if (!label?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Template name and text are required." });
    return;
  }
  if (!MESSAGE_TEMPLATE_ICONS.has(icon)) {
    res.status(400).json({ error: "Choose an icon from the available set." });
    return;
  }
  const [created] = await db.insert(clientTemplatesTable).values({
    key: `custom_${randomUUID()}`,
    label: label.trim().slice(0, 120),
    icon,
    body: body.trim().slice(0, 5000),
    updatedBy: access.name,
  }).returning();
  await recordAudit(req, "created_client_template", "client_template", String(created.id));
  res.status(201).json(created);
});

router.patch("/client-templates/:key", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  if (!await featureEnabled("clientTemplates")) {
    res.status(403).json({ error: "Client Templates are currently disabled." });
    return;
  }
  const { body, label, icon } = req.body as { body?: string; label?: string; icon?: string };
  if (!body?.trim()) {
    res.status(400).json({ error: "Template text is required." });
    return;
  }
  if (icon !== undefined && !MESSAGE_TEMPLATE_ICONS.has(icon)) {
    res.status(400).json({ error: "Choose an icon from the available set." });
    return;
  }
  const [updated] = await db.update(clientTemplatesTable).set({
    body: body.trim().slice(0, 5000),
    ...(label?.trim() ? { label: label.trim().slice(0, 120) } : {}),
    ...(icon ? { icon } : {}),
    updatedBy: access.name,
    updatedAt: new Date(),
  }).where(eq(clientTemplatesTable.key, String(req.params.key))).returning();
  if (!updated) {
    res.status(404).json({ error: "Client template not found." });
    return;
  }
  await recordAudit(req, "updated_client_template", "client_template", String(updated.id));
  res.json(updated);
});

router.delete("/client-templates/:key", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  if (!await featureEnabled("clientTemplates")) {
    res.status(403).json({ error: "Client Templates are currently disabled." });
    return;
  }
  const key = String(req.params.key);
  if (!key.startsWith("custom_")) {
    res.status(400).json({ error: "Default Client Templates cannot be deleted." });
    return;
  }
  const [deleted] = await db.delete(clientTemplatesTable)
    .where(eq(clientTemplatesTable.key, key))
    .returning({ id: clientTemplatesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Custom Client Template not found." });
    return;
  }
  await recordAudit(req, "deleted_client_template", "client_template", String(deleted.id));
  res.json({ deleted: true });
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
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  const { subject, body, label, icon } = req.body as { subject?: string; body?: string; label?: string; icon?: string };
  if (icon !== undefined && !MESSAGE_TEMPLATE_ICONS.has(icon)) {
    res.status(400).json({ error: "Choose an icon from the available set." });
    return;
  }
  const [updated] = await db.update(messageTemplatesTable).set({
    subject: subject?.trim() ?? "",
    body: body?.trim() ?? "",
    ...(label ? { label: label.trim() } : {}),
    ...(icon ? { icon } : {}),
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

router.delete("/templates/:key", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails") || !["founder", "manager"].includes(access.role)) {
    res.status(403).json({ error: "Message access required." });
    return;
  }
  const key = String(req.params.key);
  if (!key.startsWith("custom_")) {
    res.status(400).json({ error: "Default templates cannot be deleted." });
    return;
  }
  const [deleted] = await db.delete(messageTemplatesTable)
    .where(eq(messageTemplatesTable.key, key))
    .returning({ id: messageTemplatesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Custom message template not found." });
    return;
  }
  await recordAudit(req, "deleted_message_template", "message_template", String(deleted.id));
  res.json({ deleted: true });
});

router.get("/rollout/clients", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails")) {
    res.status(403).json({ error: "Rollout access required." });
    return;
  }
  const clients = await db.select({
    id: clientAccountsTable.id,
    name: clientAccountsTable.name,
    email: clientAccountsTable.email,
    updatesOptIn: clientAccountsTable.updatesOptIn,
  }).from(clientAccountsTable).orderBy(clientAccountsTable.name);
  res.json(clients);
});

router.post("/rollout", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "sendEmails")) {
    res.status(403).json({ error: "Rollout access required." });
    return;
  }
  if (!await featureEnabled("staffRollouts")) {
    res.status(403).json({ error: "Rollouts are currently disabled." });
    return;
  }
  const { title, body, audience, clientId } = req.body as {
    title?: string;
    body?: string;
    audience?: "client" | "opted_in";
    clientId?: number;
  };
  if (!title?.trim() || !body?.trim() || !["client", "opted_in"].includes(audience ?? "")) {
    res.status(400).json({ error: "Title, message, and rollout audience are required." });
    return;
  }

  let recipients: Array<{ id: number }> = [];
  if (audience === "client") {
    const targetedClientId = clientId;
    if (!Number.isInteger(targetedClientId)) {
      res.status(400).json({ error: "Choose a client for a targeted rollout." });
      return;
    }
    const [client] = await db.select({ id: clientAccountsTable.id })
      .from(clientAccountsTable)
      .where(eq(clientAccountsTable.id, targetedClientId as number))
      .limit(1);
    if (!client) {
      res.status(404).json({ error: "Client account not found." });
      return;
    }
    recipients = [client];
  } else {
    recipients = await db.select({ id: clientAccountsTable.id })
      .from(clientAccountsTable)
      .where(eq(clientAccountsTable.updatesOptIn, true));
  }
  if (!recipients.length) {
    res.status(409).json({ error: "No clients are opted in for this rollout." });
    return;
  }
  const created = await db.insert(clientNotificationsTable).values(
    recipients.map((recipient) => ({
      clientAccountId: recipient.id,
      title: title.trim().slice(0, 160),
      body: body.trim().slice(0, 5000),
      pushedBy: access.name,
    })),
  ).returning();
  await recordAudit(req, "sent_client_rollout", "client_notification", audience === "client" ? String(clientId) : "opted_in");
  res.status(201).json({ sent: created.length });
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

router.get("/client/notifications", requireClientAuth, async (req, res): Promise<void> => {
  if (!await featureEnabled("clientNotifications")) {
    res.json([]);
    return;
  }
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const notifications = await db.select().from(clientNotificationsTable)
    .where(eq(clientNotificationsTable.clientAccountId, clientId))
    .orderBy(desc(clientNotificationsTable.createdAt))
    .limit(100);
  res.json(notifications.map((notification) => ({
    ...notification,
    createdAt: notification.createdAt.toISOString(),
  })));
});

router.patch("/client/notifications/:id/read", requireClientAuth, async (req, res): Promise<void> => {
  if (!await featureEnabled("clientNotifications")) {
    res.status(403).json({ error: "Client notifications are currently disabled." });
    return;
  }
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId)) {
    res.status(400).json({ error: "A valid notification is required." });
    return;
  }
  const [updated] = await db.update(clientNotificationsTable)
    .set({ read: true })
    .where(and(eq(clientNotificationsTable.id, notificationId), eq(clientNotificationsTable.clientAccountId, clientId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
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
    const [client] = await db.select({
      name: clientAccountsTable.name,
      phone: clientAccountsTable.phone,
    }).from(clientAccountsTable).where(eq(clientAccountsTable.id, thread.clientAccountId)).limit(1);
    const [booking] = client
      ? await db.select({
          preferredDate: bookingsTable.preferredDate,
          preferredTime: bookingsTable.preferredTime,
        }).from(bookingsTable).where(eq(bookingsTable.phone, client.phone)).orderBy(desc(bookingsTable.preferredDate), desc(bookingsTable.preferredTime)).limit(1)
      : [];
    result.push({
      ...thread,
      clientName: client?.name ?? "Client",
      clientPhone: client?.phone ?? "",
      preferredDate: booking?.preferredDate ?? null,
      preferredTime: booking?.preferredTime ?? null,
      messages,
    });
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

router.patch("/support/:id/status", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "viewClients")) {
    res.status(403).json({ error: "Client support access required." });
    return;
  }
  const threadId = Number(req.params.id);
  const status = String((req.body as { status?: string }).status ?? "");
  if (!Number.isInteger(threadId) || !["open", "closed"].includes(status)) {
    res.status(400).json({ error: "A valid support status is required." });
    return;
  }
  const [updated] = await db.update(supportThreadsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportThreadsTable.id, threadId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  await recordAudit(req, `${status === "closed" ? "closed" : "reopened"}_support_thread`, "support_thread", String(threadId));
  res.json(updated);
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

router.patch("/support/:id/status/client", requireClientAuth, async (req, res): Promise<void> => {
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const threadId = Number(req.params.id);
  const status = String((req.body as { status?: string }).status ?? "");
  if (!Number.isInteger(threadId) || !["open", "closed"].includes(status)) {
    res.status(400).json({ error: "A valid support status is required." });
    return;
  }
  const [updated] = await db.update(supportThreadsTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(supportThreadsTable.id, threadId), eq(supportThreadsTable.clientAccountId, clientId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  res.json(updated);
});

router.post("/support/:id/reply/client", requireClientAuth, async (req, res): Promise<void> => {
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const threadId = Number(req.params.id);
  const body = String((req.body as { body?: string }).body ?? "").trim();
  if (!Number.isInteger(threadId) || !body) {
    res.status(400).json({ error: "A message is required." });
    return;
  }
  const [thread] = await db.select().from(supportThreadsTable)
    .where(and(eq(supportThreadsTable.id, threadId), eq(supportThreadsTable.clientAccountId, clientId)))
    .limit(1);
  if (!thread) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  const [client] = await db.select({ name: clientAccountsTable.name })
    .from(clientAccountsTable)
    .where(eq(clientAccountsTable.id, clientId))
    .limit(1);
  await db.insert(supportMessagesTable).values({ threadId, senderType: "client", senderName: client?.name ?? "Client", body });
  const [updated] = await db.update(supportThreadsTable)
    .set({ status: "open", updatedAt: new Date() })
    .where(eq(supportThreadsTable.id, threadId))
    .returning();
  res.status(201).json(updated);
});

router.post("/client/bookings", requireClientAuth, async (req, res): Promise<void> => {
  if (!await featureEnabled("clientBooking")) {
    res.status(403).json({ error: "Client booking is currently disabled." });
    return;
  }
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const { reason, preferredDate, preferredTime } = req.body as {
    reason?: string;
    preferredDate?: string;
    preferredTime?: string;
  };
  const [client] = await db.select({
    name: clientAccountsTable.name,
    phone: clientAccountsTable.phone,
  }).from(clientAccountsTable).where(eq(clientAccountsTable.id, clientId)).limit(1);

  if (!client || !reason?.trim() || !preferredDate || !preferredTime) {
    res.status(400).json({ error: "Reason, date, and time are required." });
    return;
  }

  const [settings] = await db.select({ sessionRequestsOpen: settingsTable.sessionRequestsOpen })
    .from(settingsTable)
    .limit(1);
  if (settings && !settings.sessionRequestsOpen) {
    res.status(409).json({ error: "Session requests are currently closed. Please contact support." });
    return;
  }

  const slot = await validateBookingSlot(preferredDate, preferredTime);
  if (!slot.ok) {
    res.status(409).json({ error: slot.error });
    return;
  }

  let confirmationCode = generateConfirmationCode();
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const [existing] = await db.select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(eq(bookingsTable.confirmationCode, confirmationCode))
      .limit(1);
    if (!existing) break;
    confirmationCode = generateConfirmationCode();
  }

  const [created] = await db.insert(bookingsTable).values({
    confirmationCode,
    clientName: client.name,
    phone: client.phone,
    reason: reason.trim().slice(0, 2000),
    preferredDate,
    preferredTime,
    status: "pending",
  }).returning();

  res.status(201).json({
    ...created,
    claimedBy: created.claimedBy ?? null,
    sessionNotes: created.sessionNotes ?? null,
    createdAt: created.createdAt.toISOString(),
  });
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

router.patch("/client/bookings/:id", requireClientAuth, async (req, res): Promise<void> => {
  if (!await featureEnabled("clientBooking")) {
    res.status(403).json({ error: "Client booking is currently disabled." });
    return;
  }
  const clientId = Number((req as RequestWithClientSession).clientSession?.id);
  const bookingId = Number(req.params.id);
  const { preferredDate, preferredTime, status } = req.body as {
    preferredDate?: string;
    preferredTime?: string;
    status?: string;
  };
  if (!Number.isInteger(bookingId) || (status !== undefined && status !== "cancelled")) {
    res.status(400).json({ error: "Choose a valid appointment update." });
    return;
  }
  const [client] = await db.select({ phone: clientAccountsTable.phone })
    .from(clientAccountsTable)
    .where(eq(clientAccountsTable.id, clientId))
    .limit(1);
  const [existing] = client
    ? await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.phone, client.phone)))
      .limit(1)
    : [];
  if (!existing) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }
  if (existing.status === "completed" || existing.status === "cancelled") {
    res.status(400).json({ error: `This appointment is already ${existing.status} and cannot be changed.` });
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
  if (!Object.keys(updates).length) {
    res.status(400).json({ error: "Choose a new date, time, or cancellation." });
    return;
  }
  const [updated] = await db.update(bookingsTable)
    .set(updates)
    .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.phone, client?.phone ?? "")))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
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