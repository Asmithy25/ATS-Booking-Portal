import { Router } from "express";
import { asc, eq, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  db,
  settingsTable,
  bookingsTable,
  clientAccountsTable,
  staffAccountsTable,
  announcementsTable,
  auditLogsTable,
  supportThreadsTable,
  supportMessagesTable,
  wellnessResourcesTable,
  wellnessAssignmentsTable,
  messageTemplatesTable,
  collaborationItemsTable,
  clientTemplatesTable,
  clientNotificationsTable,
  sessionFeedbackTable,
} from "@workspace/db";
import { requireAdminAuth, hashPassword } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();
type BackupScope = "bookings" | "settings" | "site-data" | "everything";
type BackupRow = Record<string, any>;
type BackupPayload = { format: "ayden-therapy-backup"; version: 1; scope: BackupScope; exportedAt: string; tables: Record<string, BackupRow[]>; counts: Record<string, number> };

const TABLES = {
  settings: settingsTable,
  bookings: bookingsTable,
  clientAccounts: clientAccountsTable,
  staffAccounts: staffAccountsTable,
  announcements: announcementsTable,
  auditLogs: auditLogsTable,
  supportThreads: supportThreadsTable,
  supportMessages: supportMessagesTable,
  wellnessResources: wellnessResourcesTable,
  wellnessAssignments: wellnessAssignmentsTable,
  messageTemplates: messageTemplatesTable,
  collaborationItems: collaborationItemsTable,
  clientTemplates: clientTemplatesTable,
  clientNotifications: clientNotificationsTable,
  sessionFeedback: sessionFeedbackTable,
} as const;

const SCOPE_TABLES: Record<BackupScope, readonly string[]> = {
  bookings: ["bookings"],
  settings: ["settings"],
  "site-data": ["bookings", "clientAccounts", "staffAccounts", "announcements", "auditLogs", "supportThreads", "supportMessages", "wellnessResources", "wellnessAssignments", "messageTemplates", "collaborationItems", "clientTemplates", "clientNotifications", "sessionFeedback"],
  everything: Object.keys(TABLES),
};

const DATE_FIELDS: Record<string, readonly string[]> = {
  settings: [], bookings: ["createdAt"], clientAccounts: ["createdAt", "updatedAt"], staffAccounts: ["createdAt"], announcements: ["createdAt"], auditLogs: ["createdAt"],
  supportThreads: ["createdAt", "updatedAt"], supportMessages: ["createdAt"], wellnessResources: ["createdAt"], wellnessAssignments: ["createdAt", "updatedAt"], messageTemplates: ["updatedAt"], collaborationItems: ["createdAt", "updatedAt"], clientTemplates: ["updatedAt"], clientNotifications: ["createdAt"], sessionFeedback: ["createdAt"],
};
const SERIAL_TABLES = Object.keys(TABLES) as string[];

const isBackupScope = (value: unknown): value is BackupScope => value === "bookings" || value === "settings" || value === "site-data" || value === "everything";
const normalizePhone = (value: string) => value.replace(/\D/g, "");
const withoutId = (row: BackupRow) => { const { id: _id, ...rest } = row; return rest; };
const withoutKeys = (row: BackupRow, keys: string[]) => { const copy = { ...row }; for (const key of keys) delete copy[key]; return copy; };

function projectRows(tableName: string, rows: unknown): BackupRow[] {
  if (!Array.isArray(rows)) throw new Error(`${tableName} must be an array.`);
  return rows.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${tableName}[${index}] must be an object.`);
    const row = { ...(value as BackupRow) };
    if (row.id !== undefined && (!Number.isInteger(row.id) || row.id < 1)) throw new Error(`${tableName}[${index}].id must be a positive integer.`);
    for (const field of DATE_FIELDS[tableName] ?? []) {
      if (row[field] !== undefined) {
        const parsed = new Date(row[field]);
        if (Number.isNaN(parsed.getTime())) throw new Error(`${tableName}.${field} is not a valid date-time.`);
        row[field] = parsed;
      }
    }
    delete row.passwordHash;
    return row;
  });
}

async function exportBackup(scope: BackupScope): Promise<BackupPayload> {
  const tables: Record<string, BackupRow[]> = {};
  const counts: Record<string, number> = {};
  for (const tableName of SCOPE_TABLES[scope]) {
    const table = TABLES[tableName as keyof typeof TABLES] as any;
    const rows = await db.select().from(table).orderBy(asc(table.id));
    tables[tableName] = rows.map((row: BackupRow) => { const copy = { ...row }; delete copy.passwordHash; return copy; });
    counts[tableName] = rows.length;
  }
  return { format: "ayden-therapy-backup", version: 1, scope, exportedAt: new Date().toISOString(), tables, counts };
}

async function upsertRowsById(tx: any, table: any, rows: BackupRow[]) {
  let count = 0;
  for (const row of rows) {
    if (row.id === undefined) await tx.insert(table).values(row as any);
    else await tx.insert(table).values(row as any).onConflictDoUpdate({ target: table.id, set: withoutId(row) });
    count += 1;
  }
  return count;
}

async function resetSequences(tx: any, tableNames: readonly string[]) {
  for (const tableName of tableNames) await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), (SELECT MAX(id) IS NOT NULL FROM "${tableName}"))`));
}

