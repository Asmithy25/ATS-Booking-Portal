import { connect as tlsConnect } from "node:tls";
import { createInterface } from "node:readline";
import type { Booking } from "@workspace/db";

export type DeliveryStatus = {
  email: { configured: boolean; provider: "Gmail SMTP"; sender: string; missing: string[] };
  sms: { configured: boolean; provider: "Twilio"; sender: string; missing: string[] };
};

const DEFAULT_AWS_EMAIL = "aydenswellnessservices@gmail.com";

function emailFrom() {
  return process.env.GMAIL_USER?.trim() || DEFAULT_AWS_EMAIL;
}
function emailReplyTo() {
  return process.env.AWS_EMAIL_REPLY_TO || DEFAULT_AWS_EMAIL;
}

export function getDeliveryStatus(): DeliveryStatus {
  const emailMissing = ["GMAIL_USER", "GMAIL_APP_PASSWORD"].filter((key) => !process.env[key]?.trim());
  const smsMissing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"].filter((key) => !process.env[key]?.trim());
  return {
    email: { configured: emailMissing.length === 0, provider: "Gmail SMTP", sender: emailFrom(), missing: emailMissing },
    sms: { configured: smsMissing.length === 0, provider: "Twilio", sender: process.env.TWILIO_FROM_NUMBER || "", missing: smsMissing },
  };
}

function encodeHeader(value: string) {
  const clean = value.replace(/[\\r\\n]/g, " ").trim();
  return /^[\\x20-\\x7E]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

async function smtpCommand(
  socket: ReturnType<typeof tlsConnect>,
  nextLine: () => Promise<string>,
  command: string,
  accepted: number[],
) {
  socket.write(command + "\\r\\n");
  const first = await nextLine();
  const match = first.match(/^(\\d{3})([ -])/);
  if (!match) throw new Error("Gmail SMTP returned an invalid response.");
  const code = Number(match[1]);
  let line = first;
  while (line[3] === "-") {
    line = await nextLine();
  }
  if (!accepted.includes(code)) {
    throw new Error(`Gmail SMTP rejected a command (${code}): ${line.slice(4, 300)}`);
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  const status = getDeliveryStatus().email;
  if (!status.configured) return { sent: false, skipped: true, reason: "Gmail email delivery is not configured." };

  const user = process.env.GMAIL_USER!.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD!.replace(/\\s/g, "");
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(user) || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(to)) {
    throw new Error("GMAIL_USER and recipient must be valid email addresses.");
  }
  if (!appPassword) throw new Error("GMAIL_APP_PASSWORD is empty.");

  const socket = tlsConnect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com" });
  socket.setTimeout(20000, () => socket.destroy(new Error("Gmail SMTP connection timed out.")));
  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });

  const readline = createInterface({ input: socket });
  const iterator = readline[Symbol.asyncIterator]();
  const nextLine = async () => {
    const next = await iterator.next();
    if (next.done) throw new Error("Gmail SMTP connection closed unexpectedly.");
    return next.value;
  };

  try {
    const greeting = await nextLine();
    if (!greeting.startsWith("220")) throw new Error(`Gmail SMTP greeting failed: ${greeting.slice(0, 250)}`);
    await smtpCommand(socket, nextLine, "EHLO awsbookingportal.up.railway.app", [250]);
    await smtpCommand(socket, nextLine, "AUTH LOGIN", [334]);
    await smtpCommand(socket, nextLine, Buffer.from(user).toString("base64"), [334]);
    await smtpCommand(socket, nextLine, Buffer.from(appPassword).toString("base64"), [235]);
    await smtpCommand(socket, nextLine, `MAIL FROM:<${user}>`, [250]);
    await smtpCommand(socket, nextLine, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, nextLine, "DATA", [354]);

    const safeSubject = encodeHeader(subject);
    const safeReplyTo = emailReplyTo().replace(/[\\r\\n<>]/g, "");
    const safeText = text.replace(/\\r?\\n/g, "\\r\\n").replace(/^\\./gm, "..");
    const message = [
      `From: Aydens Wellness Services <${user}>`,
      `To: <${to}>`,
      `Reply-To: ${safeReplyTo}`,
      `Subject: ${safeSubject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      safeText,
      ".",
      "",
    ].join("\\r\\n");
    socket.write(message);
    const accepted = await nextLine();
    if (!accepted.startsWith("250")) throw new Error(`Gmail SMTP did not accept the email: ${accepted.slice(0, 300)}`);
    try { await smtpCommand(socket, nextLine, "QUIT", [221]); } catch { /* Message was already accepted. */ }
    return { sent: true };
  } finally {
    readline.close();
    socket.end();
  }
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

export async function sendBookingDelivery(booking: Booking, kind: string, title: string, body: string, clientEmail?: string | null, consent: { emailAllowed: boolean; smsAllowed: boolean } = { emailAllowed: false, smsAllowed: false }) {
  const results: { email?: string; sms?: string } = {};
  const canSend = ["booking_confirmation", "appointment_reminder", "appointment_start", "starting_soon", "cancellation", "reschedule"].includes(kind);
  if (!canSend) return results;

  // Each channel is isolated: a temporary email failure must not prevent SMS (or vice versa).
  if (consent.emailAllowed && clientEmail && getDeliveryStatus().email.configured) {
    try {
      await sendEmail(clientEmail, title, body);
      results.email = "sent";
    } catch (error) {
      results.email = error instanceof Error ? error.message : "Email delivery failed.";
    }
  } else results.email = "not_configured_or_no_client_email";

  if (consent.smsAllowed && booking.phone && getDeliveryStatus().sms.configured) {
    try {
      await sendSms(booking.phone, body);
      results.sms = "sent";
    } catch (error) {
      results.sms = error instanceof Error ? error.message : "SMS delivery failed.";
    }
  } else results.sms = "not_configured";

  return results;
}
