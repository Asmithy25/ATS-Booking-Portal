import { Router } from "express";
import { requireAdminAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { getDeliveryStatus, sendEmail, sendSms } from "../lib/delivery-providers";

const router = Router();
router.use(requireAdminAuth);

router.get("/delivery-settings/status", (_req, res) => {
  const status = getDeliveryStatus();
  res.json({
    email: { ...status.email, missing: status.email.missing },
    sms: { ...status.sms, missing: status.sms.missing },
    replyTo: process.env.AWS_EMAIL_REPLY_TO || "aydenswellnessservices@gmail.com",
  });
});

router.post("/delivery-settings/test-email", async (req, res): Promise<void> => {
  const to = String(req.body?.to ?? "").trim().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "Enter a valid test email address." });
    return;
  }
  if (!getDeliveryStatus().email.configured) {
    res.status(409).json({ error: "Email delivery is not configured yet. Add the required provider variables in Railway first." });
    return;
  }
  try {
    await sendEmail(to, "AWS email delivery test", "This is a test message from Aydens Wellness Services. If you received it, email delivery is connected.");
    await recordAudit(req, "tested_email_delivery", "delivery_settings", undefined, `Test email sent to ${to}`);
    res.json({ ok: true, message: "Test email accepted by the provider." });
  } catch (error) {
    req.log?.error?.({ error }, "Email delivery test failed");
    res.status(502).json({ error: error instanceof Error ? error.message : "Email delivery test failed." });
  }
});

router.post("/delivery-settings/test-sms", async (req, res): Promise<void> => {
  const to = String(req.body?.to ?? "").trim().slice(0, 40);
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    res.status(400).json({ error: "Enter a valid phone number in international format, for example +15612918556." });
    return;
  }
  if (!getDeliveryStatus().sms.configured) {
    res.status(409).json({ error: "SMS delivery is not configured yet. Add the required provider variables in Railway first." });
    return;
  }
  try {
    await sendSms(to, "Aydens Wellness Services: this is a test text confirming SMS delivery is connected.");
    await recordAudit(req, "tested_sms_delivery", "delivery_settings", undefined, `Test SMS sent to ${to}`);
    res.json({ ok: true, message: "Test SMS accepted by the provider." });
  } catch (error) {
    req.log?.error?.({ error }, "SMS delivery test failed");
    res.status(502).json({ error: error instanceof Error ? error.message : "SMS delivery test failed." });
  }
});

export default router;
