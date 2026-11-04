import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, hasPermission, isCorporateExecutiveAccess, requireAuth, requireClientAuth, extractStaffSession, type RequestWithClientSession, type RequestWithSession } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

/** AWS 4.0: recruitment, staff accountability, and organization-wide workspaces.
 * All new tables are additive; existing appointments and accounts are untouched.
 */
const router = Router();
const exec = (query: string) => db.execute(sql.raw(query));
const rows = (result: any): any[] => Array.isArray(result) ? result : (result?.rows || []);
const txt = (value: unknown, max = 1200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const q = (value: unknown): string => value === null || value === undefined ? "NULL" : "'" + String(value).replace(/'/g, "''") + "'";
const integer = (value: unknown) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const statuses = new Set(["submitted", "under_review", "approved", "denied"]);
const workStatuses = new Set(["open", "in_progress", "pending_review", "approved", "done", "closed"]);
const corporateModules = new Set(["decisions", "departments", "policies", "delegations", "performance", "change_control", "broadcasts", "recruitment"]);
const staffModules = new Set(["my_workday", "knowledge", "shift_exchange", "help_desk", "training", "tasks", "profiles", "availability", "recognition", "discussions", "incidents"]);
const allModules = new Set([...corporateModules, ...staffModules]);
const managementModules = new Set(["knowledge","training","recognition"]);
const sharedModules = new Set(["knowledge","discussions"]);
let initializing: Promise<void> | null = null;

export async function ensureV4Tables() {
  if (!initializing) initializing = (async () => {
    await exec("CREATE TABLE IF NOT EXISTS aws4_career_openings (id bigserial PRIMARY KEY, title text NOT NULL, department text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', requirements text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())");
    await exec("CREATE TABLE IF NOT EXISTS aws4_career_applications (id bigserial PRIMARY KEY, application_reference text UNIQUE, opening_id bigint NOT NULL REFERENCES aws4_career_openings(id), role_title text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, phone text NOT NULL, email text NOT NULL, status text NOT NULL DEFAULT 'submitted', internal_notes text NOT NULL DEFAULT '', decision_by text, decision_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())");
    await exec("ALTER TABLE aws4_career_applications ADD COLUMN IF NOT EXISTS application_reference text UNIQUE");
    await exec("CREATE INDEX IF NOT EXISTS idx_aws4_applications_created ON aws4_career_applications(created_at DESC)");
    await exec("CREATE TABLE IF NOT EXISTS aws4_pending_manual_logs (id bigserial PRIMARY KEY, actor_email text NOT NULL, actor_name text NOT NULL, method text NOT NULL, endpoint text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), resolved_log_id bigint)");
    await exec("CREATE INDEX IF NOT EXISTS idx_aws4_pending_actor ON aws4_pending_manual_logs(actor_email, resolved_log_id, occurred_at DESC)");
    await exec("CREATE TABLE IF NOT EXISTS aws4_staff_manual_logs (id bigserial PRIMARY KEY, actor_email text NOT NULL, actor_name text NOT NULL, category text NOT NULL, action_taken text NOT NULL, summary text NOT NULL DEFAULT '', reference text NOT NULL DEFAULT '', pending_action_id bigint UNIQUE, created_at timestamptz NOT NULL DEFAULT now())");
    await exec("CREATE INDEX IF NOT EXISTS idx_aws4_manual_logs_created ON aws4_staff_manual_logs(created_at DESC)");
    await exec("CREATE TABLE IF NOT EXISTS aws4_workspace_records (id bigserial PRIMARY KEY, module text NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open', assignee text NOT NULL DEFAULT '', created_by text NOT NULL, created_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())");
    await exec("CREATE INDEX IF NOT EXISTS idx_aws4_workspace_module ON aws4_workspace_records(module, created_at DESC)");
    await exec("CREATE TABLE IF NOT EXISTS aws4_client_preferences (client_id bigint PRIMARY KEY REFERENCES client_accounts(id) ON DELETE CASCADE, preferences jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())");
  })().catch(err => { initializing = null; throw err; });
  await initializing;
}

const error = (res: Response, status: number, message: string) => res.status(status).json({ error: message });
const readActor = async (req: Request, res: Response, onlyCorporate = false) => {
  const actor = await getStaffAccess(req);
  if (!actor) { error(res, 401, "Staff sign-in required."); return null; }
  if (onlyCorporate && !isCorporateExecutiveAccess(actor)) { error(res, 403, "Founder or ASH Corporate access required."); return null; }
  return actor;
};
const idFrom = (req: Request, res: Response) => {
  const id = integer(req.params.id);
  if (!id) error(res, 400, "Invalid identifier.");
  return id;
};
const safe = (handler: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
  try { await handler(req, res); } catch (err) { req.log.error({ err }, "AWS 4.0 request failed"); if (!res.headersSent) error(res, 500, "This request could not be completed."); }
};

// Careers: browsing is public; writing openings or viewing identifiable applicants is NOT.
router.get("/careers/openings", safe(async (_req, res) => {
  await ensureV4Tables();
  const items = rows(await exec('SELECT id,title,department,description,requirements,created_at AS "createdAt" FROM aws4_career_openings WHERE active=true ORDER BY created_at DESC LIMIT 100'));
  res.json(items);
}));
const submissionTimes = new Map<string, number>();
router.post("/careers/apply", safe(async (req, res) => {
  if (txt(req.body?.website, 100)) { res.status(202).json({ message: "Application received." }); return; } // honeypot
  const first = txt(req.body?.firstName, 80), last = txt(req.body?.lastName, 80);
  const phone = txt(req.body?.phone, 45), email = txt(req.body?.email, 200).toLowerCase();
  const openingId = integer(req.body?.openingId);
  const consent = req.body?.consent === true;
  if (!first || !last || !openingId || !consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 7) { error(res, 400, "Complete all fields, choose an open role, and acknowledge the privacy notice."); return; }
  const key = email + ":" + openingId;
  const lastSubmission = submissionTimes.get(key);
  if (lastSubmission && Date.now() - lastSubmission < 60000) { error(res, 429, "Please wait before submitting another application."); return; }
  await ensureV4Tables();
  const opening = rows(await exec("SELECT id,title FROM aws4_career_openings WHERE id=" + openingId + " AND active=true LIMIT 1"))[0];
  if (!opening) { error(res, 404, "That position is not currently accepting applications."); return; }
  const applicationReference = "AWS-" + randomBytes(6).toString("hex").toUpperCase();
  const inserted = rows(await exec("INSERT INTO aws4_career_applications(application_reference,opening_id,role_title,first_name,last_name,phone,email) VALUES (" + q(applicationReference) + "," + openingId + "," + q(opening.title) + "," + q(first) + "," + q(last) + "," + q(phone) + "," + q(email) + ") RETURNING id"))[0];
  submissionTimes.set(key, Date.now());
  if (submissionTimes.size > 3000) submissionTimes.clear();
  res.status(201).json({ reference: applicationReference, status: "submitted", message: "Application received. Keep your reference number." });
}));
// Applicant status lookup requires both unpredictable reference and original email.
// Never return internal notes, decision maker, or personal contact fields.
const statusRequests = new Map<string,{count:number;window:number}>();
router.post("/careers/status", safe(async (req, res) => {
  const ref = txt(req.body?.reference, 70).toUpperCase(), email = txt(req.body?.email, 200).toLowerCase();
  const key = String(req.ip||"anonymous");
  const now=Date.now(), seen=statusRequests.get(key);
  const next=seen&&now-seen.window<60000?{count:seen.count+1,window:seen.window}:{count:1,window:now};
  statusRequests.set(key,next);
  if(statusRequests.size>6000) statusRequests.clear();
  if(next.count>12){ error(res,429,"Too many status checks. Please try again later."); return; }
  if(!/^AWS-[0-9A-F]{12}$/.test(ref)||!email||email.length>200){ error(res,400,"Enter your application reference and the original email address."); return; }
  await ensureV4Tables();
  const match=rows(await exec("SELECT application_reference,role_title,status,created_at FROM aws4_career_applications WHERE application_reference="+q(ref)+" AND email="+q(email)+" LIMIT 1"))[0];
  if(!match){error(res,404,"No application matched those details.");return;}
  res.setHeader("Cache-Control","private, no-store");
  res.json({reference:match.application_reference,roleTitle:match.role_title,status:match.status,submittedAt:match.created_at});
}));
router.get("/careers/admin/openings", requireAuth, safe(async (req, res) => {
  if (!await readActor(req, res, true)) return;
  await ensureV4Tables();
  res.json(rows(await exec('SELECT id,title,department,description,requirements,active,created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws4_career_openings ORDER BY created_at DESC')));
}));
router.post("/careers/admin/openings", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res, true); if (!actor) return;
  const title = txt(req.body?.title, 140), department = txt(req.body?.department, 100);
  const description = txt(req.body?.description, 4500), requirements = txt(req.body?.requirements, 3000);
  if (!title || !description) { error(res, 400, "Role title and description are required."); return; }
  await ensureV4Tables();
  const item = rows(await exec("INSERT INTO aws4_career_openings(title,department,description,requirements,active,created_by) VALUES (" + q(title) + "," + q(department) + "," + q(description) + "," + q(requirements) + ",true," + q(actor.email) + ") RETURNING id,title,department,description,requirements,active"))[0];
  await recordAudit(req, "created_career_opening", "aws4_career_openings", String(item.id));
  res.status(201).json(item);
}));
router.patch("/careers/admin/openings/:id", requireAuth, safe(async (req, res) => {
  if (!await readActor(req, res, true)) return;
  const id = idFrom(req, res); if (!id) return;
  await ensureV4Tables();
  const previous = rows(await exec("SELECT * FROM aws4_career_openings WHERE id=" + id + " LIMIT 1"))[0];
  if (!previous) { error(res, 404, "Job opening not found."); return; }
  const title = req.body?.title === undefined ? previous.title : txt(req.body.title, 140);
  const department = req.body?.department === undefined ? previous.department : txt(req.body.department, 100);
  const description = req.body?.description === undefined ? previous.description : txt(req.body.description, 4500);
  const requirements = req.body?.requirements === undefined ? previous.requirements : txt(req.body.requirements, 3000);
  const active = typeof req.body?.active === "boolean" ? req.body.active : previous.active;
  if (!title || !description) { error(res, 400, "Role title and description are required."); return; }
  const items = rows(await exec("UPDATE aws4_career_openings SET title=" + q(title) + ",department=" + q(department) + ",description=" + q(description) + ",requirements=" + q(requirements) + ",active=" + (active ? "true" : "false") + ",updated_at=now() WHERE id=" + id + " RETURNING id,title,department,description,requirements,active"));
  await recordAudit(req, "updated_career_opening", "aws4_career_openings", String(id));
  res.json(items[0]);
}));
router.get("/careers/admin/applications", requireAuth, safe(async (req, res) => {
  if (!await readActor(req, res, true)) return;
  await ensureV4Tables();
  res.setHeader("Cache-Control", "private, no-store");
  res.json(rows(await exec('SELECT id,application_reference AS "reference",opening_id AS "openingId",role_title AS "roleTitle",first_name AS "firstName",last_name AS "lastName",phone,email,status,internal_notes AS "internalNotes",decision_by AS "decisionBy",decision_at AS "decisionAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws4_career_applications ORDER BY created_at DESC LIMIT 500')));
}));
router.patch("/careers/admin/applications/:id", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res, true); if (!actor) return;
  const id = idFrom(req, res); if (!id) return;
  await ensureV4Tables();
  const previous = rows(await exec("SELECT * FROM aws4_career_applications WHERE id=" + id + " LIMIT 1"))[0];
  if (!previous) { error(res, 404, "Application not found."); return; }
  const status = req.body?.status === undefined ? previous.status : txt(req.body.status, 40);
  const notes = req.body?.internalNotes === undefined ? previous.internal_notes : txt(req.body.internalNotes, 3500);
  const first = req.body?.firstName === undefined ? previous.first_name : txt(req.body.firstName, 80);
  const last = req.body?.lastName === undefined ? previous.last_name : txt(req.body.lastName, 80);
  const phone = req.body?.phone === undefined ? previous.phone : txt(req.body.phone, 45);
  const email = req.body?.email === undefined ? previous.email : txt(req.body.email, 200).toLowerCase();
  if (!statuses.has(status) || !first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 7) { error(res, 400, "The application must contain a valid status, name, phone and email."); return; }
  const changedDecision = status !== previous.status && (status === "approved" || status === "denied");
  const decisionBy = changedDecision ? q(actor.email) : (status === "approved" || status === "denied") ? q(previous.decision_by) : "NULL";
  const decisionAt = changedDecision ? "now()" : (status === "approved" || status === "denied") && previous.decision_at ? q(previous.decision_at) + "::timestamptz" : "NULL";
  const data = rows(await exec("UPDATE aws4_career_applications SET first_name=" + q(first) + ",last_name=" + q(last) + ",phone=" + q(phone) + ",email=" + q(email) + ",status=" + q(status) + ",internal_notes=" + q(notes) + ",decision_by=" + decisionBy + ",decision_at=" + decisionAt + ",updated_at=now() WHERE id=" + id + ' RETURNING id,status,internal_notes AS "internalNotes"'))[0];
  await recordAudit(req, "reviewed_career_application", "aws4_career_applications", String(id), "status=" + status);
  res.json(data);
}));

