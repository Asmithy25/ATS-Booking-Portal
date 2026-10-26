import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, isCorporateExecutiveAccess, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();
const exec = (query: string) => db.execute(sql.raw(query));
type Row = Record<string, any>;
const rows = <T extends Row = Row>(result: any): T[] => Array.isArray(result) ? result : (result?.rows ?? []);
const text = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const q = (value: unknown) => value === null || value === undefined ? "NULL" : "'" + String(value).replace(/'/g, "''") + "'";
const qJson = (value: unknown) => q(JSON.stringify(value ?? {})) + "::jsonb";
const CORPORATE_TYPES = new Set(["release", "policy", "maintenance", "incident", "decision", "briefing", "milestone", "change_freeze", "emergency"]);
const STATUSES = new Set(["draft", "pending_review", "in_review", "approved", "rejected", "ready_to_deploy", "deployed", "blocked", "planned", "active", "resolved", "recorded", "cancelled"]);
const VERIFICATION_KEYS = ["build", "api", "database", "authentication", "authorization", "bookings", "notifications", "interface", "data_integrity", "deployment"];
const VERIFICATION_LABELS: Record<string, string> = {
  build: "Frontend and API build",
  api: "API endpoints",
  database: "Database and migrations",
  authentication: "Authentication",
  authorization: "Role and permission enforcement",
  bookings: "Booking and appointment regression",
  notifications: "Email and SMS notifications",
  interface: "Interface and responsive checks",
  data_integrity: "Data integrity and recovery",
  deployment: "Deployment verification",
};
let schemaReady: Promise<void> | null = null;

async function ensureCorporateStorage() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ash_corporate_records (
        id bigserial PRIMARY KEY,
        record_type text NOT NULL,
        title text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        priority text NOT NULL DEFAULT 'normal',
        summary text NOT NULL DEFAULT '',
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
        required_approvals integer NOT NULL DEFAULT 1,
        requested_by text NOT NULL,
        requested_email text NOT NULL,
        requested_role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`));
      await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS idx_ash_corporate_records_type_status ON ash_corporate_records(record_type,status,created_at DESC)"));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ash_corporate_config (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_by text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now()
      )`));
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function accessFor(req: Request, res: Response, corporateOnly = false) {
  const access = await getStaffAccess(req);
  if (!access) {
    res.status(401).json({ error: "Staff sign-in required." });
    return null;
  }
  if (corporateOnly && !isCorporateExecutiveAccess(access)) {
    res.status(403).json({ error: "ASH corporate access is restricted to the Founder and Ayden Smith Holdings Executive." });
    return null;
  }
  return access;
}

