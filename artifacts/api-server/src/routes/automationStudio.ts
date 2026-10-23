import { Router, type Request, type Response } from "express";
import { db, bookingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ADMIN_EMAIL, getStaffAccess, requireAuth } from "../middleware/auth";
import { ensureAdvancedStorage } from "../lib/advanced-storage";
import { prepareNotificationStorage } from "../lib/notification-service";

const router = Router();
const TRIGGERS = new Set(["booking_created", "booking_cancelled", "booking_rescheduled", "booking_completed", "booking_no_show"]);
const ACTIONS = new Set(["notify_founder", "notify_client", "create_staff_task"]);
const rows = (value: any): any[] => Array.isArray(value) ? value : (value?.rows ?? []);
const clean = (value: unknown, limit = 1000) => String(value ?? "").trim().slice(0, limit);

async function founderAccess(req: Request, res: Response) {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Sign in to manage automations." }); return null; }
  if (access.role !== "founder") { res.status(403).json({ error: "Aurora Automation Studio is founder-only while its rules are being introduced." }); return null; }
  return access;
}

async function ensureAutomationStorage() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS aws_automation_rules (
    id serial PRIMARY KEY,
    name text NOT NULL,
    trigger_key text NOT NULL,
    action_key text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT false,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS aws_automation_runs (
    id serial PRIMARY KEY,
    rule_id integer NOT NULL,
    booking_id integer,
    trigger_key text NOT NULL,
    event_signature text NOT NULL UNIQUE,
    outcome text NOT NULL,
    detail text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_aws_automation_runs_recent ON aws_automation_runs(created_at DESC)`);
}

function shapeRule(row: any) {
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    triggerKey: String(row.triggerKey ?? row.trigger_key ?? ""),
    actionKey: String(row.actionKey ?? row.action_key ?? ""),
    config: row.config && typeof row.config === "object" ? row.config : {},
    enabled: Boolean(row.enabled),
    createdBy: String(row.createdBy ?? row.created_by ?? ""),
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

function fillTemplate(value: unknown, booking: typeof bookingsTable.$inferSelect) {
  return clean(value, 2000)
    .replaceAll("{{clientName}}", booking.clientName || "Client")
    .replaceAll("{{date}}", booking.preferredDate || "")
    .replaceAll("{{time}}", booking.preferredTime || "")
    .replaceAll("{{confirmationCode}}", booking.confirmationCode || "");
}

router.get("/rules", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  try {
    await ensureAutomationStorage();
    const result = await db.execute(sql`SELECT id,name,trigger_key AS "triggerKey",action_key AS "actionKey",config,enabled,created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws_automation_rules ORDER BY created_at DESC`);
    res.json(rows(result).map(shapeRule));
  } catch (error) {
    req.log.error({ err: error }, "Could not list automation rules");
    res.status(500).json({ error: "Automation rules could not be loaded." });
  }
});

router.post("/rules", requireAuth, async (req, res) => {
  const access = await founderAccess(req, res);
  if (!access) return;
  const name = clean(req.body?.name, 100);
  const triggerKey = clean(req.body?.triggerKey, 60);
  const actionKey = clean(req.body?.actionKey, 60);
  const config = req.body?.config && typeof req.body.config === "object" && !Array.isArray(req.body.config) ? req.body.config : {};
  if (name.length < 3) { res.status(400).json({ error: "Give this automation a name of at least 3 characters." }); return; }
  if (!TRIGGERS.has(triggerKey)) { res.status(400).json({ error: "Choose a supported booking trigger." }); return; }
  if (!ACTIONS.has(actionKey)) { res.status(400).json({ error: "Choose a supported action." }); return; }
  if (actionKey === "create_staff_task" && clean(config.taskTitle, 160).length < 3) { res.status(400).json({ error: "A task title is required for the task action." }); return; }
  if (actionKey === "notify_client" && clean(config.message, 1000).length < 3) { res.status(400).json({ error: "Add the client portal message for this action." }); return; }
  try {
    await ensureAutomationStorage();
    const result = await db.execute(sql`INSERT INTO aws_automation_rules (name,trigger_key,action_key,config,enabled,created_by,created_at,updated_at)
      VALUES (${name},${triggerKey},${actionKey},${JSON.stringify(config)}::jsonb,${req.body?.enabled === true},${access.email},now(),now())
      RETURNING id,name,trigger_key AS "triggerKey",action_key AS "actionKey",config,enabled,created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt"`);
    res.status(201).json(shapeRule(rows(result)[0]));
  } catch (error) {
    req.log.error({ err: error }, "Could not create automation rule");
    res.status(500).json({ error: "The automation rule could not be saved." });
  }
});

router.patch("/rules/:id", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid automation ID." }); return; }
  try {
    await ensureAutomationStorage();
    const result = await db.execute(sql`SELECT id,name,trigger_key AS "triggerKey",action_key AS "actionKey",config,enabled,created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws_automation_rules WHERE id=${id} LIMIT 1`);
    const current = rows(result)[0];
    if (!current) { res.status(404).json({ error: "Automation not found." }); return; }
    const name = req.body?.name === undefined ? current.name : clean(req.body.name, 100);
    const triggerKey = req.body?.triggerKey === undefined ? current.triggerKey : clean(req.body.triggerKey, 60);
    const actionKey = req.body?.actionKey === undefined ? current.actionKey : clean(req.body.actionKey, 60);
    const config = req.body?.config === undefined ? current.config : req.body.config;
    const enabled = req.body?.enabled === undefined ? current.enabled : req.body.enabled === true;
    if (name.length < 3 || !TRIGGERS.has(triggerKey) || !ACTIONS.has(actionKey) || !config || typeof config !== "object" || Array.isArray(config)) {
      res.status(400).json({ error: "Check the automation name, trigger, action, and configuration." }); return;
    }
    if (actionKey === "create_staff_task" && clean(config.taskTitle, 160).length < 3) { res.status(400).json({ error: "A task title is required for the task action." }); return; }
    if (actionKey === "notify_client" && clean(config.message, 1000).length < 3) { res.status(400).json({ error: "Add the client portal message for this action." }); return; }
    const updated = await db.execute(sql`UPDATE aws_automation_rules SET name=${name},trigger_key=${triggerKey},action_key=${actionKey},config=${JSON.stringify(config)}::jsonb,enabled=${enabled},updated_at=now() WHERE id=${id} RETURNING id,name,trigger_key AS "triggerKey",action_key AS "actionKey",config,enabled,created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt"`);
    res.json(shapeRule(rows(updated)[0]));
  } catch (error) {
    req.log.error({ err: error }, "Could not update automation rule");
    res.status(500).json({ error: "The automation could not be updated." });
  }
});