// Manual entries are immutable. Reviewers can see the history, never rewrite it.
router.get("/staff-logs", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res); if (!actor) return;
  await ensureV4Tables();
  const canReview = isCorporateExecutiveAccess(actor) || hasPermission(actor, "viewAuditLogs");
  const where = canReview ? "" : " WHERE actor_email=" + q(actor.email);
  res.setHeader("Cache-Control", "private, no-store");
  res.json(rows(await exec('SELECT id,actor_email AS "actorEmail",actor_name AS "actorName",category,action_taken AS "actionTaken",summary,reference,pending_action_id AS "pendingActionId",created_at AS "createdAt" FROM aws4_staff_manual_logs' + where + " ORDER BY created_at DESC LIMIT 500")));
}));
router.get("/staff-logs/pending", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res); if (!actor) return;
  await ensureV4Tables();
  res.setHeader("Cache-Control", "private, no-store");
  res.json(rows(await exec('SELECT id,method,endpoint,occurred_at AS "occurredAt" FROM aws4_pending_manual_logs WHERE actor_email=' + q(actor.email) + " AND resolved_log_id IS NULL ORDER BY occurred_at ASC LIMIT 100")));
}));
router.post("/staff-logs", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res); if (!actor) return;
  const category = txt(req.body?.category, 80), action = txt(req.body?.actionTaken, 180);
  const summary = txt(req.body?.summary, 1000), reference = txt(req.body?.reference, 100);
  const pendingId = req.body?.pendingActionId === undefined || req.body?.pendingActionId === null ? null : integer(req.body.pendingActionId);
  if (!category || !action || !summary || (req.body?.pendingActionId != null && !pendingId)) { error(res, 400, "Category, action and summary are required."); return; }
  await ensureV4Tables();
  if (pendingId) {
    const found = rows(await exec("SELECT id FROM aws4_pending_manual_logs WHERE id=" + pendingId + " AND actor_email=" + q(actor.email) + " AND resolved_log_id IS NULL LIMIT 1"))[0];
    if (!found) { error(res, 409, "That action is already logged or does not belong to your account."); return; }
  }
  const created = rows(await exec("INSERT INTO aws4_staff_manual_logs(actor_email,actor_name,category,action_taken,summary,reference,pending_action_id) VALUES (" + q(actor.email) + "," + q(actor.name) + "," + q(category) + "," + q(action) + "," + q(summary) + "," + q(reference) + "," + (pendingId || "NULL") + ') RETURNING id,created_at AS "createdAt"'))[0];
  if (pendingId) await exec("UPDATE aws4_pending_manual_logs SET resolved_log_id=" + created.id + " WHERE id=" + pendingId + " AND actor_email=" + q(actor.email) + " AND resolved_log_id IS NULL");
  await recordAudit(req, "submitted_manual_staff_log", "aws4_staff_manual_logs", String(created.id), "category=" + category);
  res.status(201).json(created);
}));

