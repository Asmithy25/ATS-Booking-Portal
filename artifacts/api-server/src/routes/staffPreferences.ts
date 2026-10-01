import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getStaffAccess, requireAuth } from "../middleware/auth";

const router = Router();
const DEFAULTS = { layout: "composed", density: "comfortable", navigation: "classic", dashboard: "balanced" };

async function ensureTable() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS staff_portal_preferences (
    staff_email text PRIMARY KEY,
    layout text NOT NULL DEFAULT 'composed',
    density text NOT NULL DEFAULT 'comfortable',
    navigation text NOT NULL DEFAULT 'classic',
    dashboard text NOT NULL DEFAULT 'balanced',
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
}

router.get("/", requireAuth, async (req, res) => {
  const access = await getStaffAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized." });
  await ensureTable();
  const result = await db.execute(sql`SELECT staff_email, layout, density, navigation, dashboard, updated_at FROM staff_portal_preferences WHERE staff_email = ${access.email} LIMIT 1`);
  const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
  res.json(row ? { ...DEFAULTS, ...row, staffEmail: access.email } : { ...DEFAULTS, staffEmail: access.email });
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
  await db.execute(sql`INSERT INTO staff_portal_preferences (staff_email, layout, density, navigation, dashboard, updated_at)
    VALUES (${access.email}, ${layout}, ${density}, ${navigation}, ${dashboard}, now())
    ON CONFLICT (staff_email) DO UPDATE SET layout=${layout}, density=${density}, navigation=${navigation}, dashboard=${dashboard}, updated_at=now()`);
  res.json({ ...DEFAULTS, layout, density, navigation, dashboard, staffEmail: access.email });
});

export default router;