router.delete("/rules/:id", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid automation ID." }); return; }
  try {
    await ensureAutomationStorage();
    await db.execute(sql`DELETE FROM aws_automation_rules WHERE id=${id}`);
    res.json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Could not delete automation rule");
    res.status(500).json({ error: "The automation could not be deleted." });
  }
});

router.get("/runs", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  try {
    await ensureAutomationStorage();
    const result = await db.execute(sql`SELECT r.id,r.rule_id AS "ruleId",a.name AS "ruleName",r.booking_id AS "bookingId",r.trigger_key AS "triggerKey",r.outcome,r.detail,r.created_at AS "createdAt" FROM aws_automation_runs r LEFT JOIN aws_automation_rules a ON a.id=r.rule_id ORDER BY r.created_at DESC LIMIT 100`);
    res.json(rows(result));
  } catch (error) {
    req.log.error({ err: error }, "Could not load automation history");
    res.status(500).json({ error: "Automation history could not be loaded." });
  }
});

router.post("/rules/:id/dry-run", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  const id = Number(req.params.id);
  try {
    await ensureAutomationStorage();
    const result = await db.execute(sql`SELECT id,name,trigger_key AS "triggerKey",action_key AS "actionKey",config,enabled FROM aws_automation_rules WHERE id=${id} LIMIT 1`);
    const rule = rows(result)[0];
    if (!rule) { res.status(404).json({ error: "Automation not found." }); return; }
    res.json({ dryRun: true, willExecute: Boolean(rule.enabled), ruleName: rule.name, triggerKey: rule.triggerKey, actionKey: rule.actionKey, summary: rule.enabled ? "This rule is enabled and will run the selected action when its matching booking event occurs." : "This rule is disabled. It will not run until you enable it.", writesData: false });
  } catch (error) {
    req.log.error({ err: error }, "Could not dry-run automation");
    res.status(500).json({ error: "The automation preview could not be generated." });
  }
});

export async function runBookingAutomations(triggerKey: string, booking: typeof bookingsTable.$inferSelect) {
  if (!TRIGGERS.has(triggerKey)) return;
  try {
    await ensureAutomationStorage();
    const rulesResult = await db.execute(sql`SELECT id,name,action_key AS "actionKey",config FROM aws_automation_rules WHERE trigger_key=${triggerKey} AND enabled=true ORDER BY id ASC`);
    for (const rule of rows(rulesResult)) {
      const signature = [rule.id, triggerKey, booking.id, booking.status, booking.preferredDate, booking.preferredTime].join(":");
      const claimed = await db.execute(sql`INSERT INTO aws_automation_runs (rule_id,booking_id,trigger_key,event_signature,outcome,detail) VALUES (${rule.id},${booking.id},${triggerKey},${signature},${"running"},${"Started"}) ON CONFLICT (event_signature) DO NOTHING RETURNING id`);
      if (rows(claimed).length === 0) continue;
      try {
        const config = rule.config && typeof rule.config === "object" ? rule.config : {};
        const body = fillTemplate(config.message || rule.name, booking);
        if (rule.actionKey === "notify_founder") {
          await prepareNotificationStorage();
          await db.execute(sql`INSERT INTO staff_notifications (staff_email,title,body,read,created_at) VALUES (${ADMIN_EMAIL},${clean(rule.name,120)},${body},false,now())`);
        } else if (rule.actionKey === "notify_client") {
          if (!booking.clientAccountId) throw new Error("This booking is not linked to a client portal account.");
          await db.execute(sql`INSERT INTO client_notifications (client_account_id,title,body,pushed_by,read,created_at) VALUES (${booking.clientAccountId},${clean(rule.name,120)},${body},"AWS Automation",false,now())`);
        } else if (rule.actionKey === "create_staff_task") {
          await ensureAdvancedStorage();
          await db.execute(sql`INSERT INTO staff_tasks (title,description,assigned_to,status,due_date,created_by,created_at,updated_at) VALUES (${clean(config.taskTitle,160)},${fillTemplate(config.taskDescription || body, booking)},${clean(config.assignedTo,160)},'open',${clean(config.dueDate,10) || null},'AWS Automation',now(),now())`);
        }
        await db.execute(sql`UPDATE aws_automation_runs SET outcome=${"success"},detail=${"Action completed: " + clean(rule.actionKey,60)} WHERE event_signature=${signature}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Automation action failed.";
        await db.execute(sql`UPDATE aws_automation_runs SET outcome="failed",detail=${clean(detail,500)} WHERE event_signature=${signature}`).catch(() => undefined);
      }
    }
  } catch (error) {
    // A failed automation must never make the underlying booking request fail.
    console.error("AWS booking automation pass failed", error);
  }
}

export default router;