function normalizeRecord(row: any) {
  const record = {
    id: Number(row.id),
    recordType: row.recordType ?? row.record_type,
    title: row.title,
    status: row.status,
    priority: row.priority,
    summary: row.summary ?? "",
    details: row.details && typeof row.details === "object" ? row.details : {},
    approvals: Array.isArray(row.approvals) ? row.approvals : [],
    requiredApprovals: Number(row.requiredApprovals ?? row.required_approvals ?? 1),
    requestedBy: row.requestedBy ?? row.requested_by,
    requestedEmail: row.requestedEmail ?? row.requested_email,
    requestedRole: row.requestedRole ?? row.requested_role,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
  return record;
}

async function listRecords() {
  const result = await exec('SELECT id,record_type AS "recordType",title,status,priority,summary,details,approvals,required_approvals AS "requiredApprovals",requested_by AS "requestedBy",requested_email AS "requestedEmail",requested_role AS "requestedRole",created_at AS "createdAt",updated_at AS "updatedAt" FROM ash_corporate_records ORDER BY created_at DESC,id DESC LIMIT 250');
  return rows(result).map(normalizeRecord);
}

async function readConfig(key: string) {
  const result = await exec("SELECT value FROM ash_corporate_config WHERE key=" + q(key) + " LIMIT 1");
  return rows(result)[0]?.value ?? null;
}

async function writeConfig(key: string, value: unknown, actor: string) {
  await exec("INSERT INTO ash_corporate_config(key,value,updated_by,updated_at) VALUES (" + q(key) + "," + qJson(value) + "," + q(actor) + ",now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()");
}

const DEFAULT_BRANDING = {
  staffLoginLogoUrl: "/ash-aws-crossover.webp",
  founderDeckLogoUrl: "/ash-aws-crossover.webp",
  executiveDeckLogoUrl: "/ash-corporate.webp",
  publicAttributionEnabled: false,
  attributionText: "An Ayden Smith Holdings company",
  publicLogoUrl: "/ash-corporate.webp",
  logoUpdatedAt: null as string | null,
};

const DEFAULT_CORPORATE_CONFIG = {
  bookingsPaused: false,
  notificationsPaused: false,
  maintenanceMode: false,
  changeFreeze: false,
  freezeReason: "",
  freezeUntil: "",
  maintenanceMessage: "We’re carrying out scheduled maintenance. Please check back shortly.",
  updatedAt: null as string | null,
};

router.get("/branding/public", async (_req, res) => {
  try {
    await ensureCorporateStorage();
    const saved = await readConfig("branding");
    const value = { ...DEFAULT_BRANDING, ...(saved && typeof saved === "object" ? saved : {}) };
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      staffLoginLogoUrl: value.staffLoginLogoUrl,
      founderDeckLogoUrl: value.founderDeckLogoUrl,
      executiveDeckLogoUrl: value.executiveDeckLogoUrl,
      publicAttributionEnabled: value.publicAttributionEnabled === true,
      attributionText: text(value.attributionText, 140) || DEFAULT_BRANDING.attributionText,
      publicLogoUrl: value.publicLogoUrl || DEFAULT_BRANDING.publicLogoUrl,
    });
  } catch {
    res.json(DEFAULT_BRANDING);
  }
});

router.get("/branding", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  await ensureCorporateStorage();
  const saved = await readConfig("branding");
  res.json({ ...DEFAULT_BRANDING, ...(saved && typeof saved === "object" ? saved : {}) });
});

router.put("/branding", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  if (!isCorporateExecutiveAccess(access)) {
    res.status(403).json({ error: "Corporate access is required to change shared brand defaults." });
    return;
  }
  await ensureCorporateStorage();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const saved = await readConfig("branding");
  const prior = { ...DEFAULT_BRANDING, ...(saved && typeof saved === "object" ? saved : {}) };
  const validUrl = (value: unknown, fallback: string) => {
    const candidate = text(value, 2048);
    return candidate && (/^https:\/\//i.test(candidate) || /^\/[^/]/.test(candidate)) ? candidate : fallback;
  };
  const next = {
    staffLoginLogoUrl: validUrl(body.staffLoginLogoUrl, prior.staffLoginLogoUrl),
    founderDeckLogoUrl: validUrl(body.founderDeckLogoUrl, prior.founderDeckLogoUrl),
    executiveDeckLogoUrl: validUrl(body.executiveDeckLogoUrl, prior.executiveDeckLogoUrl),
    publicAttributionEnabled: body.publicAttributionEnabled === true,
    attributionText: text(body.attributionText, 140) || DEFAULT_BRANDING.attributionText,
    publicLogoUrl: validUrl(body.publicLogoUrl, prior.publicLogoUrl),
    logoUpdatedAt: new Date().toISOString(),
  };
  await writeConfig("branding", next, access.email);
  await recordAudit(req, "updated_corporate_branding", "ash_corporate_config", "branding");
  res.json(next);
});