// Flexible operational record collections support staff workspaces and executive records.
router.get("/workspaces/:module", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res); if (!actor) return;
  const module = txt(req.params.module, 60);
  if (!allModules.has(module)) { error(res, 404, "Workspace not found."); return; }
  if (corporateModules.has(module) && !isCorporateExecutiveAccess(actor)) { error(res, 403, "Corporate access required."); return; }
  await ensureV4Tables();
  const scope = corporateModules.has(module) || sharedModules.has(module) || isCorporateExecutiveAccess(actor) || hasPermission(actor, "manageTasks") ? "" : " AND (created_email=" + q(actor.email) + " OR assignee=" + q(actor.email) + ")";
  res.json(rows(await exec('SELECT id,module,title,body,status,assignee,created_by AS "createdBy",created_email AS "createdEmail",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws4_workspace_records WHERE module=' + q(module) + scope + " ORDER BY created_at DESC LIMIT 300")));
}));
router.post("/workspaces/:module", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res); if (!actor) return;
  const module = txt(req.params.module, 60);
  if (!allModules.has(module)) { error(res, 404, "Workspace not found."); return; }
  if (corporateModules.has(module) && !isCorporateExecutiveAccess(actor)) { error(res, 403, "Corporate access required."); return; }
  const title = txt(req.body?.title, 180), body = txt(req.body?.body, 5000), assignee = txt(req.body?.assignee, 180).toLowerCase();
  const canManage = isCorporateExecutiveAccess(actor) || hasPermission(actor, "manageTasks");
  if(managementModules.has(module)&&!canManage){ error(res,403,"Manager authorization is required to publish these records."); return; }
  if(assignee && assignee!==actor.email && !canManage){ error(res,403,"Only an authorized manager may assign another staff member."); return; }
  if (!title) { error(res, 400, "A title is required."); return; }
  await ensureV4Tables();
  const item = rows(await exec("INSERT INTO aws4_workspace_records(module,title,body,assignee,created_by,created_email) VALUES (" + q(module) + "," + q(title) + "," + q(body) + "," + q(assignee) + "," + q(actor.name) + "," + q(actor.email) + ') RETURNING id,module,title,body,status,assignee'))[0];
  await recordAudit(req, "created_v4_workspace_record", "aws4_workspace_records", String(item.id), module);
  res.status(201).json(item);
}));
router.patch("/workspaces/:module/:id", requireAuth, safe(async (req, res) => {
  const actor = await readActor(req, res); if (!actor) return;
  const module = txt(req.params.module, 60), id = idFrom(req, res);
  if (!id || !allModules.has(module)) { if (id) error(res, 404, "Workspace not found."); return; }
  if (corporateModules.has(module) && !isCorporateExecutiveAccess(actor)) { error(res, 403, "Corporate access required."); return; }
  await ensureV4Tables();
  const previous = rows(await exec("SELECT * FROM aws4_workspace_records WHERE module=" + q(module) + " AND id=" + id + " LIMIT 1"))[0];
  if (!previous) { error(res, 404, "Record not found."); return; }
  const canManage = isCorporateExecutiveAccess(actor) || hasPermission(actor, "manageTasks");
  if(managementModules.has(module)&&!canManage){error(res,403,"Manager authorization required.");return;}
  if (!canManage && previous.created_email !== actor.email && previous.assignee !== actor.email) { error(res, 403, "Only the creator, assignee or an authorized manager can update this record."); return; }
  if(!canManage && previous.created_email !== actor.email && (req.body?.title!==undefined||req.body?.body!==undefined||req.body?.assignee!==undefined)){error(res,403,"Assigned staff may update status only.");return;}
  const title = req.body?.title === undefined ? previous.title : txt(req.body.title, 180);
  const body = req.body?.body === undefined ? previous.body : txt(req.body.body, 5000);
  const assignee = req.body?.assignee === undefined ? previous.assignee : txt(req.body.assignee, 180);
  const status = req.body?.status === undefined ? previous.status : txt(req.body.status, 40);
  if (!title || !workStatuses.has(status)) { error(res, 400, "Invalid title or status."); return; }
  const item = rows(await exec("UPDATE aws4_workspace_records SET title=" + q(title) + ",body=" + q(body) + ",assignee=" + q(assignee) + ",status=" + q(status) + ",updated_at=now() WHERE id=" + id + ' RETURNING id,module,title,body,status,assignee'))[0];
  await recordAudit(req, "updated_v4_workspace_record", "aws4_workspace_records", String(id), module + ":" + status);
  res.json(item);
}));

