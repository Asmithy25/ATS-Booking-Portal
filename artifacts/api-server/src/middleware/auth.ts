import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { staffAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "ats_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-fallback-secret-change-in-prod";
const ADMIN_EMAIL = "ayden@aydenstherapyservices.com";

/**
 * Admin credentials — password loaded from Replit Secrets so it never lives
 * in source or falls back to a known default.
 */
const ADMIN_PASSWORD = process.env.AYDEN_ADMIN_PASSWORD ?? "";

const STAFF_ACCOUNTS: Record<string, { password: string; name: string }> = {
  [ADMIN_EMAIL]: { password: ADMIN_PASSWORD, name: "Ayden" },
};

// ─── Cookie helpers ──────────────────────────────────────────────────────────

/**
 * Produce a URL-safe cookie value: base64url(JSON) + "." + HMAC-SHA256 hex
 */
export function signPayload(data: object): string {
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

/**
 * Verify and decode the cookie. Returns the parsed object or null.
 */
export function verifyPayload(signed: string): Record<string, string> | null {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;

  const b64 = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);

  const expected = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const sigBuf = Buffer.from(sig.padEnd(expected.length, "0"), "hex");

  if (expectedBuf.length !== sigBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) return null;

  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ─── Password helpers ────────────────────────────────────────────────────────

/**
 * Hash a plain-text password using scrypt. Returns "salt:hash" hex string.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored "salt:hash" string.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    if (hashBuf.length !== derivedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, derivedBuf);
  } catch {
    return false;
  }
}

// ─── Session types ───────────────────────────────────────────────────────────

export type StaffSession = { email: string; name: string };
export type RequestWithSession = Request & { staffSession?: StaffSession };

// ─── Shared: parse + verify cookie ──────────────────────────────────────────

function extractSession(req: Request): Record<string, string> | null {
  const raw = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!raw) return null;
  return verifyPayload(raw);
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Verify the session cookie AND confirm the account still exists.
 * Deletion of a DB staff account immediately invalidates their sessions.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = extractSession(req);
  if (!session?.email) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  // Admin account — checked in memory, never deleted via the employees API
  if (STAFF_ACCOUNTS[session.email]) {
    (req as RequestWithSession).staffSession = { email: session.email, name: session.name };
    next();
    return;
  }

  // DB staff accounts — re-validate existence on every request so that
  // deleting an account takes effect immediately, not after cookie expiry.
  db.select({ id: staffAccountsTable.id })
    .from(staffAccountsTable)
    .where(eq(staffAccountsTable.email, session.email))
    .limit(1)
    .then((rows) => {
      if (!rows.length) {
        res.status(401).json({ error: "Account no longer active." });
        return;
      }
      (req as RequestWithSession).staffSession = { email: session.email, name: session.name };
      next();
    })
    .catch((err) => next(err));
}

// ─── requireAdminAuth ────────────────────────────────────────────────────────

/**
 * Require the session to belong specifically to the admin account.
 * Does not need a DB round-trip because the admin is always the hardcoded account.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const session = extractSession(req);

  if (!session?.email) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  if (session.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  (req as RequestWithSession).staffSession = { email: session.email, name: session.name };
  next();
}

export { STAFF_ACCOUNTS, SESSION_COOKIE, ADMIN_EMAIL };
