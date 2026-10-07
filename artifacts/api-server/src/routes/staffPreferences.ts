import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getStaffAccess, requireAuth } from "../middleware/auth";

const router = Router();
const DEFAULTS = { layout: "composed", density: "comfortable", navigation: "classic", dashboard: "balanced", accentColor: "#7B4A2F", sidebarColor: "#3F3028", darkBackgroundColor: "#000000", appearance: "system", sidebarLabels: true, sidebarWidth: "standard" };
const NOTIFICATION_DEFAULTS = {
  appointmentAlerts: true,
  teamAssignments: true,
  teamMentions: true,
  practiceAnnouncements: true,
  feedbackAlerts: true,
  systemAlerts: true,
  emailDigest: false,
};

async function ensureTable() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS staff_portal_preferences (
    staff_email text PRIMARY KEY,
    layout text NOT NULL DEFAULT 'composed',
    density text NOT NULL DEFAULT 'comfortable',
    navigation text NOT NULL DEFAULT 'classic',
    dashboard text NOT NULL DEFAULT 'balanced',
    accent_color text NOT NULL DEFAULT '#7B4A2F',
    sidebar_color text NOT NULL DEFAULT '#3F3028',
    dark_background_color text NOT NULL DEFAULT '#000000',
    appearance text NOT NULL DEFAULT 'system',
    sidebar_labels boolean NOT NULL DEFAULT true,
    sidebar_width text NOT NULL DEFAULT 'standard',
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
}

router.get("/", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#7B4A2F'`);
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS sidebar_color text NOT NULL DEFAULT '#3F3028'`);
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS dark_background_color text NOT NULL DEFAULT '#000000'`);
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS appearance text NOT NULL DEFAULT 'system'`);
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS sidebar_labels boolean NOT NULL DEFAULT true`);
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS sidebar_width text NOT NULL DEFAULT 'standard'`);
  const result = await db.execute(sql`SELECT staff_email, layout, density, navigation, dashboard, accent_color AS "accentColor", sidebar_color AS "sidebarColor", dark_background_color AS "darkBackgroundColor", appearance, sidebar_labels AS "sidebarLabels", sidebar_width AS "sidebarWidth", updated_at FROM staff_portal_preferences WHERE staff_email = ${access.email} LIMIT 1`);
  const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
  res.json(row ? { ...DEFAULTS, ...row, staffEmail: access.email } : { ...DEFAULTS, staffEmail: access.email });
});

router.get("/notification-preferences", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'`);
  const result = await db.execute(sql`SELECT notification_preferences AS "notificationPreferences" FROM staff_portal_preferences WHERE staff_email = ${access.email} LIMIT 1`);
  const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
  res.json({ ...NOTIFICATION_DEFAULTS, ...((row?.notificationPreferences ?? {}) as Record<string, boolean>) });
});

router.put("/notification-preferences", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'`);
  const body = req.body as Record<string, unknown>;
  const prefs = Object.fromEntries(Object.keys(NOTIFICATION_DEFAULTS).map((key) => [key, body[key] !== false]));
  await db.execute(sql`INSERT INTO staff_portal_preferences (staff_email, layout, density, navigation, dashboard, accent_color, sidebar_color, appearance, sidebar_labels, sidebar_width, notification_preferences, updated_at)
    VALUES (${access.email}, 'composed', 'comfortable', 'classic', 'balanced', '#7B4A2F', '#3F3028', 'system', true, 'standard', ${JSON.stringify(prefs)}::jsonb, now())
    ON CONFLICT (staff_email) DO UPDATE SET notification_preferences=${JSON.stringify(prefs)}::jsonb, updated_at=now()`);
  res.json(prefs);
});

router.get("/notifications", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  await db.execute(sql`CREATE TABLE IF NOT EXISTS staff_notifications (
    id serial PRIMARY KEY,
    staff_email text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
  const result = await db.execute(sql`SELECT id, title, body, read, created_at AS "createdAt" FROM staff_notifications WHERE staff_email = ${access.email} ORDER BY created_at DESC LIMIT 50`);
  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  res.json(rows);
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid notification ID." });
  await db.execute(sql`UPDATE staff_notifications SET read = true WHERE id = ${id} AND staff_email = ${access.email}`);
  res.json({ success: true });
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  await db.execute(sql`UPDATE staff_notifications SET read = true WHERE staff_email = ${access.email}`);
  res.json({ success: true });
});

router.put("/", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  const body = req.body as Record<string, unknown>;
  const layout = ["composed", "relaxed", "focused", "minimal"].includes(String(body.layout)) ? String(body.layout) : DEFAULTS.layout;
  const density = ["comfortable", "compact", "spacious"].includes(String(body.density)) ? String(body.density) : DEFAULTS.density;
  const navigation = ["classic", "rail", "compact"].includes(String(body.navigation)) ? String(body.navigation) : DEFAULTS.navigation;
  const dashboard = ["balanced", "cards", "flow"].includes(String(body.dashboard)) ? String(body.dashboard) : DEFAULTS.dashboard;
  const appearance = ["light", "dark", "system"].includes(String(body.appearance)) ? String(body.appearance) : DEFAULTS.appearance;
  const sidebarLabels = body.sidebarLabels !== false;
  const sidebarWidth = ["narrow", "standard", "wide"].includes(String(body.sidebarWidth)) ? String(body.sidebarWidth) : DEFAULTS.sidebarWidth;
  const validHex = (value: unknown) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  const accentColor = validHex(body.accentColor) ? String(body.accentColor) : DEFAULTS.accentColor;
  const sidebarColor = validHex(body.sidebarColor) ? String(body.sidebarColor) : DEFAULTS.sidebarColor;
  const darkBackgroundColor = validHex(body.darkBackgroundColor) ? String(body.darkBackgroundColor) : DEFAULTS.darkBackgroundColor;
  await db.execute(sql`INSERT INTO staff_portal_preferences (staff_email, layout, density, navigation, dashboard, accent_color, sidebar_color, dark_background_color, appearance, sidebar_labels, sidebar_width, updated_at)
    VALUES (${access.email}, ${layout}, ${density}, ${navigation}, ${dashboard}, ${accentColor}, ${sidebarColor}, ${darkBackgroundColor}, ${appearance}, ${sidebarLabels}, ${sidebarWidth}, now())
    ON CONFLICT (staff_email) DO UPDATE SET layout=${layout}, density=${density}, navigation=${navigation}, dashboard=${dashboard}, accent_color=${accentColor}, sidebar_color=${sidebarColor}, dark_background_color=${darkBackgroundColor}, appearance=${appearance}, sidebar_labels=${sidebarLabels}, sidebar_width=${sidebarWidth}, updated_at=now()`);
  res.json({ ...DEFAULTS, layout, density, navigation, dashboard, accentColor, sidebarColor, darkBackgroundColor, appearance, sidebarLabels, sidebarWidth, staffEmail: access.email });
});

export default router;
