import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";

let ready: Promise<void> | null = null;
const exec = (query: string) => db.execute(sql.raw(query));

export type StaffSecurityRecord = {
  email: string;
  pin_hash: string | null;
  passkeys: Array<{ id: string; publicKey: string; signCount: number; transports?: string[] }>;
};

export function hashStaffPin(pin: string) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, 64);
  return "s2$" + salt.toString("hex") + "$" + derived.toString("hex");
}
export function verifyStaffPinHash(pin: string, encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "s2") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = crypto.scryptSync(pin, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function ensureAdvancedStorage(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await exec("CREATE TABLE IF NOT EXISTS staff_security (email text PRIMARY KEY,pin_hash text,passkeys jsonb NOT NULL DEFAULT '[]'::jsonb,last_pin_set_at timestamp,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS staff_security_policy (id integer PRIMARY KEY DEFAULT 1,pin_length integer NOT NULL DEFAULT 6,updated_at timestamp NOT NULL DEFAULT now())");
      await exec("INSERT INTO staff_security_policy(id,pin_length,updated_at) VALUES (1,6,now()) ON CONFLICT(id) DO NOTHING");
      await exec("CREATE TABLE IF NOT EXISTS staff_requests (id serial PRIMARY KEY,requester_email text NOT NULL,assignee_email text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'normal',status text NOT NULL DEFAULT 'open',due_date text,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS staff_request_comments (id serial PRIMARY KEY,request_id integer NOT NULL,author_email text NOT NULL,author_name text NOT NULL,body text NOT NULL,created_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS public_support_threads (id serial PRIMARY KEY,token text NOT NULL UNIQUE,name text NOT NULL,email text NOT NULL,phone text NOT NULL DEFAULT '',subject text NOT NULL DEFAULT 'Support request',status text NOT NULL DEFAULT 'open',client_account_id integer,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS public_support_messages (id serial PRIMARY KEY,thread_id integer NOT NULL,sender_type text NOT NULL,sender_name text NOT NULL,body text NOT NULL,read_by_staff boolean NOT NULL DEFAULT false,read_by_visitor boolean NOT NULL DEFAULT false,created_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE INDEX IF NOT EXISTS idx_staff_requests_assignee ON staff_requests(assignee_email,status,updated_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_staff_requests_requester ON staff_requests(requester_email,status,updated_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_public_support_updated ON public_support_threads(status,updated_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_public_support_messages ON public_support_messages(thread_id,created_at)");
      await exec("CREATE TABLE IF NOT EXISTS custom_roles (id serial PRIMARY KEY,slug text NOT NULL UNIQUE,name text NOT NULL,built_in boolean NOT NULL DEFAULT false,permissions jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS assistant_messages (id serial PRIMARY KEY,client_account_id integer NOT NULL,role text NOT NULL,body text NOT NULL,created_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS upload_requests (id serial PRIMARY KEY,token text NOT NULL UNIQUE,client_account_id integer NOT NULL,label text NOT NULL,created_by text NOT NULL,expires_at timestamp NOT NULL,created_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS client_uploads (id serial PRIMARY KEY,request_id integer NOT NULL,client_account_id integer NOT NULL,file_name text NOT NULL,mime_type text NOT NULL,size_bytes integer NOT NULL,data bytea NOT NULL,created_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS client_goals (id serial PRIMARY KEY,client_account_id integer NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'active',progress integer NOT NULL DEFAULT 0,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS client_journal_entries (id serial PRIMARY KEY,client_account_id integer NOT NULL,prompt text NOT NULL DEFAULT '',body text NOT NULL,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS client_checkins (id serial PRIMARY KEY,client_account_id integer NOT NULL,mood integer,stress integer,energy integer,sleep integer,notes text NOT NULL DEFAULT '',created_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS staff_tasks (id serial PRIMARY KEY,title text NOT NULL,description text NOT NULL DEFAULT '',assigned_to text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'open',due_date text,created_by text NOT NULL,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())");
      await exec("CREATE TABLE IF NOT EXISTS passkey_challenges (id serial PRIMARY KEY,email text NOT NULL,challenge text NOT NULL,origin text NOT NULL,rp_id text NOT NULL,purpose text NOT NULL,expires_at timestamp NOT NULL,created_at timestamp NOT NULL DEFAULT now())");
      await exec("ALTER TABLE wellness_assignments ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb");
      await exec("ALTER TABLE wellness_assignments ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb");
      await exec("ALTER TABLE wellness_assignments ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'one_time'");
      await exec("CREATE INDEX IF NOT EXISTS idx_assistant_client ON assistant_messages(client_account_id,created_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_upload_request_client ON upload_requests(client_account_id,created_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_upload_client ON client_uploads(client_account_id,created_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_goal_client ON client_goals(client_account_id,created_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_journal_client ON client_journal_entries(client_account_id,created_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_checkin_client ON client_checkins(client_account_id,created_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_staff_task_status ON staff_tasks(status,due_date)");
      await exec("CREATE INDEX IF NOT EXISTS idx_assignment_client ON wellness_assignments(client_account_id,updated_at)");
      await exec("CREATE INDEX IF NOT EXISTS idx_passkey_challenge_lookup ON passkey_challenges(email,purpose,expires_at)");
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

function quote(value: string) {
  return "'" + value.replace(/'/g, "''") + "'";
}

export async function getStaffSecurity(email: string): Promise<StaffSecurityRecord | null> {
  await ensureAdvancedStorage();
  const result: any = await exec("SELECT email,pin_hash,passkeys FROM staff_security WHERE email=" + quote(email.toLowerCase().trim()) + " LIMIT 1");
  return (result?.rows || result || [])[0] || null;
}

export async function staffPinConfigured(email: string) {
  const security = await getStaffSecurity(email);
  return Boolean(security?.pin_hash);
}

export async function setInitialStaffPin(email: string, pin: string) {
  await ensureAdvancedStorage();
  const normalized = email.toLowerCase().trim();
  await exec("INSERT INTO staff_security(email,pin_hash,passkeys,last_pin_set_at,created_at,updated_at) VALUES (" + quote(normalized) + "," + quote(hashStaffPin(pin)) + ",'[]'::jsonb,now(),now(),now()) ON CONFLICT(email) DO UPDATE SET pin_hash=EXCLUDED.pin_hash,last_pin_set_at=now(),updated_at=now()");
}

export async function verifyStaffPin(email: string, pin: string) {
  const security = await getStaffSecurity(email);
  return Boolean(security?.pin_hash && verifyStaffPinHash(pin, security.pin_hash));
}

export const PIN_LENGTH_OPTIONS = [4, 6, 8] as const;
export type StaffPinLength = typeof PIN_LENGTH_OPTIONS[number];
export function isAllowedPinLength(value: unknown): value is StaffPinLength {
  return PIN_LENGTH_OPTIONS.includes(Number(value) as StaffPinLength);
}
export function isObviousStaffPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  return "0123456789".includes(pin) || "9876543210".includes(pin);
}
export async function getStaffPinPolicy(): Promise<StaffPinLength> {
  await ensureAdvancedStorage();
  const result: any = await exec("SELECT pin_length FROM staff_security_policy WHERE id=1 LIMIT 1");
  const value = Number((result?.rows || result || [])[0]?.pin_length);
  return isAllowedPinLength(value) ? value : 6;
}
export async function setStaffPinPolicy(length: StaffPinLength): Promise<StaffPinLength> {
  if (!isAllowedPinLength(length)) throw new Error("PIN length must be 4, 6, or 8.");
  await ensureAdvancedStorage();
  await exec("INSERT INTO staff_security_policy(id,pin_length,updated_at) VALUES (1,"+Number(length)+",now()) ON CONFLICT(id) DO UPDATE SET pin_length=EXCLUDED.pin_length,updated_at=now()");
  return length;
}

export async function resetStaffPin(email: string) {
  await ensureAdvancedStorage();
  await exec("UPDATE staff_security SET pin_hash=NULL,last_pin_set_at=NULL,updated_at=now() WHERE email=" + quote(email.toLowerCase().trim()));
}
