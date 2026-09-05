import { Router } from "express";
import type { CookieOptions } from "express";
import { signPayload, verifyPayload, STAFF_ACCOUNTS, SESSION_COOKIE, CLIENT_SESSION_COOKIE, ADMIN_EMAIL, verifyPassword, requireClientAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import { staffAccountsTable, clientAccountsTable, bookingsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../middleware/auth";
import { repairClientData } from "../lib/client-data-repair";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password, keepSignedIn } = req.body as {
    email: string;
    password: string;
    keepSignedIn: boolean;
  };

  const key = (email ?? "").toLowerCase().trim();

  const hardcoded = STAFF_ACCOUNTS[key];
  if (hardcoded) {
    if (hardcoded.password !== password) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    issueSession(res, key, hardcoded.name, keepSignedIn);
    res.json({ success: true, staffName: hardcoded.name, role: "founder", permissions: {} });
    return;
  }

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
  res.json({ success: true, staffName: rows[0].name, role: rows[0].role, permissions: rows[0].permissions });
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

  const staff = isHardcoded
    ? { role: "founder", permissions: {} as Record<string, boolean> }
    : (await db.select({ role: staffAccountsTable.role, permissions: staffAccountsTable.permissions }).from(staffAccountsTable).where(eq(staffAccountsTable.email, session.email)).limit(1))[0];

  res.json({
    authenticated: true,
    staffName: session.name,
    email: session.email,
    isAdmin: session.email === ADMIN_EMAIL,
    role: staff?.role ?? "therapist",
    permissions: staff?.permissions ?? {},
  });
});

router.post("/client/signup", async (req, res) => {
  const { email, password, name, phone, updatesOptIn } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    updatesOptIn?: unknown;
  };
  const normalizedEmail = (email ?? "").toLowerCase().trim();
  if (!normalizedEmail || !password || !name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: "Name, email, phone, and password are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  if (typeof updatesOptIn !== "boolean") {
    res.status(400).json({ error: "Choose whether to receive practice updates." });
    return;
  }
  const existing = await db.select({ id: clientAccountsTable.id }).from(clientAccountsTable).where(eq(clientAccountsTable.email, normalizedEmail)).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }
  const [client] = await db.insert(clientAccountsTable).values({
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    name: name.trim().slice(0, 120),
    phone: phone.trim().slice(0, 40),
    updatesOptIn,
  }).returning({
    id: clientAccountsTable.id,
    email: clientAccountsTable.email,
    name: clientAccountsTable.name,
    phone: clientAccountsTable.phone,
    updatesOptIn: clientAccountsTable.updatesOptIn,
    createdAt: clientAccountsTable.createdAt,
  });

  await repairClientData(client.id, client.phone);
  issueClientSession(res, { id: String(client.id), email: client.email, name: client.name }, true);
  res.status(201).json({
    authenticated: true,
    client: { ...client, createdAt: client.createdAt.toISOString() },
  });
});

router.post("/client/login", async (req, res) => {
  const { email, password, keepSignedIn } = req.body as { email?: string; password?: string; keepSignedIn?: boolean };
  const normalizedEmail = (email ?? "").toLowerCase().trim();
  const [client] = await db.select().from(clientAccountsTable).where(eq(clientAccountsTable.email, normalizedEmail)).limit(1);
  if (!client || !password || !verifyPassword(password, client.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  await repairClientData(client.id, client.phone);
  issueClientSession(res, { id: String(client.id), email: client.email, name: client.name }, Boolean(keepSignedIn));
  res.json({
    authenticated: true,
    client: {
      id: client.id,
      email: client.email,
      name: client.name,
      phone: client.phone,
      updatesOptIn: client.updatesOptIn,
      createdAt: client.createdAt.toISOString(),
    },
  });
});

router.post("/client/logout", (_req, res) => {
  res.clearCookie(CLIENT_SESSION_COOKIE, { path: "/" });
  res.json({ message: "Logged out." });
});

router.get("/client/me", requireClientAuth, async (req, res) => {
  const id = Number((req as import("../middleware/auth").RequestWithClientSession).clientSession?.id);
  const [client] = await db.select({
    id: clientAccountsTable.id,
    email: clientAccountsTable.email,
    name: clientAccountsTable.name,
    phone: clientAccountsTable.phone,
    updatesOptIn: clientAccountsTable.updatesOptIn,
    createdAt: clientAccountsTable.createdAt,
  }).from(clientAccountsTable).where(eq(clientAccountsTable.id, id)).limit(1);
  if (!client) {
    res.status(401).json({ error: "Account not found." });
    return;
  }
  await repairClientData(client.id, client.phone);
  res.json({ authenticated: true, client: { ...client, createdAt: client.createdAt.toISOString() } });
});

router.patch("/client/preferences", requireClientAuth, async (req, res): Promise<void> => {
  const [settings] = await db.select({ featureFlags: settingsTable.featureFlags }).from(settingsTable).limit(1);
  if ((settings?.featureFlags as Record<string, boolean> | undefined)?.clientUpdatesOptIn === false) {
    res.status(403).json({ error: "Client update preferences are currently disabled." });
    return;
  }
  const id = Number((req as import("../middleware/auth").RequestWithClientSession).clientSession?.id);
  const updatesOptIn = (req.body as { updatesOptIn?: unknown }).updatesOptIn;
  if (typeof updatesOptIn !== "boolean") {
    res.status(400).json({ error: "A valid updates preference is required." });
    return;
  }
  const [updated] = await db.update(clientAccountsTable)
    .set({ updatesOptIn, updatedAt: new Date() })
    .where(eq(clientAccountsTable.id, id))
    .returning({ updatesOptIn: clientAccountsTable.updatesOptIn });
  if (!updated) {
    res.status(404).json({ error: "Client account not found." });
    return;
  }
  res.json(updated);
});

function issueClientSession(
  res: import("express").Response,
  client: { id: string; email: string; name: string },
  keepSignedIn: boolean,
) {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  if (keepSignedIn) cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
  res.cookie(CLIENT_SESSION_COOKIE, signPayload(client), cookieOptions);
}

function issueSession(res: import('express').Response, email: string, name: string, keepSignedIn: boolean) {
  const signed = signPayload({ email, name });

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === 'production',
    path: "/",
  };

  if (keepSignedIn) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  res.cookie(SESSION_COOKIE, signed, cookieOptions);
}

export default router;