// Private client experience: non-clinical appointment preferences and accessibility.
// Never use a caller-provided client ID; identity comes from the signed session.
const defaultClientPreferences = {
  preferredStaff: "", preferredTimeWindow: "any", remindersEnabled: true,
  onboardingCompleted: false, largeText: false, reducedMotion: false,
  highContrast: false, simplifiedNavigation: false,
};
router.get("/client/preferences", requireClientAuth, safe(async (req, res) => {
  const clientId = integer((req as RequestWithClientSession).clientSession?.id);
  if (!clientId) { error(res, 401, "Client authentication required."); return; }
  await ensureV4Tables();
  const previous = rows(await exec("SELECT preferences FROM aws4_client_preferences WHERE client_id=" + clientId + " LIMIT 1"))[0]?.preferences || {};
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ...defaultClientPreferences, ...previous });
}));
router.put("/client/preferences", requireClientAuth, safe(async (req, res) => {
  const clientId = integer((req as RequestWithClientSession).clientSession?.id);
  if (!clientId) { error(res, 401, "Client authentication required."); return; }
  const body = req.body || {};
  const time = txt(body.preferredTimeWindow, 25);
  if (!["any", "morning", "afternoon", "evening"].includes(time)) { error(res, 400, "Choose a valid preferred appointment window."); return; }
  const preferences = {
    preferredStaff: txt(body.preferredStaff, 100), preferredTimeWindow: time,
    remindersEnabled: body.remindersEnabled === true, onboardingCompleted: body.onboardingCompleted === true,
    largeText: body.largeText === true, reducedMotion: body.reducedMotion === true,
    highContrast: body.highContrast === true, simplifiedNavigation: body.simplifiedNavigation === true,
  };
  await ensureV4Tables();
  await exec("INSERT INTO aws4_client_preferences(client_id,preferences) VALUES (" + clientId + "," + q(JSON.stringify(preferences)) + "::jsonb) ON CONFLICT(client_id) DO UPDATE SET preferences=EXCLUDED.preferences,updated_at=now()");
  res.json(preferences);
}));

