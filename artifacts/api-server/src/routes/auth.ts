import { Router } from "express";
import type { CookieOptions } from "express";
import { signPayload, verifyPayload, STAFF_ACCOUNTS, SESSION_COOKIE, ADMIN_EMAIL, verifyPassword } from "../middleware/auth";
import { db } from "@workspace/db";
import { staffAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password, keepSignedIn } = req.body as {
    email: string;
    password: string;
    keepSignedIn: boolean;
  };

  const key = (email ?? "").toLowerCase().trim();

  // 1. Check hardcoded admin account first
  const hardcoded = STAFF_ACCOUNTS[key];
  if (hardcoded) {
    if (hardcoded.password !== password) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    issueSession(res, key, hardcoded.name, keepSignedIn);
    res.json({ success: true, staffName: hardcoded.name });
    return;
  }

  // 2. Check DB staff accounts
  const rows = await db
    .select()
    .from(staffAccountsTable)
    .where(eq(staffAccountsTable.email, key))
    .limit(1);

  if (!rows.length || !verifyPassword(password, rows[0].passwordHash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  issueSession(res, key, rows[0].name, keepSignedIn);
  res.json({ success: true, staffName: rows[0].name });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ message: "Logged out." });
});

router.get("/me", async (req, res) => {
  const raw = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!raw) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const session = verifyPayload(raw);
  if (!session?.email) {
    res.status(401).json({ error: "Invalid session." });
    return;
  }

  // Accept hardcoded admin OR any DB account
  const isHardcoded = Boolean(STAFF_ACCOUNTS[session.email]);
  let isValid = isHardcoded;

  if (!isHardcoded) {
    const rows = await db
      .select({ id: staffAccountsTable.id })
      .from(staffAccountsTable)
      .where(eq(staffAccountsTable.email, session.email))
      .limit(1);
    isValid = rows.length > 0;
  }

  if (!isValid) {
    res.status(401).json({ error: "Invalid session." });
    return;
  }

  res.json({
    authenticated: true,
    staffName: session.name,
    email: session.email,
    isAdmin: session.email === ADMIN_EMAIL,
  });
});

function issueSession(res: import('express').Response, email: string, name: string, keepSignedIn: boolean) {
  const signed = signPayload({ email, name });

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  if (keepSignedIn) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  res.cookie(SESSION_COOKIE, signed, cookieOptions);
}

export default router;
