import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, requireAuth } from "../middleware/auth";
import { prepareNotificationStorage, retryBookingDelivery } from "../lib/notification-service";

const router = Router();
const rows = (value: any): any[] => Array.isArray(value) ? value : (value?.rows ?? []);

async function founderAccess(req: Request, res: any) {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Sign in to inspect notification operations." }); return false; }
  if (access.role !== "founder") { res.status(403).json({ error: "Notification Mission Control is founder-only." }); return false; }
  return true;
}

router.get("/deliveries", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  try {
    await prepareNotificationStorage();
    const result = await db.execute(sql`SELECT d.id,d.booking_id AS "bookingId",b.confirmation_code AS "confirmationCode",b.client_name AS "clientName",d.event_kind AS "eventKind",d.channel,d.recipient_masked AS "recipientMasked",d.status,d.detail,d.attempt_source AS "attemptSource",d.created_at AS "createdAt"
      FROM notification_delivery_attempts d LEFT JOIN bookings b ON b.id=d.booking_id
      ORDER BY d.created_at DESC LIMIT 150`);
    res.json(rows(result));
  } catch (error) {
    req.log.error({ err: error }, "Could not load notification delivery ledger");
    res.status(500).json({ error: "Notification delivery history could not be loaded." });
  }
});

router.post("/deliveries/:id/retry", requireAuth, async (req, res) => {
  if (!await founderAccess(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid delivery attempt ID." }); return; }
  try {
    await prepareNotificationStorage();
    const result = await db.execute(sql`SELECT id,booking_id AS "bookingId",event_kind AS "eventKind",channel,status FROM notification_delivery_attempts WHERE id=${id} LIMIT 1`);
    const attempt = rows(result)[0];
    if (!attempt) { res.status(404).json({ error: "Delivery attempt not found." }); return; }
    if (attempt.status !== "failed") { res.status(409).json({ error: "Only failed sends can be retried. Skipped messages need configuration or client consent first." }); return; }
    if (!attempt.bookingId || !["email","sms"].includes(String(attempt.channel))) { res.status(400).json({ error: "This delivery attempt cannot be retried." }); return; }
    const outcome = await retryBookingDelivery(Number(attempt.bookingId), String(attempt.eventKind), attempt.channel as "email" | "sms");
    res.json({ success: true, ...outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The channel retry failed.";
    res.status(502).json({ error: message });
  }
});

export default router;