/** Successful staff mutations create a required manual follow-up; the audit
 * trail remains independent. Browser shows unresolved entries prominently.
 * Does not inspect/store request bodies or client health information.
 */
/** Enforce the pending log requirement on the server, not just in the UI.
 * Read-only requests, sign-in/out, client calls and log submissions remain usable.
 */
export async function enforceStaffManualLogging(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!["POST","PUT","PATCH","DELETE"].includes(req.method) ||
    req.path.startsWith("/api/auth/") || req.path.startsWith("/api/v4/staff-logs") ||
    req.path.startsWith("/api/portal/") || req.path.startsWith("/api/v4/client/") ||
    req.path.startsWith("/api/v4/careers/apply")) { next(); return; }
  const actor = extractStaffSession(req);
  if (!actor) { next(); return; }
  try {
    await ensureV4Tables();
    const pending = rows(await exec("SELECT id FROM aws4_pending_manual_logs WHERE actor_email=" + q(actor.email) + " AND resolved_log_id IS NULL LIMIT 1"));
    if (pending.length) {
      res.status(409).json({ error: "A Staff Logging entry is required before another change. Open Staff Logging, document the pending action, then try again.", code: "AWS4_MANUAL_LOG_REQUIRED", pendingId: Number(pending[0].id) });
      return;
    }
    next();
  } catch(err) {
    req.log.error({ err }, "Staff logging enforcement unavailable");
    res.status(503).json({ error: "Staff logging is temporarily unavailable. Changes are paused to preserve accountability." });
  }
}

