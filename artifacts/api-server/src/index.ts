import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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
}

prepareDatabase().then(() => app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
})).catch((err) => {
  logger.error({ err }, "Database preparation failed");
  process.exit(1);
});
