import { and, eq, gte, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, bookingsTable, clientAccountsTable, clientNotificationsTable, staffAccountsTable, messageTemplatesTable } from "@workspace/db";
import { getDeliveryStatus, sendBookingDelivery, sendEmail, sendSms } from "./delivery-providers";

const DEFAULT_TEMPLATES: Record<string, { title: string; body: string }> = {
  booking_confirmation: {
    title: "Your session request is received",
    body: "Hi {{clientName}}, we received your session request for {{date}} at {{time}}. We’ll follow up shortly with confirmation.",
  },
  appointment_reminder: {
    title: "Reminder: your session is {{date}} at {{time}}",
    body: "Hi {{clientName}}, this is a gentle reminder that your phone session is scheduled for {{date}} at {{time}}. Please keep your phone nearby.",
  },
  appointment_start: {
    title: "Your session is starting now",
    body: "Hi {{clientName}}, your phone session is starting now at {{time}}. Please keep your phone nearby.",
  },
  starting_soon: {
    title: "Your session is starting soon",
    body: "Hi {{clientName}}, your session is starting soon at {{time}}. Find a quiet, comfortable place and keep your phone close.",
  },
  cancellation: {
    title: "Your appointment was cancelled",
    body: "Hi {{clientName}}, your appointment for {{date}} at {{time}} has been cancelled. Please contact us if you need help finding another time.",
  },
  reschedule: {
    title: "Your appointment was rescheduled",
    body: "Hi {{clientName}}, your appointment is now scheduled for {{date}} at {{time}}. Please keep your confirmation details nearby.",
  },
};

function fill(value: string, booking: typeof bookingsTable.$inferSelect) {
  return value
    .replaceAll("{{clientName}}", booking.clientName)
    .replaceAll("{{date}}", booking.preferredDate)
    .replaceAll("{{time}}", booking.preferredTime)
    .replaceAll("{{confirmationCode}}", booking.confirmationCode);
}

