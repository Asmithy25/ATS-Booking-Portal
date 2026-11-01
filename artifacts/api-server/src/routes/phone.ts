import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, isCorporateExecutiveAccess, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();
const DEFAULT_PHONE_BOOK = {
  divisions: [] as Array<{ id: string; name: string; extension: string; notes: string }>,
  staff: [] as Array<{ id: string; name: string; division: string; extension: string; notes: string }>,
  scripts: [
    { id: "answer", title: "Answering a call", category: "Greeting", body: "Good [morning/afternoon/evening], thank you for calling Aydens Wellness Services, an Ayden Smith Holdings company. This is [your name]. How may I help you today?" },
    { id: "hold", title: "Placing a caller on hold", category: "Call handling", body: "May I place you on a brief hold while I check that information? Thank you. [Wait for consent before putting the caller on hold.]" },
    { id: "transfer", title: "Transferring a call", category: "Call handling", body: "I can connect you with [division/staff member]. May I place you on a brief hold while I check whether they are available? [Explain if the transfer cannot be completed.]" },
    { id: "callback", title: "Taking a message", category: "Call handling", body: "They are unavailable right now. Would you like to leave a message? With your permission, I can take your name, a safe callback number, and the best time to reach you. Please avoid sharing sensitive health details over voicemail." },
    { id: "ending", title: "Ending a call", category: "Closing", body: "Is there anything else I can help you with today? Thank you for calling Aydens Wellness Services. We appreciate your time. Have a wonderful rest of your day." },
    { id: "voicemail", title: "Voicemail greeting", category: "Voicemail", body: "Thank you for calling Aydens Wellness Services. We are unable to answer right now. Please leave your name, a safe callback number, and a brief non-sensitive message. If this is an emergency, call your local emergency number. We will respond during our available hours." },
  ] as Array<{ id: string; title: string; category: string; body: string }>,
  updatedAt: null as string | null,
  updatedBy: "" as string,
};
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const entries = (value: unknown, max: number, kind: "division" | "staff" | "script") => {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid " + kind + " list.");
  const seen = new Set<string>();
  return value.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error("Invalid " + kind + " entry.");
    const id = clean(row.id, 70) || kind + "-" + index;
    if (seen.has(id)) throw new Error("Duplicate item identifier.");
    seen.add(id);
    if (kind === "division") {
      const name = clean(row.name, 100);
      if (!name) throw new Error("Every division needs a name.");
      return { id, name, extension: clean(row.extension, 30), notes: clean(row.notes, 250) };
    }
    if (kind === "staff") {
      const name = clean(row.name, 100);
      if (!name) throw new Error("Every staff member needs a name.");
      return { id, name, division: clean(row.division, 100), extension: clean(row.extension, 30), notes: clean(row.notes, 250) };
    }
    const title = clean(row.title, 120);
    const body = clean(row.body, 4000);
    if (!title || !body) throw new Error("Every phone script needs a title and script text.");
    return { id, title, category: clean(row.category, 80), body };
  });
};
const resultRows = (result: any): any[] => Array.isArray(result) ? result : (result?.rows ?? []);
async function ensureStorage() {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ash_corporate_config (
    key text PRIMARY KEY,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
  )`));
}
async function readPhoneBook() {
  await ensureStorage();
  const result = await db.execute(sql`SELECT value FROM ash_corporate_config WHERE key = 'staff_phone_directory' LIMIT 1`);
  const stored = resultRows(result)[0]?.value;
  return stored && typeof stored === "object" && !Array.isArray(stored)
    ? { ...DEFAULT_PHONE_BOOK, ...stored }
    : DEFAULT_PHONE_BOOK;
}
router.get("/", requireAuth, async (req, res) => {
  try {
    const access = await getStaffAccess(req);
    if (!access) { res.status(401).json({ error: "Staff sign-in required." }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ...(await readPhoneBook()), canManage: isCorporateExecutiveAccess(access) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff phone directory");
    res.status(500).json({ error: "Could not load the phone directory." });
  }
});
router.put("/", requireAuth, async (req, res) => {
  try {
    const access = await getStaffAccess(req);
    if (!access) { res.status(401).json({ error: "Staff sign-in required." }); return; }
    if (!isCorporateExecutiveAccess(access)) {
      res.status(403).json({ error: "Only Ayden (Founder) and ASH Corporate can edit the phone directory and scripts." });
      return;
    }
    const payload = req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      res.status(400).json({ error: "Invalid phone directory payload." }); return;
    }
    const next = {
      divisions: entries(payload.divisions, 100, "division"),
      staff: entries(payload.staff, 250, "staff"),
      scripts: entries(payload.scripts, 100, "script"),
      updatedAt: new Date().toISOString(),
      updatedBy: access.name,
    };
    await ensureStorage();
    await db.execute(sql`INSERT INTO ash_corporate_config (key, value, updated_by, updated_at)
      VALUES ('staff_phone_directory', ${JSON.stringify(next)}::jsonb, ${access.email}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`);
    await recordAudit(req, "updated_staff_phone_directory", "ash_corporate_config", "staff_phone_directory");
    res.json({ ...next, canManage: true });
  } catch (error) {
    if (error instanceof Error && /Invalid|Duplicate|needs a/.test(error.message)) {
      res.status(400).json({ error: error.message }); return;
    }
    req.log.error({ err: error }, "Failed to save staff phone directory");
    res.status(500).json({ error: "Could not save the phone directory." });
  }
});
export default router;
