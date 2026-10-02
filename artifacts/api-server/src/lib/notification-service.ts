import { and, eq, gte, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, bookingsTable, clientNotificationsTable, staffAccountsTable, messageTemplatesTable } from "@workspace/db";

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
  await db.execute(sql`CREATE TABLE IF NOT EXISTS notification_events (
    id serial PRIMARY KEY,
    event_key text NOT NULL UNIQUE,
    booking_id integer,
    recipient_type text NOT NULL,
    recipient_id text,
    kind text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
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
  const template = stored ? { title: stored.subject, body: stored.body } : fallback;
  const eventKey = `booking:${booking.id}:${kind}`;

  if (booking.clientAccountId) {
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

export async function prepareNotificationStorage() {
  await ensureNotificationEventsTable();
}