router.get("/operations/public", async (_req, res) => {
  try {
    await ensureCorporateStorage();
    const saved = await readConfig("operations");
    const value = { ...DEFAULT_CORPORATE_CONFIG, ...(saved && typeof saved === "object" ? saved : {}) };
    res.set("Cache-Control", "public, max-age=30");
    res.json({ maintenanceMode: value.maintenanceMode === true, bookingsPaused: value.bookingsPaused === true, maintenanceMessage: text(value.maintenanceMessage, 500) || DEFAULT_CORPORATE_CONFIG.maintenanceMessage });
  } catch {
    res.json({ maintenanceMode: false, bookingsPaused: false, maintenanceMessage: DEFAULT_CORPORATE_CONFIG.maintenanceMessage });
  }
});

router.get("/config", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  await ensureCorporateStorage();
  const saved = await readConfig("operations");
  res.json({ ...DEFAULT_CORPORATE_CONFIG, ...(saved && typeof saved === "object" ? saved : {}) });
});

router.put("/config", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  if (!isCorporateExecutiveAccess(access)) {
    res.status(403).json({ error: "Corporate access is required to change emergency and freeze controls." });
    return;
  }
  await ensureCorporateStorage();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const saved = await readConfig("operations");
  const prior = { ...DEFAULT_CORPORATE_CONFIG, ...(saved && typeof saved === "object" ? saved : {}) };
  const next = {
    bookingsPaused: typeof body.bookingsPaused === "boolean" ? body.bookingsPaused : prior.bookingsPaused,
    notificationsPaused: typeof body.notificationsPaused === "boolean" ? body.notificationsPaused : prior.notificationsPaused,
    maintenanceMode: typeof body.maintenanceMode === "boolean" ? body.maintenanceMode : prior.maintenanceMode,
    changeFreeze: typeof body.changeFreeze === "boolean" ? body.changeFreeze : prior.changeFreeze,
    freezeReason: body.freezeReason === undefined ? prior.freezeReason : text(body.freezeReason, 300),
    freezeUntil: body.freezeUntil === undefined ? prior.freezeUntil : text(body.freezeUntil, 60),
    maintenanceMessage: body.maintenanceMessage === undefined ? prior.maintenanceMessage : text(body.maintenanceMessage, 500),
    updatedAt: new Date().toISOString(),
  };
  await writeConfig("operations", next, access.email);
  await recordAudit(req, "updated_corporate_operations_controls", "ash_corporate_config", "operations");
  res.json(next);
});

router.get("/summary", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  await ensureCorporateStorage();
  const records = await listRecords();
  const config = { ...DEFAULT_CORPORATE_CONFIG, ...((await readConfig("operations")) ?? {}) };
  const counts = {
    pendingApprovals: records.filter((item) => item.status === "pending_review" || item.status === "in_review").length,
    blockedReleases: records.filter((item) => item.recordType === "release" && item.status === "blocked").length,
    readyToDeploy: records.filter((item) => item.recordType === "release" && item.status === "ready_to_deploy").length,
    activeIncidents: records.filter((item) => item.recordType === "incident" && !["resolved", "cancelled"].includes(item.status)).length,
    plannedMaintenance: records.filter((item) => item.recordType === "maintenance" && !["resolved", "cancelled"].includes(item.status)).length,
    unresolvedChangeRequests: records.filter((item) => item.recordType === "change_request" && !["rejected", "cancelled", "deployed"].includes(item.status)).length,
  };
  res.json({ counts, config, recentRecords: records.slice(0, 8), checkedAt: new Date().toISOString(), environment: process.env.NODE_ENV === "production" ? "production" : "non-production" });
});

router.get("/records", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, false);
  if (!access) return;
  await ensureCorporateStorage();
  const records = await listRecords();
  res.json(isCorporateExecutiveAccess(access) ? records : records.filter((item) => item.recordType === "change_request" && item.requestedEmail === access.email));
});

