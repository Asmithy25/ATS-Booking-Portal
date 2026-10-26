import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type CorporateOperationsConfig = {
  bookingsPaused: boolean;
  notificationsPaused: boolean;
  maintenanceMode: boolean;
  changeFreeze: boolean;
  freezeReason: string;
  freezeUntil: string;
  maintenanceMessage: string;
};

const DEFAULTS: CorporateOperationsConfig = {
  bookingsPaused: false,
  notificationsPaused: false,
  maintenanceMode: false,
  changeFreeze: false,
  freezeReason: "",
  freezeUntil: "",
  maintenanceMessage: "We’re carrying out scheduled maintenance. Please check back shortly.",
};

export async function getCorporateOperationsConfig(): Promise<CorporateOperationsConfig> {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ash_corporate_config (
    key text PRIMARY KEY,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
  )`));
  const result: any = await db.execute(sql`SELECT value FROM ash_corporate_config WHERE key='operations' LIMIT 1`);
  const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
  const saved = row?.value && typeof row.value === "object" ? row.value : {};
  const config = { ...DEFAULTS, ...saved } as CorporateOperationsConfig;
  if (config.freezeUntil) {
    const expiry = new Date(config.freezeUntil);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) {
      config.changeFreeze = false;
      config.freezeReason = "";
      config.freezeUntil = "";
      config.maintenanceMessage = String(config.maintenanceMessage || DEFAULTS.maintenanceMessage);
      await db.execute(sql`UPDATE ash_corporate_config SET value=${JSON.stringify(config)}::jsonb,updated_at=now() WHERE key='operations'`).catch(() => undefined);
    }
  }
  return config;
}