async function ensureNotificationEventsTable() {
  // Keep older production databases compatible with the message-template channel field.
  await db.execute(sql`ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'both'`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS notification_events (
    id serial PRIMARY KEY,
    event_key text NOT NULL UNIQUE,
    booking_id integer,
    recipient_type text NOT NULL,
    recipient_id text,
    kind text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
    id serial PRIMARY KEY,
    booking_id integer,
    event_kind text NOT NULL,
    channel text NOT NULL,
    recipient_type text NOT NULL DEFAULT 'client',
    recipient_masked text NOT NULL DEFAULT '',
    status text NOT NULL,
    detail text NOT NULL DEFAULT '',
    attempt_source text NOT NULL DEFAULT 'automatic',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notification_delivery_recent ON notification_delivery_attempts(created_at DESC)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS client_portal_preferences (client_account_id integer PRIMARY KEY,language text NOT NULL DEFAULT 'en',in_portal_reminders boolean NOT NULL DEFAULT true,default_share_session_prep boolean NOT NULL DEFAULT false,email_reminders boolean NOT NULL DEFAULT false,sms_reminders boolean NOT NULL DEFAULT false,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`ALTER TABLE client_portal_preferences ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE client_portal_preferences ADD COLUMN IF NOT EXISTS sms_reminders boolean NOT NULL DEFAULT false`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS staff_notifications (
    id serial PRIMARY KEY,
    staff_email text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`ALTER TABLE staff_portal_preferences ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'`).catch(() => undefined);
}

function maskRecipient(value: string | null | undefined, channel: string) {
  if (!value) return "";
  if (channel === "email") {
    const [local, domain] = value.split("@");
    return local && domain ? local.slice(0, 1) + "•••@" + domain : "email";
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? "•••" + digits.slice(-4) : "phone";
}

function safeDeliveryDetail(value: string) {
  if (value === "sent") return "Provider accepted the send request. This is not a confirmed delivery receipt.";
  if (value === "not_configured" || value === "not_configured_or_no_client_email") return value === "not_configured" ? "Skipped: channel not configured or client has not opted in." : "Skipped: channel not configured, email not linked, or client has not opted in.";
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]").slice(0, 700);
}

async function recordDeliveryAttempt(bookingId: number, kind: string, channel: string, result: string, recipient: string | null | undefined, source = "automatic") {
  const skipped = result === "not_configured" || result === "not_configured_or_no_client_email";
  const status = result === "sent" ? "submitted" : skipped ? "skipped" : "failed";
  await db.execute(sql`INSERT INTO notification_delivery_attempts (booking_id,event_kind,channel,recipient_type,recipient_masked,status,detail,attempt_source,created_at)
    VALUES (${bookingId},${kind},${channel},'client',${maskRecipient(recipient,channel)},${status},${safeDeliveryDetail(result)},${source},now())`);
}

async function staffAllows(email: string, preference: string) {
  const result = await db.execute(sql`SELECT notification_preferences AS prefs FROM staff_portal_preferences WHERE staff_email=${email} LIMIT 1`);
  const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
  const prefs = (row?.prefs ?? {}) as Record<string, boolean>;
  return prefs[preference] !== false;
}

function preferenceForBookingKind(kind: keyof typeof DEFAULT_TEMPLATES) {
  return ["booking_confirmation", "appointment_reminder", "appointment_start", "starting_soon", "cancellation", "reschedule"].includes(kind)
    ? "appointmentAlerts"
    : "systemAlerts";
}

async function claimEvent(eventKey: string, bookingId: number | null, recipientType: string, recipientId: string | null, kind: string) {
  const result = await db.execute(sql`
    INSERT INTO notification_events (event_key, booking_id, recipient_type, recipient_id, kind)
    VALUES (${eventKey}, ${bookingId}, ${recipientType}, ${recipientId}, ${kind})
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
  `);
  return Array.isArray(result) ? result.length > 0 : Boolean((result as any).rows?.length);
}

export async function notifyBooking(booking: typeof bookingsTable.$inferSelect, kind: keyof typeof DEFAULT_TEMPLATES) {
  await ensureNotificationEventsTable();
  const fallback = DEFAULT_TEMPLATES[kind];
  const [stored] = await db.select().from(messageTemplatesTable).where(eq(messageTemplatesTable.key, kind)).limit(1);
  const [storedSms] = await db.select().from(messageTemplatesTable).where(eq(messageTemplatesTable.key, `sms_${kind}`)).limit(1);
  const template = stored && stored.channel !== "sms" ? { title: stored.subject, body: stored.body } : fallback;
  const smsTemplateBody = storedSms?.channel === "sms" ? storedSms.body : template.body;
  const eventKey = `booking:${booking.id}:${kind}`;

  let preferences: any = null;
  if (booking.clientAccountId) {
    const preferencesResult: any = await db.execute(sql.raw("SELECT in_portal_reminders,email_reminders,sms_reminders FROM client_portal_preferences WHERE client_account_id=" + booking.clientAccountId + " LIMIT 1")).catch(() => ({ rows: [] }));
    preferences = Array.isArray(preferencesResult) ? preferencesResult[0] : preferencesResult?.rows?.[0];
    const isReminder = ["appointment_reminder", "starting_soon", "appointment_start"].includes(kind);
    // Transactional confirmations, cancellations, and reschedules are always
    // delivered in-portal. Clients may opt out of optional reminder events.
    if (!isReminder || preferences?.in_portal_reminders !== false) {
      const claimed = await claimEvent(eventKey, booking.id, "client", String(booking.clientAccountId), kind);
      if (claimed) {
        await db.insert(clientNotificationsTable).values({
          clientAccountId: booking.clientAccountId,
          title: fill(template.title, booking),
          body: fill(template.body, booking),
          pushedBy: "Aydens Wellness Services",
        });
      }
    }
  }

  const staff = await db.select({ email: staffAccountsTable.email }).from(staffAccountsTable);
  const recipients = [{ email: "ayden@aydenstherapyservices.com" }, ...staff];
  const preference = preferenceForBookingKind(kind);
  await Promise.all(recipients.filter((item, index, list) => list.findIndex((other) => other.email === item.email) === index).map(async ({ email }) => {
    if (!await staffAllows(email, preference)) return;
    const staffKey = `${eventKey}:staff:${email}`;
    if (await claimEvent(staffKey, booking.id, "staff", email, kind)) {
      await db.execute(sql`INSERT INTO staff_notifications (staff_email, title, body) VALUES (${email}, ${fill(template.title, booking)}, ${fill(template.body, booking)})`);
    }
  }));

  // Deliver external email/SMS only when providers are configured. Client email
  // is taken from the linked account; the public booking form itself stores phone only.
  const deliveryStatus = getDeliveryStatus();
  const [client] = booking.clientAccountId
    ? await db.select({ email: clientAccountsTable.email }).from(clientAccountsTable).where(eq(clientAccountsTable.id, booking.clientAccountId)).limit(1)
    : [];
  if ((deliveryStatus.email.configured && client?.email && preferences?.email_reminders === true) || (deliveryStatus.sms.configured && booking.phone && preferences?.sms_reminders === true)) {
    const externalKey = `${eventKey}:external`;
    if (await claimEvent(externalKey, booking.id, "external", String(booking.clientAccountId ?? booking.phone), kind)) {
      const results = await sendBookingDelivery(booking, kind, fill(template.title, booking), fill(template.body, booking), client?.email, { emailAllowed: preferences?.email_reminders === true, smsAllowed: preferences?.sms_reminders === true }, fill(smsTemplateBody, booking));
      if (results.email) await recordDeliveryAttempt(booking.id, kind, "email", results.email, client?.email ?? null).catch((err) => console.warn("Could not record email delivery attempt", err));
      if (results.sms) await recordDeliveryAttempt(booking.id, kind, "sms", results.sms, booking.phone).catch((err) => console.warn("Could not record SMS delivery attempt", err));
      if (results.email && results.email !== "sent" && results.email !== "not_configured_or_no_client_email") {
        await db.execute(sql`DELETE FROM notification_events WHERE event_key=${externalKey}`).catch(() => undefined);
      }
      if (results.sms && results.sms !== "sent" && results.sms !== "not_configured") {
        await db.execute(sql`DELETE FROM notification_events WHERE event_key=${externalKey}`).catch(() => undefined);
      }
    }
  }
}

export async function processScheduledNotifications() {
  await ensureNotificationEventsTable();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in15m = new Date(now.getTime() + 15 * 60 * 1000);
  const bookings = await db.select().from(bookingsTable).where(and(
    gte(bookingsTable.createdAt, new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)),
    lt(bookingsTable.createdAt, in24h),
  ));

  for (const booking of bookings) {
    if (["cancelled", "completed", "no_show"].includes(booking.status)) continue;
    const appointmentAt = new Date(`${booking.preferredDate}T${booking.preferredTime}:00`);
    const diff = appointmentAt.getTime() - now.getTime();
    if (diff > 23 * 60 * 60 * 1000 && diff <= 24 * 60 * 60 * 1000) {
      await notifyBooking(booking, "appointment_reminder");
    }
    if (diff > 0 && diff <= 15 * 60 * 1000) {
      await notifyBooking(booking, "starting_soon");
    }
  }
}

export async function retryBookingDelivery(bookingId: number, kind: string, channel: "email" | "sms") {
  const supportedKinds = ["booking_confirmation", "appointment_reminder", "appointment_start", "starting_soon", "cancellation", "reschedule"];
  if (!supportedKinds.includes(kind)) throw new Error("This notification type cannot be retried.");
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking) throw new Error("The original booking no longer exists.");
  const preferencesResult: any = booking.clientAccountId
    ? await db.execute(sql`SELECT email_reminders,sms_reminders FROM client_portal_preferences WHERE client_account_id=${booking.clientAccountId} LIMIT 1`).catch(() => ({ rows: [] }))
    : { rows: [] };
  const prefs = Array.isArray(preferencesResult) ? preferencesResult[0] : preferencesResult?.rows?.[0];
  const [stored] = await db.select().from(messageTemplatesTable).where(eq(messageTemplatesTable.key, kind)).limit(1);
  const [storedSms] = await db.select().from(messageTemplatesTable).where(eq(messageTemplatesTable.key, `sms_${kind}`)).limit(1);
  const fallback = DEFAULT_TEMPLATES[kind] ?? { title: "Aydens Wellness Services update", body: "An update is available for your appointment." };
  const template = stored && stored.channel !== "sms" ? { title: stored.subject, body: stored.body } : fallback;
  const smsBody = storedSms?.channel === "sms" ? storedSms.body : template.body;
  const [client] = booking.clientAccountId
    ? await db.select({ email: clientAccountsTable.email }).from(clientAccountsTable).where(eq(clientAccountsTable.id, booking.clientAccountId)).limit(1)
    : [];
  if (channel === "email") {
    if (prefs?.email_reminders !== true || !client?.email) throw new Error("The client has not opted in to email reminders or has no linked email address.");
    if (!getDeliveryStatus().email.configured) throw new Error("Email delivery is not configured.");
    try {
      await sendEmail(client.email, fill(template.title, booking), fill(template.body, booking));
      await recordDeliveryAttempt(booking.id, kind, "email", "sent", client.email, "manual_retry");
      return { status: "submitted", message: "The email provider accepted the retry request. Delivery confirmation may arrive separately." };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Email retry failed.";
      await recordDeliveryAttempt(booking.id, kind, "email", detail, client.email, "manual_retry");
      throw new Error(detail);
    }
  }
  if (prefs?.sms_reminders !== true) throw new Error("The client has not opted in to SMS reminders.");
  if (!getDeliveryStatus().sms.configured) throw new Error("SMS delivery is not configured.");
  try {
    await sendSms(booking.phone, fill(smsBody, booking));
    await recordDeliveryAttempt(booking.id, kind, "sms", "sent", booking.phone, "manual_retry");
    return { status: "submitted", message: "The SMS provider accepted the retry request. Delivery confirmation may arrive separately." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "SMS retry failed.";
    await recordDeliveryAttempt(booking.id, kind, "sms", detail, booking.phone, "manual_retry");
    throw new Error(detail);
  }
}

export async function prepareNotificationStorage() {
  await ensureNotificationEventsTable();
}