router.post("/records", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, false);
  if (!access) return;
  await ensureCorporateStorage();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recordType = text(body.recordType, 40);
  const title = text(body.title, 160);
  const summary = text(body.summary, 2000);
  const priority = ["low", "normal", "high", "critical"].includes(String(body.priority)) ? String(body.priority) : "normal";
  const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
  if (!title) { res.status(400).json({ error: "A title is required." }); return; }
  if (recordType !== "change_request" && !CORPORATE_TYPES.has(recordType)) {
    res.status(400).json({ error: "Choose a supported corporate record type." }); return;
  }
  if (recordType !== "change_request" && !isCorporateExecutiveAccess(access)) {
    res.status(403).json({ error: "Staff can submit change requests; other corporate records require corporate access." }); return;
  }
  if (recordType === "change_request" && text(body.details && (body.details as any).type, 50) === "change_freeze" && !isCorporateExecutiveAccess(access)) {
    res.status(403).json({ error: "Only corporate approvers can initiate a release freeze." }); return;
  }
  const requiredApprovals = priority === "critical" || (details as any).requireTwoPersonApproval === true ? 2 : 1;
  const status = recordType === "change_request" ? "pending_review"
    : recordType === "incident" ? "active"
    : recordType === "maintenance" ? "planned"
    : recordType === "decision" ? "recorded" : "draft";
  const result = await exec("INSERT INTO ash_corporate_records(record_type,title,status,priority,summary,details,approvals,required_approvals,requested_by,requested_email,requested_role,created_at,updated_at) VALUES (" +
    [q(recordType), q(title), q(status), q(priority), q(summary), qJson(details), qJson([]), String(requiredApprovals), q(access.name), q(access.email), q(access.role), "now()", "now()"].join(",") +
    ') RETURNING id,record_type AS "recordType",title,status,priority,summary,details,approvals,required_approvals AS "requiredApprovals",requested_by AS "requestedBy",requested_email AS "requestedEmail",requested_role AS "requestedRole",created_at AS "createdAt",updated_at AS "updatedAt"');
  const record = normalizeRecord(rows(result)[0]);
  await recordAudit(req, "created_corporate_" + recordType, "ash_corporate_record", String(record.id));
  res.status(201).json(record);
});

