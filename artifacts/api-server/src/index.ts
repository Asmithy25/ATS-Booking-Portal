import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { prepareNotificationStorage, processScheduledNotifications } from "./lib/notification-service";
import { ADMIN_EMAIL } from "./middleware/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function prepareDatabase() {
  // Keep existing deployments compatible without requiring a manual migration step.
  await db.execute(sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS homepage_content jsonb NOT NULL DEFAULT '{}'::jsonb`);
  await db.execute(sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb`);
  await db.execute(sql`UPDATE settings SET primary_color = '#C85E09' WHERE lower(primary_color) IN ('#7b4a2f', '#8f4a34')`);
  await db.execute(sql`UPDATE settings SET secondary_color = '#F3A444' WHERE lower(secondary_color) IN ('#c38a4a', '#b58c50')`);
  await db.execute(sql`UPDATE settings SET accent_color = '#5C2B12' WHERE lower(accent_color) IN ('#d9b7a2', '#c4ceb5')`);
  // AWS 3.0 live sessions are additive and keep existing booking records intact.
  await db.execute(sql`CREATE TABLE IF NOT EXISTS booking_sessions (
    id serial PRIMARY KEY,
    booking_id integer NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    staff_email text NOT NULL,
    staff_name text NOT NULL,
    client_name text NOT NULL,
    confirmation_code text NOT NULL,
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    auto_started boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_booking_sessions_active ON booking_sessions (ended_at, started_at)`);
  await prepareNotificationStorage();
}

async function processScheduledSessions() {
  // Appointments are scheduled in Florida's local time zone. A short catch-up
  // window lets the 60-second scheduler activate a session without starting
  // stale bookings from previous days.
  await db.execute(sql`
    INSERT INTO booking_sessions (
      booking_id, staff_email, staff_name, client_name, confirmation_code,
      started_at, auto_started, created_at, updated_at
    )
    SELECT
      b.id,
      COALESCE(
        s.email,
        CASE
          WHEN lower(trim(b.claimed_by)) IN ('ayden', 'ayden smith') THEN ${ADMIN_EMAIL}
          ELSE lower(trim(b.claimed_by))
        END
      ),
      trim(b.claimed_by),
      b.client_name,
      b.confirmation_code,
      ((b.preferred_date || ' ' || b.preferred_time)::timestamp AT TIME ZONE 'America/New_York'),
      true,
      now(),
      now()
    FROM bookings b
    LEFT JOIN staff_accounts s ON lower(trim(s.name)) = lower(trim(b.claimed_by))
    WHERE b.status = 'claimed'
      AND NULLIF(trim(b.claimed_by), '') IS NOT NULL
      AND ((b.preferred_date || ' ' || b.preferred_time)::timestamp AT TIME ZONE 'America/New_York')
        BETWEEN now() - interval '4 hours' AND now()
    ON CONFLICT (booking_id) DO NOTHING
  `);
}
prepareDatabase().then(() => app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  const runNotifications = () => processScheduledNotifications().catch((err) => logger.warn({ err }, "Scheduled notification pass failed"));
  const runSessions = () => processScheduledSessions().catch((err) => logger.warn({ err }, "Scheduled live-session pass failed"));
  void runNotifications();
  void runSessions();
  setInterval(runNotifications, 60_000);
  setInterval(runSessions, 60_000);
})).catch((err) => {
  logger.error({ err }, "Database preparation failed");
  process.exit(1);
});
