import { Router } from "express";
import { db } from "@workspace/db";
import { staffAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdminAuth } from "../middleware/auth";
import { hashPassword } from "../middleware/auth";
import type { OfficeHours } from "@workspace/db";
import type { StaffSession } from "../middleware/auth";
import type { Request } from "express";

const router = Router();

type RequestWithSession = Request & { staffSession?: StaffSession };
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function isOfficeHours(value: unknown): value is OfficeHours {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return DAYS.every((day) => {
    const item = candidate[day];
    if (!item || typeof item !== "object") return false;
    const hours = item as Record<string, unknown>;
    return typeof hours.open === "string"
      && typeof hours.close === "string"
      && typeof hours.closed === "boolean"
      && /^\d{2}:\d{2}$/.test(hours.open)
      && /^\d{2}:\d{2}$/.test(hours.close);
  });
}

// GET /employees — list all staff accounts (admin only)
router.get("/", requireAdminAuth, async (_req, res) => {
  const accounts = await db
    .select({
      id: staffAccountsTable.id,
      email: staffAccountsTable.email,
      name: staffAccountsTable.name,
      officeHours: staffAccountsTable.officeHours,
      createdBy: staffAccountsTable.createdBy,
      createdAt: staffAccountsTable.createdAt,
    })
    .from(staffAccountsTable)
    .orderBy(staffAccountsTable.createdAt);

  res.json(
    accounts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))
  );
});

// PATCH /employees/:id — update a staff member's name, email, or hours (admin only)
router.patch("/:id", requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Partial<{ name: string; email: string; officeHours: OfficeHours }>;
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const updates: Partial<typeof staffAccountsTable.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      res.status(400).json({ error: "Name cannot be empty." });
      return;
    }
    updates.name = name.slice(0, 100);
  }
  if (body.email !== undefined) {
    const email = body.email.toLowerCase().trim();
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email is required." });
      return;
    }
    if (email === "ayden@aydenstherapyservices.com") {
      res.status(409).json({ error: "Cannot assign the protected admin email to a staff account." });
      return;
    }
    const existing = await db.select({ id: staffAccountsTable.id })
      .from(staffAccountsTable)
      .where(eq(staffAccountsTable.email, email))
      .limit(1);
    if (existing.length && existing[0].id !== id) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    updates.email = email;
  }
  if (body.officeHours !== undefined) {
    if (!isOfficeHours(body.officeHours)) {
      res.status(400).json({ error: "A complete weekly schedule is required." });
      return;
    }
    updates.officeHours = body.officeHours;
  }
  if (!Object.keys(updates).length) {
    res.status(400).json({ error: "No changes provided." });
    return;
  }

  const [updated] = await db.update(staffAccountsTable)
    .set(updates)
    .where(eq(staffAccountsTable.id, id))
    .returning({
      id: staffAccountsTable.id,
      email: staffAccountsTable.email,
      name: staffAccountsTable.name,
      officeHours: staffAccountsTable.officeHours,
      createdBy: staffAccountsTable.createdBy,
      createdAt: staffAccountsTable.createdAt,
    });
  if (!updated) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

// POST /employees/:id/reset-password — admin-controlled password reset
router.post("/:id/reset-password", requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const password = String((req.body as { password?: string })?.password ?? "");
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const [updated] = await db.update(staffAccountsTable)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(staffAccountsTable.id, id))
    .returning({ id: staffAccountsTable.id, name: staffAccountsTable.name });
  if (!updated) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  res.json({ message: `Password reset for ${updated.name}.` });
});

// POST /employees — create a new staff account (admin only)
router.post("/", requireAdminAuth, async (req, res) => {
  const { email, name, password } = req.body as {
    email: string;
    name: string;
    password: string;
  };

  if (!email || !name || !password) {
    res.status(400).json({ error: "email, name, and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const key = email.toLowerCase().trim();

  // Prevent overwriting the hardcoded admin account
  if (key === "ayden@aydenstherapyservices.com") {
    res.status(409).json({ error: "Cannot create an account for the admin email." });
    return;
  }

  const existing = await db
    .select({ id: staffAccountsTable.id })
    .from(staffAccountsTable)
    .where(eq(staffAccountsTable.email, key))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const creator = (req as RequestWithSession).staffSession?.email ?? "admin";
  const passwordHash = hashPassword(password);

  const [created] = await db
    .insert(staffAccountsTable)
    .values({ email: key, name, passwordHash, createdBy: creator })
    .returning({
      id: staffAccountsTable.id,
      email: staffAccountsTable.email,
      name: staffAccountsTable.name,
      officeHours: staffAccountsTable.officeHours,
      createdBy: staffAccountsTable.createdBy,
      createdAt: staffAccountsTable.createdAt,
    });

  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

// DELETE /employees/:id — remove a staff account (admin only)
router.delete("/:id", requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const [deleted] = await db
    .delete(staffAccountsTable)
    .where(eq(staffAccountsTable.id, id))
    .returning({ id: staffAccountsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  res.json({ message: "Account deleted." });
});

export default router;
