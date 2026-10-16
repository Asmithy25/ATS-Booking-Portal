import type { Booking } from "@workspace/db";

export type DeliveryStatus = {
  email: { configured: boolean; provider: "Resend"; sender: string; missing: string[] };
  sms: { configured: boolean; provider: "Twilio"; sender: string; missing: string[] };
};

function emailFrom() {
  return process.env.AWS_EMAIL_FROM || "";
}
function emailReplyTo() {
  return process.env.AWS_EMAIL_REPLY_TO || "aydenswellnessservices@gmail.com";
}

export function getDeliveryStatus(): DeliveryStatus {
  const emailMissing = ["RESEND_API_KEY", "AWS_EMAIL_FROM"].filter((key) => !process.env[key]?.trim());
  const smsMissing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"].filter((key) => !process.env[key]?.trim());
  return {
    email: { configured: emailMissing.length === 0, provider: "Resend", sender: emailFrom(), missing: emailMissing },
    sms: { configured: smsMissing.length === 0, provider: "Twilio", sender: process.env.TWILIO_FROM_NUMBER || "", missing: smsMissing },
  };
}

export async function sendEmail(to: string, subject: string, text: string) {
  const status = getDeliveryStatus().email;
  if (!status.configured) return { sent: false, skipped: true, reason: "Email provider is not configured." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: emailFrom(),
      to: [to],
      subject,
      text,
      reply_to: emailReplyTo(),
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Email provider rejected the message (${response.status}): ${detail}`);
  }
  return { sent: true };
}

export async function sendSms(to: string, body: string) {
  const status = getDeliveryStatus().sms;
  if (!status.configured) return { sent: false, skipped: true, reason: "SMS provider is not configured." };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`SMS provider rejected the message (${response.status}): ${detail}`);
  }
  return { sent: true };
}

export async function sendBookingDelivery(booking: Booking, kind: string, title: string, body: string, clientEmail?: string | null) {
  const results: { email?: string; sms?: string } = {};
  const canSend = ["booking_confirmation", "appointment_reminder", "appointment_start", "starting_soon", "cancellation", "reschedule"].includes(kind);
  if (!canSend) return results;

  // Each channel is isolated: a temporary email failure must not prevent SMS (or vice versa).
  if (clientEmail && getDeliveryStatus().email.configured) {
    try {
      await sendEmail(clientEmail, title, body);
      results.email = "sent";
    } catch (error) {
      results.email = error instanceof Error ? error.message : "Email delivery failed.";
    }
  } else results.email = "not_configured_or_no_client_email";

  if (booking.phone && getDeliveryStatus().sms.configured) {
    try {
      await sendSms(booking.phone, body);
      results.sms = "sent";
    } catch (error) {
      results.sms = error instanceof Error ? error.message : "SMS delivery failed.";
    }
  } else results.sms = "not_configured";

  return results;
}