router.post("/records/:id/action", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  await ensureCorporateStorage();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid record id." }); return; }
  const current = rows(await exec('SELECT id,record_type AS "recordType",title,status,priority,summary,details,approvals,required_approvals AS "requiredApprovals",requested_by AS "requestedBy",requested_email AS "requestedEmail",requested_role AS "requestedRole",created_at AS "createdAt",updated_at AS "updatedAt" FROM ash_corporate_records WHERE id=' + id + " LIMIT 1"))[0];
  if (!current) { res.status(404).json({ error: "Corporate record not found." }); return; }
  const record = normalizeRecord(current);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = text(body.action, 40);

  if (action === "approve" || action === "reject") {
    const operations = { ...DEFAULT_CORPORATE_CONFIG, ...((await readConfig("operations")) ?? {}) };
    if (operations.changeFreeze === true && action === "approve" && !["incident", "emergency"].includes(record.recordType)) {
      res.status(423).json({ error: "Corporate change freeze is active. Only approved emergency exceptions may proceed." }); return;
    }
    if (!["pending_review", "in_review", "draft"].includes(record.status)) {
      res.status(409).json({ error: "This record is no longer open for approval or rejection." }); return;
    }
    if (!["change_request", "release", "policy", "change_freeze", "emergency"].includes(record.recordType)) {
      res.status(400).json({ error: "This record type does not use the approval workflow." }); return;
    }
    if (action === "approve" && (record.priority === "high" || record.priority === "critical") && ["change_request", "release"].includes(record.recordType)) {
      const details = record.details && typeof record.details === "object" ? record.details as Record<string, unknown> : {};
      const hasImpact = text(details.impact, 2000).length > 0;
      const hasAffectedAreas = text(details.affectedAreas, 1200).length > 0;
      const hasSuccessCriteria = text(details.successCriteria, 1200).length > 0;
      const hasRollbackPlan = text(details.rollbackPlan, 1200).length > 0;
      if (!hasImpact || !hasAffectedAreas || !hasSuccessCriteria || (record.priority === "critical" && !hasRollbackPlan)) {
        res.status(409).json({
          error: record.priority === "critical"
            ? "Critical changes require impact, affected areas, success criteria and a rollback/recovery plan before approval."
            : "High-risk changes require impact, affected areas and success criteria before approval.",
          missing: [
            ...(!hasImpact ? ["impact"] : []),
            ...(!hasAffectedAreas ? ["affectedAreas"] : []),
            ...(!hasSuccessCriteria ? ["successCriteria"] : []),
            ...(record.priority === "critical" && !hasRollbackPlan ? ["rollbackPlan"] : []),
          ],
        });
        return;
      }
    }
    if (action === "approve" && record.requestedEmail === access.email && (record.priority === "critical" || record.requiredApprovals > 1)) {
      res.status(409).json({ error: "A requester cannot approve their own critical change." }); return;
    }
    const decisions = Array.isArray(record.approvals) ? record.approvals : [];
    if (decisions.some((item: any) => item?.email === access.email)) {
      res.status(409).json({ error: "You have already recorded a decision on this item." }); return;
    }
    const decision = { email: access.email, name: access.name, action, reason: text(body.reason, 800), at: new Date().toISOString() };
    const next = [...decisions, decision];
    const approvals = next.filter((item: any) => item.action === "approve").length;
    const rejected = action === "reject";
    const status = rejected ? "rejected" : approvals >= record.requiredApprovals ? "approved" : "in_review";
    await exec("UPDATE ash_corporate_records SET approvals=" + qJson(next) + ",status=" + q(status) + ",updated_at=now() WHERE id=" + id);
    await recordAudit(req, action + "_corporate_record", "ash_corporate_record", String(id));
  } else if (action === "verification") {
    if (record.recordType !== "release") { res.status(400).json({ error: "Verification checks are only supported on release records." }); return; }
    const key = text(body.key, 50);
    const status = text(body.status, 30);
    const evidence = text(body.evidence, 800);
    if (!VERIFICATION_KEYS.includes(key)) { res.status(400).json({ error: "Unknown verification check." }); return; }
    if (!["not_run", "pass", "fail", "manual_review", "blocked"].includes(status)) { res.status(400).json({ error: "Unknown verification status." }); return; }
    if (status === "pass" && evidence.length < 8) { res.status(400).json({ error: "A passing check must include evidence explaining what actually ran and passed." }); return; }
    const details = { ...(record.details ?? {}) };
    const checks = Array.isArray((details as any).verificationChecks) ? [...(details as any).verificationChecks] : [];
    const check = { key, label: VERIFICATION_LABELS[key], status, evidence, checkedBy: access.name, checkedEmail: access.email, checkedAt: new Date().toISOString() };
    const index = checks.findIndex((item: any) => item?.key === key);
    if (index >= 0) checks[index] = check; else checks.push(check);
    (details as any).verificationChecks = checks;
    const mandatory = VERIFICATION_KEYS.filter((item) => item !== "deployment");
    const checksComplete = mandatory.every((item) => {
      const value = checks.find((check: any) => check.key === item);
      return value?.status === "pass" && text(value.evidence, 800).length >= 8;
    });
    const approvalsRecorded = Array.isArray(record.approvals) && record.approvals.filter((item: any) => item?.action === "approve").length >= record.requiredApprovals;
    const hasRejection = Array.isArray(record.approvals) && record.approvals.some((item: any) => item?.action === "reject");
    const approved = !hasRejection && record.status !== "rejected" && (record.status === "approved" || record.status === "ready_to_deploy" || record.status === "deployed" || approvalsRecorded);
    const ready = checksComplete && approved;
    const hasFail = checks.some((item: any) => item.status === "fail" || item.status === "blocked");
    const statusNext = hasFail ? "blocked" : ready ? "ready_to_deploy" : "in_review";
    await exec("UPDATE ash_corporate_records SET details=" + qJson(details) + ",status=" + q(statusNext) + ",updated_at=now() WHERE id=" + id);
    await recordAudit(req, "updated_release_verification", "ash_corporate_record", String(id));
  } else if (action === "mark_deployed") {
    const operations = { ...DEFAULT_CORPORATE_CONFIG, ...((await readConfig("operations")) ?? {}) };
    if (operations.changeFreeze === true) { res.status(423).json({ error: "Deployment is blocked while a corporate change freeze is active." }); return; }
    if (record.recordType !== "release") { res.status(400).json({ error: "Only releases can be marked deployed." }); return; }
    if (record.status !== "ready_to_deploy") { res.status(409).json({ error: "Release verification must be ready before a deployment can be recorded." }); return; }
    const details = { ...(record.details ?? {}), deployment: { status: "deployed", version: text(body.version, 120), commit: text(body.commit, 120), deployedBy: access.email, deployedAt: new Date().toISOString(), evidence: text(body.evidence, 800) } };
    if (text(body.evidence, 800).length < 8) { res.status(400).json({ error: "Record what was actually deployed and how it was verified." }); return; }
    await exec("UPDATE ash_corporate_records SET details=" + qJson(details) + ",status='deployed',updated_at=now() WHERE id=" + id);
    await recordAudit(req, "recorded_corporate_release_deployment", "ash_corporate_record", String(id));
  } else if (action === "update") {
    const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : record.details;
    const summary = body.summary === undefined ? record.summary : text(body.summary, 2000);
    const title = body.title === undefined ? record.title : text(body.title, 160);
    if (!title) { res.status(400).json({ error: "Title cannot be blank." }); return; }
    const status = body.status === undefined ? record.status : text(body.status, 40);
    if (!STATUSES.has(status)) { res.status(400).json({ error: "Unsupported status." }); return; }
    if (body.status !== undefined) {
      const allowedStatus = record.recordType === "incident"
        ? ["active", "resolved", "cancelled"].includes(status)
        : record.recordType === "maintenance"
          ? ["planned", "active", "resolved", "cancelled"].includes(status)
          : ["decision", "briefing", "milestone"].includes(record.recordType)
            ? ["recorded", "cancelled"].includes(status)
            : status === record.status;
      if (!allowedStatus) {
        res.status(400).json({ error: "Use the dedicated approval or release workflow to change this record's status." }); return;
      }
    }
    if (record.recordType === "release" && status === "ready_to_deploy") {
      const checks = Array.isArray((details as any).verificationChecks) ? (details as any).verificationChecks : [];
      const mandatory = VERIFICATION_KEYS.filter((item) => item !== "deployment");
      const ready = mandatory.every((key) => checks.some((check: any) => check.key === key && check.status === "pass" && text(check.evidence, 800).length >= 8));
      if (!ready) { res.status(409).json({ error: "Release cannot be marked ready until all mandatory checks have recorded passing evidence." }); return; }
    }
    await exec("UPDATE ash_corporate_records SET title=" + q(title) + ",summary=" + q(summary) + ",details=" + qJson(details) + ",status=" + q(status) + ",updated_at=now() WHERE id=" + id);
    await recordAudit(req, "updated_corporate_record", "ash_corporate_record", String(id));
  } else {
    res.status(400).json({ error: "Choose a supported action." }); return;
  }
  const updated = rows(await exec('SELECT id,record_type AS "recordType",title,status,priority,summary,details,approvals,required_approvals AS "requiredApprovals",requested_by AS "requestedBy",requested_email AS "requestedEmail",requested_role AS "requestedRole",created_at AS "createdAt",updated_at AS "updatedAt" FROM ash_corporate_records WHERE id=' + id + " LIMIT 1"))[0];
  res.json(normalizeRecord(updated));
});

router.get("/verification-catalog", requireAuth, async (req, res) => {
  const access = await accessFor(req, res, true);
  if (!access) return;
  res.json(VERIFICATION_KEYS.map((key) => ({ key, label: VERIFICATION_LABELS[key], mandatory: key !== "deployment", evidenceRequired: true })));
});

export default router;