async function importBackup(payload: BackupPayload) {
  const rowsByTable: Record<string, BackupRow[]> = {};
  const imported: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const warnings: string[] = [];
  const clientIdMap = new Map<number, number>();
  const bookingIdMap = new Map<number, number>();
  for (const tableName of SCOPE_TABLES[payload.scope]) rowsByTable[tableName] = projectRows(tableName, payload.tables[tableName] ?? []);

  await db.transaction(async (tx) => {
    if (rowsByTable.settings?.length) {
      const [current] = await tx.select().from(settingsTable).orderBy(asc(settingsTable.id)).limit(1);
      const values = withoutId(rowsByTable.settings[0]);
      if (current) await tx.update(settingsTable).set(values as any).where(eq(settingsTable.id, current.id));
      else await tx.insert(settingsTable).values(values as any);
      imported.settings = 1;
    }

    for (const row of rowsByTable.clientAccounts ?? []) {
      if (typeof row.email !== "string" || !row.email.trim()) throw new Error("Every client account must include an email address.");
      const email = row.email.trim().toLowerCase();
      const [existing] = await tx.select({ id: clientAccountsTable.id }).from(clientAccountsTable).where(eq(clientAccountsTable.email, email)).limit(1);
      let id: number;
      if (existing) {
        id = existing.id;
        await tx.update(clientAccountsTable).set(withoutKeys({ ...row, email }, ["id", "email"]) as any).where(eq(clientAccountsTable.id, id));
      } else {
        const [created] = await tx.insert(clientAccountsTable).values({ ...withoutKeys({ ...row, email }, ["id", "email"]), email, passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")) } as any).returning({ id: clientAccountsTable.id });
        id = created.id;
        warnings.push(`Client account ${email} was restored without its password.`);
      }
      if (typeof row.id === "number") clientIdMap.set(row.id, id);
      imported.clientAccounts = (imported.clientAccounts ?? 0) + 1;
    }

    for (const row of rowsByTable.staffAccounts ?? []) {
      if (typeof row.email !== "string" || !row.email.trim()) throw new Error("Every staff account must include an email address.");
      const email = row.email.trim().toLowerCase();
      const [existing] = await tx.select({ id: staffAccountsTable.id }).from(staffAccountsTable).where(eq(staffAccountsTable.email, email)).limit(1);
      if (existing) await tx.update(staffAccountsTable).set(withoutKeys({ ...row, email }, ["id", "email"]) as any).where(eq(staffAccountsTable.id, existing.id));
      else {
        await tx.insert(staffAccountsTable).values({ ...withoutKeys({ ...row, email }, ["id", "email"]), email, passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")) } as any);
        warnings.push(`Staff account ${email} was restored without its password.`);
      }
      imported.staffAccounts = (imported.staffAccounts ?? 0) + 1;
    }

    const resolveClientId = async (sourceId: unknown, phone: unknown) => {
      if (typeof sourceId === "number" && clientIdMap.has(sourceId)) return clientIdMap.get(sourceId)!;
      if (typeof phone === "string") {
        const normalized = normalizePhone(phone);
        const accounts = await tx.select({ id: clientAccountsTable.id, phone: clientAccountsTable.phone }).from(clientAccountsTable);
        return accounts.find((account) => normalizePhone(account.phone) === normalized)?.id ?? null;
      }
      return null;
    };

    for (const row of rowsByTable.bookings ?? []) {
      if (typeof row.confirmationCode !== "string" || !row.confirmationCode.trim()) throw new Error("Every booking must include a confirmation code.");
      const bookingRow = { ...row, clientAccountId: await resolveClientId(row.clientAccountId, row.phone) };
      const [existing] = await tx.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.confirmationCode, row.confirmationCode)).limit(1);
      let id: number;
      if (existing) {
        id = existing.id;
        await tx.update(bookingsTable).set(withoutKeys(bookingRow, ["id", "confirmationCode"]) as any).where(eq(bookingsTable.id, id));
      } else {
        const [created] = await tx.insert(bookingsTable).values(bookingRow as any).returning({ id: bookingsTable.id });
        id = created.id;
      }
      if (typeof row.id === "number") bookingIdMap.set(row.id, id);
      imported.bookings = (imported.bookings ?? 0) + 1;
    }

    const remapLinkedRows = (rows: BackupRow[], clientFields: readonly string[], bookingFields: readonly string[]) => rows.map((row) => {
      const copy = { ...row };
      for (const field of clientFields) if (typeof copy[field] === "number" && clientIdMap.has(copy[field])) copy[field] = clientIdMap.get(copy[field]);
      for (const field of bookingFields) if (typeof copy[field] === "number" && bookingIdMap.has(copy[field])) copy[field] = bookingIdMap.get(copy[field]);
      return copy;
    });

    const idTables: Array<[string, any, string[], string[]]> = [
      ["announcements", announcementsTable, [], []], ["auditLogs", auditLogsTable, [], []], ["supportThreads", supportThreadsTable, ["clientAccountId"], []], ["supportMessages", supportMessagesTable, [], []], ["wellnessResources", wellnessResourcesTable, [], []], ["wellnessAssignments", wellnessAssignmentsTable, ["clientAccountId"], ["bookingId"]], ["collaborationItems", collaborationItemsTable, [], []], ["clientNotifications", clientNotificationsTable, ["clientAccountId"], []], ["sessionFeedback", sessionFeedbackTable, ["clientAccountId"], ["bookingId"]],
    ];
    for (const [name, table, clientFields, bookingFields] of idTables) if (rowsByTable[name]?.length) imported[name] = await upsertRowsById(tx, table, remapLinkedRows(rowsByTable[name], clientFields, bookingFields));

    for (const [name, table] of [["messageTemplates", messageTemplatesTable], ["clientTemplates", clientTemplatesTable]] as const) {
      for (const row of rowsByTable[name] ?? []) {
        if (typeof row.key !== "string" || !row.key.trim()) throw new Error(`Every ${name} record must include a key.`);
        await tx.insert(table).values(row as any).onConflictDoUpdate({ target: table.key, set: withoutKeys(row, ["id", "key"]) as any });
        imported[name] = (imported[name] ?? 0) + 1;
      }
    }

    if ((payload.scope === "site-data" || payload.scope === "everything") && !rowsByTable.bookings?.length) warnings.push("This backup contains no bookings.");
    if ((payload.scope === "site-data" || payload.scope === "everything") && !rowsByTable.wellnessAssignments?.length) warnings.push("This backup contains no Wellness assignments.");
    await resetSequences(tx, SCOPE_TABLES[payload.scope].filter((name) => SERIAL_TABLES.includes(name)));
  });

  return { imported, skipped, warnings };
}

router.get("/export", requireAdminAuth, async (req, res) => {
  if (!isBackupScope(req.query.scope)) return res.status(400).json({ error: "Choose a valid backup export scope." });
  try {
    const backup = await exportBackup(req.query.scope);
    res.setHeader("Content-Disposition", `attachment; filename="ayden-therapy-${req.query.scope}-backup.json"`);
    res.json(backup);
  } catch (err) {
    req.log.error({ err }, "Failed to export backup");
    res.status(500).json({ error: "Backup export failed." });
  }
});

router.post("/import", requireAdminAuth, async (req, res) => {
  const body = req.body as { backup?: unknown; mode?: unknown };
  const backup = body.backup as Partial<BackupPayload> | undefined;
  if (!backup || backup.format !== "ayden-therapy-backup" || backup.version !== 1 || !isBackupScope(backup.scope) || !backup.tables || typeof backup.tables !== "object") return res.status(400).json({ error: "This file is not a supported Ayden backup." });
  if (body.mode !== undefined && body.mode !== "merge") return res.status(400).json({ error: "Backup imports currently support merge mode only." });
  try {
    const result = await importBackup(backup as BackupPayload);
    await recordAudit(req, "imported_backup", "backup", backup.scope, `Merged backup data: ${JSON.stringify(result.imported)}.`);
    res.json({ scope: backup.scope, importedAt: new Date().toISOString(), ...result });
  } catch (err) {
    req.log.error({ err }, "Failed to import backup");
    res.status(400).json({ error: err instanceof Error ? err.message : "Backup import failed." });
  }
});

export default router;
