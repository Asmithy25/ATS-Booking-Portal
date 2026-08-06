import { Router } from "express";
import { db, settingsTable, staffAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import type { OfficeHours, HolidayHour, ClosedDate } from "@workspace/db";
import type { RequestWithSession } from "../middleware/auth";

const router = Router();

const DEFAULT_SETTINGS = {
  acceptingClients: true,
  sessionRequestsOpen: true,
  officeHours: {
    mon: { open: "12:00", close: "23:00", closed: false },
    tue: { open: "12:00", close: "23:00", closed: false },
    wed: { open: "12:00", close: "23:00", closed: false },
    thu: { open: "12:00", close: "23:00", closed: false },
    fri: { open: "12:00", close: "23:00", closed: false },
    sat: { open: "13:00", close: "20:00", closed: false },
    sun: { open: "13:00", close: "20:00", closed: false },
  } as OfficeHours,
  holidayHours: [
    { name: "Christmas", date: "12-25", closed: true, open: "", close: "" },
    { name: "Christmas Eve", date: "12-24", closed: true, open: "", close: "" },
    { name: "Thanksgiving", date: "11-27", closed: false, open: "07:00", close: "12:00" },
    { name: "New Years", date: "01-01", closed: true, open: "", close: "" },
    { name: "4th of July", date: "07-04", closed: true, open: "", close: "" },
  ] as HolidayHour[],
  closedDates: [] as ClosedDate[],
  siteName: "Ayden's Therapy Services",
  siteTagline: "Heal. Grow. Thrive.",
  logoUrl: "",
  heroTitle: "A safe space for healing and growth.",
  heroDescription: "A warm, grounded space to explore your thoughts and feelings without judgment.",
  primaryColor: "#7B4A2F",
  secondaryColor: "#C38A4A",
  accentColor: "#D9B7A2",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const IMAGE_URL = /^https?:\/\/[^\s]+$/i;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function isOfficeHours(value: unknown): value is OfficeHours {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return DAYS.every((day) => {
    const hours = candidate[day];
    if (!hours || typeof hours !== "object") return false;
    const item = hours as Record<string, unknown>;
    return typeof item.open === "string"
      && typeof item.close === "string"
      && typeof item.closed === "boolean"
      && /^\d{2}:\d{2}$/.test(item.open)
      && /^\d{2}:\d{2}$/.test(item.close);
  });
}

async function getTherapistHours() {
  const staff = await db
    .select({
      name: staffAccountsTable.name,
      officeHours: staffAccountsTable.officeHours,
      createdAt: staffAccountsTable.createdAt,
    })
    .from(staffAccountsTable)
    .orderBy(staffAccountsTable.createdAt);

  return staff.map(({ name, officeHours }) => ({
    name,
    officeHours,
  }));
}

async function ensureSettings() {
  const rows = await db.select().from(settingsTable);
  if (rows.length === 0) {
    const [created] = await db
      .insert(settingsTable)
      .values(DEFAULT_SETTINGS)
      .returning();
    return created;
  }
  return rows[0];
}

// GET /settings - public
router.get("/", async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json({
      acceptingClients: settings.acceptingClients,
      sessionRequestsOpen: settings.sessionRequestsOpen,
      officeHours: settings.officeHours,
      holidayHours: settings.holidayHours,
      closedDates: settings.closedDates,
      siteName: settings.siteName,
      siteTagline: settings.siteTagline,
      logoUrl: settings.logoUrl,
      heroTitle: settings.heroTitle,
      heroDescription: settings.heroDescription,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      accentColor: settings.accentColor,
      therapistHours: [
        {
          name: "Ayden",
          officeHours: settings.officeHours,
        },
        ...(await getTherapistHours()),
      ],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /settings/my-hours - the signed-in therapist's own schedule
router.get("/my-hours", requireAuth, async (req, res) => {
  try {
    const session = (req as RequestWithSession).staffSession;
    if (!session) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    if (session.email === "ayden@aydenstherapyservices.com") {
      const settings = await ensureSettings();
      res.json({ name: "Ayden", officeHours: settings.officeHours });
      return;
    }

    const [staff] = await db
      .select({ name: staffAccountsTable.name, officeHours: staffAccountsTable.officeHours })
      .from(staffAccountsTable)
      .where(eq(staffAccountsTable.email, session.email))
      .limit(1);

    if (!staff) {
      res.status(404).json({ error: "Staff account not found." });
      return;
    }
    res.json(staff);
  } catch (err) {
    req.log.error({ err }, "Failed to get therapist hours");
    res.status(500).json({ error: "Internal server error." });
  }
});

// PUT /settings/my-hours - only updates the signed-in therapist's schedule
router.put("/my-hours", requireAuth, async (req, res) => {
  try {
    const session = (req as RequestWithSession).staffSession;
    const officeHours = (req.body as { officeHours?: unknown })?.officeHours;
    if (!session) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    if (!isOfficeHours(officeHours)) {
      res.status(400).json({ error: "A complete weekly therapist schedule is required." });
      return;
    }

    if (session.email === "ayden@aydenstherapyservices.com") {
      const current = await ensureSettings();
      const [updated] = await db
        .update(settingsTable)
        .set({ officeHours })
        .where(eq(settingsTable.id, current.id))
        .returning({ officeHours: settingsTable.officeHours });
      res.json({ name: "Ayden", officeHours: updated.officeHours });
      return;
    }

    const [updated] = await db
      .update(staffAccountsTable)
      .set({ officeHours })
      .where(eq(staffAccountsTable.email, session.email))
      .returning({ name: staffAccountsTable.name, officeHours: staffAccountsTable.officeHours });

    if (!updated) {
      res.status(404).json({ error: "Staff account not found." });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update therapist hours");
    res.status(500).json({ error: "Internal server error." });
  }
});

// PUT /settings - staff only
router.put("/", requirePermission("manageSettings"), async (req, res) => {
  const body = req.body as Partial<{
    acceptingClients: boolean;
    sessionRequestsOpen: boolean;
    officeHours: OfficeHours;
    holidayHours: HolidayHour[];
    closedDates: ClosedDate[];
    siteName: string;
    siteTagline: string;
    logoUrl: string;
    heroTitle: string;
    heroDescription: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  }>;

  try {
    const current = await ensureSettings();
    const updates: Partial<{
      acceptingClients: boolean;
      sessionRequestsOpen: boolean;
      officeHours: OfficeHours;
      holidayHours: HolidayHour[];
      closedDates: ClosedDate[];
      siteName: string;
      siteTagline: string;
      logoUrl: string;
      heroTitle: string;
      heroDescription: string;
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
    }> = {};

    if (body.acceptingClients !== undefined) updates.acceptingClients = body.acceptingClients;
    if (body.sessionRequestsOpen !== undefined) updates.sessionRequestsOpen = body.sessionRequestsOpen;
    if (body.officeHours !== undefined) updates.officeHours = body.officeHours;
    if (body.holidayHours !== undefined) updates.holidayHours = body.holidayHours;
    if (body.closedDates !== undefined) updates.closedDates = body.closedDates;
    if (body.siteName !== undefined) updates.siteName = body.siteName.trim().slice(0, 100);
    if (body.siteTagline !== undefined) updates.siteTagline = body.siteTagline.trim().slice(0, 120);
    if (body.logoUrl !== undefined) {
      const logoUrl = body.logoUrl.trim();
      if (logoUrl.length > 2048 || (logoUrl !== "" && !IMAGE_URL.test(logoUrl))) {
        res.status(400).json({ error: "logoUrl must be a valid HTTP or HTTPS image URL." });
        return;
      }
      updates.logoUrl = logoUrl;
    }
    if (body.heroTitle !== undefined) updates.heroTitle = body.heroTitle.trim().slice(0, 180);
    if (body.heroDescription !== undefined) updates.heroDescription = body.heroDescription.trim().slice(0, 300);
    if (body.primaryColor !== undefined) {
      if (!HEX_COLOR.test(body.primaryColor)) {
        res.status(400).json({ error: "primaryColor must be a six-digit hex color." });
        return;
      }
      updates.primaryColor = body.primaryColor.toUpperCase();
    }
    if (body.secondaryColor !== undefined) {
      if (!HEX_COLOR.test(body.secondaryColor)) {
        res.status(400).json({ error: "secondaryColor must be a six-digit hex color." });
        return;
      }
      updates.secondaryColor = body.secondaryColor.toUpperCase();
    }
    if (body.accentColor !== undefined) {
      if (!HEX_COLOR.test(body.accentColor)) {
        res.status(400).json({ error: "accentColor must be a six-digit hex color." });
        return;
      }
      updates.accentColor = body.accentColor.toUpperCase();
    }

    const [updated] = await db
      .update(settingsTable)
      .set(updates)
      .where(eq(settingsTable.id, current.id))
      .returning();

    await recordAudit(req, "updated_site_settings", "settings", String(updated.id));

    res.json({
      acceptingClients: updated.acceptingClients,
      sessionRequestsOpen: updated.sessionRequestsOpen,
      officeHours: updated.officeHours,
      holidayHours: updated.holidayHours,
      closedDates: updated.closedDates,
      siteName: updated.siteName,
      siteTagline: updated.siteTagline,
      logoUrl: updated.logoUrl,
      heroTitle: updated.heroTitle,
      heroDescription: updated.heroDescription,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
      accentColor: updated.accentColor,
      therapistHours: [
        {
          name: "Ayden",
          officeHours: updated.officeHours,
        },
        ...(await getTherapistHours()),
      ],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
