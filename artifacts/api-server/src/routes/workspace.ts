import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  announcementsTable,
  bookingsTable,
  clientAccountsTable,
  sessionFeedbackTable,
  staffAccountsTable,
  settingsTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { ADMIN_EMAIL, getStaffAccess, hasPermission, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();

const DEFAULT_STATUS = {
  mode: "auto",
  title: "We’re here when you’re ready",
  detail: "Phone consultations are currently open for new requests.",
  label: "Accepting new requests",
  tone: "soft",
};

const DEFAULT_SEASONAL = { mode: "auto", season: "none", intensity: "subtle", enabled: true };

const DEFAULT_EXPERIENCE = {
  enabled: true,
  voice: "warm",
  greeting: "Welcome back. Let’s take today one step at a time.",
  quietMessage: "You’re all caught up.",
  savedMessage: "Saved — your Aydens workspace is in sync.",
  errorMessage: "Something wandered off. Your information is still safe.",
};

const DEFAULT_CHANNELS = [
  { id: "general", label: "General", description: "Everyday team conversation" },
  { id: "care-coordination", label: "Care coordination", description: "Handoffs and client care" },
  { id: "announcements", label: "Announcements", description: "Practice-wide updates" },
];

let setupPromise: Promise<void> | null = null;

function rowsOf(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  return (result as any)?.rows ?? [];
}

async function ensureWorkspaceTables() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS staff_profile_overrides (
        staff_email text PRIMARY KEY,
        bio text NOT NULL DEFAULT '',
        photo_url text NOT NULL DEFAULT '',
        focus text NOT NULL DEFAULT '',
        display_title text NOT NULL DEFAULT '',
        updated_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS practice_mode_schedules (
        id serial PRIMARY KEY,
        name text NOT NULL,
        mode text NOT NULL DEFAULT 'limited',
        title text NOT NULL,
        detail text NOT NULL,
        label text NOT NULL,
        starts_at timestamp NOT NULL,
        ends_at timestamp NOT NULL,
        created_by text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS team_chat_channels (
        id text PRIMARY KEY,
        label text NOT NULL,
        description text NOT NULL DEFAULT '',
        active boolean NOT NULL DEFAULT true,
        created_by text NOT NULL DEFAULT 'system',
        created_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS team_chat_reads (
        staff_email text NOT NULL,
        channel_id text NOT NULL,
        last_read_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (staff_email, channel_id)
      )`);
      await db.execute(sql`ALTER TABLE collaboration_items ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb`);
      await db.execute(sql`ALTER TABLE collaboration_items ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false`);
      for (const channel of DEFAULT_CHANNELS) {
        await db.execute(sql`INSERT INTO team_chat_channels (id, label, description, created_by)
          VALUES (${channel.id}, ${channel.label}, ${channel.description}, 'system')
          ON CONFLICT (id) DO NOTHING`);
      }
    })().catch((err) => {
      setupPromise = null;
      throw err;
    });
  }
  await setupPromise;
}

function normalizeMode(value: unknown) {
  return ["auto", "open", "paused", "limited", "high_demand"].includes(String(value)) ? String(value) : "auto";
}

function normalizeTone(value: unknown) {
  return ["soft", "warm", "quiet", "bright"].includes(String(value)) ? String(value) : "soft";
}

function getAutoSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

function seasonLabel(season: string) {
  return ({ winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall", halloween: "Halloween" } as Record<string, string>)[season] ?? "Aydens";
}

async function getCurrentPracticeStatus() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const content = (settings?.homepageContent ?? {}) as Record<string, any>;
  const saved = {
    ...DEFAULT_STATUS,
    ...(content.practiceStatus && typeof content.practiceStatus === "object" ? content.practiceStatus : {}),
  };
  let derived = {
    mode: "open",
    title: "We’re here when you’re ready",
    detail: "Phone consultations are currently open for new requests.",
    label: "Accepting new requests",
    tone: "soft",
  };
  if (settings?.vacationMode || !settings?.acceptingClients || !settings?.sessionRequestsOpen) {
    derived = {
      mode: "paused",
      title: settings?.vacationMode ? "A little pause is okay" : "We’re taking a little pause",
      detail: settings?.vacationMode ? "New requests are temporarily paused while we take a rest." : "New phone consultation requests are temporarily paused.",
      label: "Request window paused",
      tone: "quiet",
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  const closedDates = Array.isArray(settings?.closedDates) ? settings!.closedDates as Array<{ date: string }> : [];
  if (closedDates.some((item) => item.date === today)) {
    derived = {
      mode: "paused",
      title: "Today is a quiet day",
      detail: "The practice is closed today. Requests will reopen according to the current schedule.",
      label: "Closed today",
      tone: "quiet",
    };
  }
  const scheduleResult = await db.execute(sql`SELECT id, name, mode, title, detail, label, starts_at AS "startsAt", ends_at AS "endsAt"
    FROM practice_mode_schedules
    WHERE starts_at <= now() AND ends_at > now()
    ORDER BY starts_at DESC, id DESC
    LIMIT 1`).catch(() => ({ rows: [] }));
  const active = rowsOf(scheduleResult)[0];
  const status = active
    ? { ...active, scheduled: true }
    : saved.mode === "auto"
      ? { ...derived, scheduled: false }
      : { ...saved, mode: normalizeMode(saved.mode), tone: normalizeTone(saved.tone), scheduled: false };

  const seasonalSaved = content.seasonal && typeof content.seasonal === "object" ? content.seasonal : DEFAULT_SEASONAL;
  const seasonalSeason = seasonalSaved.mode === "manual" ? seasonalSaved.season : getAutoSeason();
  return {
    ...status,
    seasonal: { ...DEFAULT_SEASONAL, ...seasonalSaved, season: seasonalSeason, seasonLabel: seasonLabel(seasonalSeason) },
    experience: { ...DEFAULT_EXPERIENCE, ...(content.experience && typeof content.experience === "object" ? content.experience : {}) },
  };
}

router.get("/practice-status", async (_req, res): Promise<void> => {
  try {
    await ensureWorkspaceTables();
    res.json(await getCurrentPracticeStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load practice status." });
  }
});

router.get("/public-experience", async (_req, res): Promise<void> => {
  try {
    await ensureWorkspaceTables();
    const status = await getCurrentPracticeStatus();
    res.json({
      practice: { mode: status.mode, title: status.title, detail: status.detail, label: status.label, tone: status.tone },
      seasonal: status.seasonal,
      experience: status.experience,
    });
  } catch {
    const season = getAutoSeason();
    res.json({ practice: DEFAULT_STATUS, seasonal: { ...DEFAULT_SEASONAL, season, seasonLabel: seasonLabel(season) }, experience: DEFAULT_EXPERIENCE });
  }
});

router.get("/practice-settings", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "manageSettings")) {
    res.status(access ? 403 : 401).json({ error: access ? "Practice settings access required." : "Unauthorized." });
    return;
  }
  await ensureWorkspaceTables();
  const [settings] = await db.select().from(settingsTable).limit(1);
  const content = (settings?.homepageContent ?? {}) as Record<string, any>;
  res.json({
    practiceStatus: { ...DEFAULT_STATUS, ...(content.practiceStatus ?? {}) },
    seasonal: { ...DEFAULT_SEASONAL, ...(content.seasonal ?? {}) },
    experience: { ...DEFAULT_EXPERIENCE, ...(content.experience ?? {}) },
  });
});

router.put("/practice-settings", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "manageSettings")) {
    res.status(access ? 403 : 401).json({ error: access ? "Practice settings access required." : "Unauthorized." });
    return;
  }
  await ensureWorkspaceTables();
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) { res.status(500).json({ error: "Site settings are not initialized." }); return; }

  const body = req.body as Record<string, any>;
  const current = (settings.homepageContent ?? {}) as Record<string, any>;
  const incomingStatus = body.practiceStatus && typeof body.practiceStatus === "object" ? body.practiceStatus : {};
  const practiceStatus = {
    ...DEFAULT_STATUS,
    ...incomingStatus,
    mode: normalizeMode(incomingStatus.mode),
    tone: normalizeTone(incomingStatus.tone),
    title: String(incomingStatus.title ?? DEFAULT_STATUS.title).trim().slice(0, 160),
    detail: String(incomingStatus.detail ?? DEFAULT_STATUS.detail).trim().slice(0, 300),
    label: String(incomingStatus.label ?? DEFAULT_STATUS.label).trim().slice(0, 80),
  };

  const incomingSeasonal = body.seasonal && typeof body.seasonal === "object" ? body.seasonal : {};
  const seasonal = {
    ...DEFAULT_SEASONAL,
    ...incomingSeasonal,
    mode: incomingSeasonal.mode === "manual" ? "manual" : "auto",
    season: ["none", "winter", "spring", "summer", "fall", "halloween"].includes(String(incomingSeasonal.season)) ? String(incomingSeasonal.season) : "none",
    intensity: ["subtle", "warm", "festive"].includes(String(incomingSeasonal.intensity)) ? String(incomingSeasonal.intensity) : "subtle",
    enabled: incomingSeasonal.enabled !== false,
  };

  const incomingExperience = body.experience && typeof body.experience === "object" ? body.experience : {};
  const experience = {
    ...DEFAULT_EXPERIENCE,
    ...incomingExperience,
    enabled: incomingExperience.enabled !== false,
    voice: ["warm", "grounded", "bright", "minimal"].includes(String(incomingExperience.voice)) ? String(incomingExperience.voice) : "warm",
    greeting: String(incomingExperience.greeting ?? DEFAULT_EXPERIENCE.greeting).trim().slice(0, 180),
    quietMessage: String(incomingExperience.quietMessage ?? DEFAULT_EXPERIENCE.quietMessage).trim().slice(0, 120),
    savedMessage: String(incomingExperience.savedMessage ?? DEFAULT_EXPERIENCE.savedMessage).trim().slice(0, 180),
    errorMessage: String(incomingExperience.errorMessage ?? DEFAULT_EXPERIENCE.errorMessage).trim().slice(0, 180),
  };

  const homepageContent = { ...current, practiceStatus, seasonal, experience };
  await db.update(settingsTable).set({ homepageContent: homepageContent as any }).where(eq(settingsTable.id, settings.id));
  await recordAudit(req, "updated_practice_control", "settings", String(settings.id));
  res.json({ practiceStatus, seasonal, experience });
});

router.get("/practice-schedules", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "manageSettings")) { res.status(access ? 403 : 401).json({ error: "Practice schedule access required." }); return; }
  await ensureWorkspaceTables();
  const result = await db.execute(sql`SELECT id, name, mode, title, detail, label, starts_at AS "startsAt", ends_at AS "endsAt", created_by AS "createdBy", created_at AS "createdAt"
    FROM practice_mode_schedules ORDER BY starts_at ASC, id ASC`);
  res.json(rowsOf(result));
});

router.post("/practice-schedules", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "manageSettings")) { res.status(access ? 403 : 401).json({ error: "Practice schedule access required." }); return; }
  await ensureWorkspaceTables();
  const body = req.body as Record<string, unknown>;
  const startsAt = new Date(String(body.startsAt ?? ""));
  const endsAt = new Date(String(body.endsAt ?? ""));
  if (!String(body.name ?? "").trim() || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    res.status(400).json({ error: "Give the schedule a name and a valid start/end time." }); return;
  }
  const mode = ["open", "paused", "limited", "high_demand"].includes(String(body.mode)) ? String(body.mode) : "limited";
  const created = rowsOf(await db.execute(sql`INSERT INTO practice_mode_schedules (name, mode, title, detail, label, starts_at, ends_at, created_by)
    VALUES (${String(body.name).trim().slice(0, 120)}, ${mode},
      ${String(body.title ?? "Aydens Wellness Services").trim().slice(0, 160)},
      ${String(body.detail ?? "").trim().slice(0, 300)},
      ${String(body.label ?? mode).trim().slice(0, 80)},
      ${startsAt.toISOString()}, ${endsAt.toISOString()}, ${access.email})
    RETURNING id, name, mode, title, detail, label, starts_at AS "startsAt", ends_at AS "endsAt", created_by AS "createdBy", created_at AS "createdAt"`))[0];
  await recordAudit(req, "created_practice_mode_schedule", "practice_mode_schedule", String(created?.id ?? ""));
  res.status(201).json(created);
});

router.delete("/practice-schedules/:id", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !hasPermission(access, "manageSettings")) { res.status(access ? 403 : 401).json({ error: "Practice schedule access required." }); return; }
  await ensureWorkspaceTables();
  const id = Number(req.params.id);
  const deleted = rowsOf(await db.execute(sql`DELETE FROM practice_mode_schedules WHERE id=${id} RETURNING id`))[0];
  if (!deleted) { res.status(404).json({ error: "Schedule not found." }); return; }
  await recordAudit(req, "deleted_practice_mode_schedule", "practice_mode_schedule", String(id));
  res.json({ success: true });
});

router.get("/staff", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const rows = await db.select({
    id: staffAccountsTable.id,
    email: staffAccountsTable.email,
    name: staffAccountsTable.name,
    role: staffAccountsTable.role,
    bio: staffAccountsTable.bio,
    photoUrl: staffAccountsTable.photoUrl,
    isVisible: staffAccountsTable.isVisible,
    createdAt: staffAccountsTable.createdAt,
  }).from(staffAccountsTable).orderBy(staffAccountsTable.createdAt);
  const overrides = rowsOf(await db.execute(sql`SELECT staff_email AS "staffEmail", bio, photo_url AS "photoUrl", focus, display_title AS "displayTitle" FROM staff_profile_overrides`));
  const overrideMap = new Map(overrides.map((row) => [row.staffEmail, row]));
  const founderOverride = overrideMap.get(ADMIN_EMAIL);
  res.json([
    {
      id: "founder",
      email: ADMIN_EMAIL,
      name: "Ayden Smith",
      role: "founder",
      bio: founderOverride?.bio ?? "",
      photoUrl: founderOverride?.photoUrl ?? "",
      focus: founderOverride?.focus ?? "",
      displayTitle: founderOverride?.displayTitle || "Founder & CEO",
      isVisible: true,
    },
    ...rows.map((row) => ({
      ...row,
      focus: overrideMap.get(row.email)?.focus ?? "",
      displayTitle: overrideMap.get(row.email)?.displayTitle || row.role.replaceAll("_", " "),
    })),
  ]);
});

router.patch("/staff/:email/profile", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const email = decodeURIComponent(String(req.params.email)).toLowerCase().trim();
  if (access.role !== "founder" && access.email !== email) { res.status(403).json({ error: "You can only edit your own staff profile." }); return; }
  const body = req.body as Record<string, unknown>;
  const bio = String(body.bio ?? "").trim().slice(0, 1200);
  const focus = String(body.focus ?? "").trim().slice(0, 160);
  const displayTitle = String(body.displayTitle ?? "").trim().slice(0, 120);
  const photoUrl = String(body.photoUrl ?? "").trim().slice(0, 7000000);
  if (photoUrl && !/^(https?:\/\/|data:image\/)/i.test(photoUrl)) { res.status(400).json({ error: "Photo must be an image URL or uploaded image data." }); return; }
  await db.execute(sql`INSERT INTO staff_profile_overrides (staff_email, bio, photo_url, focus, display_title, updated_at)
    VALUES (${email}, ${bio}, ${photoUrl}, ${focus}, ${displayTitle}, now())
    ON CONFLICT (staff_email) DO UPDATE SET bio=${bio}, photo_url=${photoUrl}, focus=${focus}, display_title=${displayTitle}, updated_at=now()`);
  await recordAudit(req, "updated_staff_profile", "staff_profile", email);
  res.json({ success: true, email, bio, photoUrl, focus, displayTitle });
});

router.get("/welcome-summary", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const today = new Date().toISOString().slice(0, 10);
  const todayAppointments = rowsOf(await db.execute(sql`SELECT count(*)::int AS count FROM bookings WHERE preferred_date=${today} AND status <> 'cancelled'`))[0]?.count ?? 0;
  const upcoming = rowsOf(await db.execute(sql`SELECT id, client_name AS "clientName", preferred_date AS "preferredDate", preferred_time AS "preferredTime", confirmation_code AS "confirmationCode", status
    FROM bookings WHERE preferred_date >= ${today} AND status NOT IN ('cancelled','completed')
    ORDER BY preferred_date ASC, preferred_time ASC LIMIT 8`));
  const openTeam = rowsOf(await db.execute(sql`SELECT count(*)::int AS count FROM collaboration_items WHERE status <> 'done'`))[0]?.count ?? 0;
  const unread = rowsOf(await db.execute(sql`SELECT count(*)::int AS count FROM staff_notifications WHERE staff_email=${access.email} AND read=false`))[0]?.count ?? 0;
  const staffCount = 1 + (await db.select({ id: staffAccountsTable.id }).from(staffAccountsTable)).length;
  res.json({
    todayAppointments: Number(todayAppointments),
    upcomingAppointments: upcoming,
    openTeamItems: Number(openTeam),
    unreadNotifications: Number(unread),
    staffCount,
  });
});

router.get("/founder-summary", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || access.role !== "founder") { res.status(access ? 403 : 401).json({ error: "Founder dashboard access required." }); return; }
  await ensureWorkspaceTables();
  const bookings = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.preferredDate), desc(bookingsTable.preferredTime)).limit(300);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((item) => item.preferredDate >= today && !["cancelled", "completed"].includes(item.status)).slice(0, 8);
  const feedback = await db.select().from(sessionFeedbackTable).limit(500);
  const openTeam = rowsOf(await db.execute(sql`SELECT count(*)::int AS count FROM collaboration_items WHERE status <> 'done'`))[0]?.count ?? 0;
  const unread = rowsOf(await db.execute(sql`SELECT count(*)::int AS count FROM staff_notifications WHERE read = false`)).at(0)?.count ?? 0;
  const activeSchedules = rowsOf(await db.execute(sql`SELECT count(*)::int AS count FROM practice_mode_schedules WHERE starts_at <= now() AND ends_at > now()`)).at(0)?.count ?? 0;
  const staffCount = 1 + (await db.select({ id: staffAccountsTable.id }).from(staffAccountsTable)).length;
  const avg = feedback.length ? Math.round((feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length) * 10) / 10 : null;
  res.json({
    todayAppointments: bookings.filter((item) => item.preferredDate === today && item.status !== "cancelled").length,
    upcomingAppointments: upcoming,
    bookingTotal: bookings.length,
    clients: new Set(bookings.map((item) => item.phone)).size,
    completed: bookings.filter((item) => item.status === "completed").length,
    cancelled: bookings.filter((item) => item.status === "cancelled").length,
    feedbackCount: feedback.length,
    averageRating: avg,
    openTeamItems: Number(openTeam),
    unreadNotifications: Number(unread),
    activeSchedules: Number(activeSchedules),
    staffCount,
  });
});

router.get("/search", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  if (q.length < 2) { res.json([]); return; }
  const needle = "%" + q + "%";
  const bookingRows = rowsOf(await db.execute(sql`SELECT 'booking' AS type, id::text AS id, client_name AS title, (confirmation_code || ' · ' || preferred_date || ' · ' || status) AS subtitle, '/staff/bookings' AS href
    FROM bookings WHERE client_name ILIKE ${needle} OR phone ILIKE ${needle} OR confirmation_code ILIKE ${needle} OR reason ILIKE ${needle}
    ORDER BY created_at DESC LIMIT 12`));
  const clientRows = rowsOf(await db.execute(sql`SELECT 'client' AS type, id::text AS id, name AS title, email || ' · ' || phone AS subtitle, '/staff/clients' AS href
    FROM client_accounts WHERE name ILIKE ${needle} OR email ILIKE ${needle} OR phone ILIKE ${needle}
    ORDER BY created_at DESC LIMIT 12`));
  const announcementRows = rowsOf(await db.execute(sql`SELECT 'announcement' AS type, id::text AS id, title, body AS subtitle, '/staff/announcements' AS href
    FROM announcements WHERE title ILIKE ${needle} OR body ILIKE ${needle}
    ORDER BY created_at DESC LIMIT 12`));
  const workspaceRows = rowsOf(await db.execute(sql`SELECT 'workspace' AS type, id::text AS id, COALESCE(title, kind) AS title, body AS subtitle, '/staff/team' AS href
    FROM collaboration_items WHERE title ILIKE ${needle} OR body ILIKE ${needle} OR author_name ILIKE ${needle}
    ORDER BY created_at DESC LIMIT 12`));
  const staffRows = rowsOf(await db.execute(sql`SELECT 'staff' AS type, id::text AS id, name AS title, email || ' · ' || role AS subtitle, '/staff/staff-directory' AS href
    FROM staff_accounts WHERE name ILIKE ${needle} OR email ILIKE ${needle} OR role ILIKE ${needle}
    ORDER BY created_at DESC LIMIT 12`));
  res.json([...bookingRows, ...clientRows, ...announcementRows, ...workspaceRows, ...staffRows].slice(0, 50));
});

router.get("/health", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  const started = Date.now();
  let database = { status: "healthy", latencyMs: 0 };
  try {
    await db.execute(sql`select 1 as ok`);
    database.latencyMs = Date.now() - started;
  } catch {
    database = { status: "error", latencyMs: Date.now() - started };
  }
  await ensureWorkspaceTables().catch(() => undefined);
  const tableChecks = [];
  for (const table of ["bookings", "client_accounts", "announcements", "collaboration_items", "staff_accounts"]) {
    try {
      const result = await db.execute(sql.raw("select count(*)::int as count from " + table));
      tableChecks.push({ name: table, status: "healthy", count: Number(rowsOf(result)[0]?.count ?? 0) });
    } catch {
      tableChecks.push({ name: table, status: "error", count: null });
    }
  }
  res.json({
    service: "Aydens Wellness Services API",
    environment: process.env.NODE_ENV ?? "development",
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    database,
    tables: tableChecks,
    scheduler: { status: "healthy", cadenceSeconds: 60 },
    frontend: { status: "connected", originHint: "GitHub Pages" },
  });
});

router.get("/chat/channels", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const channels = rowsOf(await db.execute(sql`SELECT id, label, description, active, created_by AS "createdBy" FROM team_chat_channels WHERE active = true ORDER BY created_at ASC`));
  const unread = rowsOf(await db.execute(sql`SELECT r.channel_id AS "channelId", count(c.id)::int AS unread
    FROM team_chat_reads r
    LEFT JOIN collaboration_items c ON c.kind='chat' AND (c.title=r.channel_id OR c.title=(SELECT label FROM team_chat_channels WHERE id=r.channel_id)) AND c.created_at > r.last_read_at
    WHERE r.staff_email=${access.email}
    GROUP BY r.channel_id`));
  const unreadMap = new Map(unread.map((item) => [item.channelId, Number(item.unread)]));
  res.json(channels.map((channel) => ({ ...channel, unread: unreadMap.get(channel.id) ?? 0 })));
});

router.post("/chat/channels", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !["founder", "manager"].includes(access.role)) { res.status(access ? 403 : 401).json({ error: "Only managers can create team channels." }); return; }
  await ensureWorkspaceTables();
  const id = String(req.body?.id ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 50);
  const label = String(req.body?.label ?? "").trim().slice(0, 80);
  const description = String(req.body?.description ?? "").trim().slice(0, 180);
  if (!id || !label) { res.status(400).json({ error: "Channel name and label are required." }); return; }
  try {
    const created = rowsOf(await db.execute(sql`INSERT INTO team_chat_channels (id, label, description, created_by)
      VALUES (${id}, ${label}, ${description}, ${access.email})
      RETURNING id, label, description, active, created_by AS "createdBy"`))[0];
    res.status(201).json({ ...created, unread: 0 });
  } catch {
    res.status(409).json({ error: "That channel already exists." });
  }
});

router.patch("/chat/channels/:id", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !["founder", "manager"].includes(access.role)) { res.status(access ? 403 : 401).json({ error: "Only managers can manage team channels." }); return; }
  await ensureWorkspaceTables();
  const id = String(req.params.id);
  const active = req.body?.active !== false;
  const label = String(req.body?.label ?? "").trim().slice(0, 80);
  const description = String(req.body?.description ?? "").trim().slice(0, 180);
  const updated = rowsOf(await db.execute(sql`UPDATE team_chat_channels SET
    label=COALESCE(NULLIF(${label}, ''), label),
    description=COALESCE(NULLIF(${description}, ''), description),
    active=${active}
    WHERE id=${id}
    RETURNING id, label, description, active, created_by AS "createdBy"`))[0];
  if (!updated) { res.status(404).json({ error: "Channel not found." }); return; }
  res.json({ ...updated, unread: 0 });
});

router.get("/chat", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const channel = String(req.query.channel ?? "general");
  const result = await db.execute(sql`SELECT id, author_name AS "authorName", body, created_at AS "createdAt", pinned, metadata
    FROM collaboration_items
    WHERE kind='chat' AND (title=${channel} OR title=(SELECT label FROM team_chat_channels WHERE id=${channel}))
    ORDER BY created_at ASC LIMIT 300`);
  res.json(rowsOf(result));
});

router.post("/chat", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const channel = String(req.body?.channel ?? "general");
  const body = String(req.body?.body ?? "").trim().slice(0, 5000);
  const replyTo = req.body?.replyToId ? Number(req.body.replyToId) : null;
  if (!body) { res.status(400).json({ error: "Message text is required." }); return; }
  const channels = rowsOf(await db.execute(sql`SELECT id FROM team_chat_channels WHERE id=${channel} AND active=true LIMIT 1`));
  if (!channels.length) { res.status(400).json({ error: "That team channel is not available." }); return; }

  const staff = await db.select({ email: staffAccountsTable.email, name: staffAccountsTable.name }).from(staffAccountsTable);
  const mentionNames = staff.filter((person) => new RegExp("@" + person.name.replace(/[.*+?^\\{}()|[\\]\\\\]/g, "\\\\$&") + "\\\\b", "i").test(body)).map((person) => person);
  if (new RegExp("@Ayden\\\\b", "i").test(body)) mentionNames.push({ email: ADMIN_EMAIL, name: "Ayden Smith" });

  const metadata = { channel, reactions: {}, replyToId: Number.isInteger(replyTo) ? replyTo : null, mentions: mentionNames.map((person) => person.email) };
  const created = rowsOf(await db.execute(sql`INSERT INTO collaboration_items (kind, title, body, author_name, assigned_to, status, metadata)
    VALUES ('chat', ${channel}, ${body}, ${access.name}, NULL, 'open', ${JSON.stringify(metadata)}::jsonb)
    RETURNING id, author_name AS "authorName", body, created_at AS "createdAt", pinned, metadata`))[0];

  for (const person of mentionNames.filter((person) => person.email !== access.email)) {
    const prefsResult = await db.execute(sql`SELECT notification_preferences AS prefs FROM staff_portal_preferences WHERE staff_email=${person.email} LIMIT 1`).catch(() => ({ rows: [] }));
    const prefsRow = Array.isArray(prefsResult) ? prefsResult[0] : (prefsResult as any).rows?.[0];
    const prefs = (prefsRow?.prefs ?? {}) as Record<string, boolean>;
    if (prefs.teamMentions !== false) {
      await db.execute(sql`INSERT INTO staff_notifications (staff_email, title, body)
        VALUES (${person.email}, ${"You were mentioned in #" + channel}, ${access.name + " mentioned you: " + body.slice(0, 220)})`).catch(() => undefined);
    }
  }
  res.status(201).json(created);
});

router.post("/chat/:id/reaction", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const id = Number(req.params.id);
  const reaction = String(req.body?.reaction ?? "");
  if (!["heart", "thumbs_up", "check"].includes(reaction)) { res.status(400).json({ error: "Unsupported reaction." }); return; }
  const existing = rowsOf(await db.execute(sql`SELECT metadata FROM collaboration_items WHERE id=${id} AND kind='chat' LIMIT 1`))[0];
  if (!existing) { res.status(404).json({ error: "Message not found." }); return; }
  const metadata = { ...(existing.metadata ?? {}) } as Record<string, any>;
  const reactions = { ...(metadata.reactions ?? {}) } as Record<string, string[]>;
  const users = Array.isArray(reactions[reaction]) ? [...reactions[reaction]] : [];
  const index = users.indexOf(access.email);
  if (index >= 0) users.splice(index, 1); else users.push(access.email);
  reactions[reaction] = users;
  metadata.reactions = reactions;
  const updated = rowsOf(await db.execute(sql`UPDATE collaboration_items SET metadata=${JSON.stringify(metadata)}::jsonb WHERE id=${id}
    RETURNING id, author_name AS "authorName", body, created_at AS "createdAt", pinned, metadata`))[0];
  res.json(updated);
});

router.patch("/chat/:id/pin", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access || !["founder", "manager"].includes(access.role)) { res.status(access ? 403 : 401).json({ error: "Only managers can pin team messages." }); return; }
  await ensureWorkspaceTables();
  const id = Number(req.params.id);
  const pinned = req.body?.pinned === true;
  const updated = rowsOf(await db.execute(sql`UPDATE collaboration_items SET pinned=${pinned} WHERE id=${id} AND kind='chat' RETURNING id, pinned`))[0];
  if (!updated) { res.status(404).json({ error: "Message not found." }); return; }
  res.json(updated);
});

router.post("/chat/read", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const channel = String(req.body?.channel ?? "general");
  await db.execute(sql`INSERT INTO team_chat_reads (staff_email, channel_id, last_read_at)
    VALUES (${access.email}, ${channel}, now())
    ON CONFLICT (staff_email, channel_id) DO UPDATE SET last_read_at=now()`);
  res.json({ success: true });
});

router.get("/chat/search", requireAuth, async (req, res): Promise<void> => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return; }
  await ensureWorkspaceTables();
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  if (q.length < 2) { res.json([]); return; }
  const needle = "%" + q + "%";
  const result = await db.execute(sql`SELECT id, author_name AS "authorName", body, created_at AS "createdAt", title AS "channelId", pinned, metadata
    FROM collaboration_items WHERE kind='chat' AND body ILIKE ${needle} ORDER BY created_at DESC LIMIT 50`);
  res.json(rowsOf(result));
});

export default router;