export function trackStaffMutations(req: Request, res: Response, next: NextFunction): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || req.path.startsWith("/api/v4/staff-logs") || req.path.startsWith("/api/auth/") || req.path.startsWith("/api/portal/") || req.path.startsWith("/api/v4/careers/apply")) { next(); return; }
  res.once("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const actor = (req as RequestWithSession).staffSession;
    if (!actor) return;
    const routePath = typeof req.route?.path === "string" ? req.route.path : "/staff-action";
    const sanitizedPath = ((req.baseUrl || "/api") + (routePath.startsWith("/") ? routePath : "/" + routePath)).slice(0, 170);
    void ensureV4Tables().then(async () => {
      await exec("INSERT INTO aws4_pending_manual_logs(actor_email,actor_name,method,endpoint) VALUES (" + q(actor.email) + "," + q(actor.name) + "," + q(req.method) + "," + q(sanitizedPath) + ")");
      await exec("INSERT INTO audit_logs(actor_email,actor_name,action,entity_type,details) VALUES (" + q(actor.email) + "," + q(actor.name) + ",'aws4_staff_mutation'," + q(sanitizedPath) + "," + q(req.method) + ")");
    }).catch(err => req.log.error({ err }, "AWS 4.0 mutation logging failed"));
  });
  next();
}

export default router;
