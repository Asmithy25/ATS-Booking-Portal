import { Router } from "express";
import { asc, eq, sql } from "drizzle-orm";
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
  messageTemplatesTable,
  collaborationItemsTable,
  clientTemplatesTable,
  clientNotificationsTable,
} from "@workspace/db";
import { requireAdminAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();

type BackupScope = "bookings" | "settings" | "site-data" | "everything";
type BackupRow = Record<string, unknown>;
type BackupPayload = {
  format: "ayden-therapy-backup";
  version: 1;
  scope: BackupScope;
  exportedAt: string;
  tables: Record<string, BackupRow[]>;
  counts: Record<string, number>;
};

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
  messageTemplates: messageTemplatesTable,
  collaborationItems: collaborationItemsTable,
  clientTemplates: clientTemplatesTable,
  clientNotifications: clientNotificationsTable,
} as const;

const SCOPE_TABLES: Record<BackupScope, readonly string[]> = {
  bookings: ["bookings"],
  settings: ["settings"],
  "site-data": [
    "clientAccounts",
    "staffAccounts",
    "announcements",
    "auditLogs",
    "supportThreads",
    "supportMessages",
    "wellnessResources",
    "messageTemplates",
    "collaborationItems",
    "clientTemplates",
    "clientNotifications",
  ],
  everything: Object.keys(TABLES),
};

const DATE_FIELDS: Record<string, readonly string[]> = {
  settings: [],
  bookings: ["createdAt"],
  clientAccounts: ["createdAt", "updatedAt"],
  staffAccounts: ["createdAt"],
  announcements: ["createdAt"],
  auditLogs: ["createdAt"],
  supportThreads: ["createdAt", "updatedAt"],
  supportMessages: ["createdAt"],
  wellnessResources: ["createdAt"],
  messageTemplates: ["updatedAt"],
  collaborationItems: ["createdAt", "updatedAt"],
  clientTemplates: ["updatedAt"],
  clientNotifications: ["createdAt"],
};

const SERIAL_TABLES = [
  "settings",
  "bookings",
  "clientAccounts",
  "staffAccounts",
  "announcements",
  "auditLogs",
  "supportThreads",
  "supportMessages",
  "wellnessResources",
  "messageTemplates",
  "collaborationItems",
  "clientTemplates",
  "clientNotifications",
] as const;

function isBackupScope(value: unknown): value is BackupScope {
  return value === "bookings" || value === "settings" || value === "site-data" || value === "everything";
}

function toExportRow(tableName: string, row: Record<string, unknown>): BackupRow {
  const exported = { ...row };
  if (tableName === "clientAccounts" || tableName === "staffAccounts") {
    delete exported.passwordHash;
  }
  return exported;
}

function toDate(value: unknown, field: string, tableName: string) {
  if (typeof value !== "string") {
    throw new Error(`${tableName}.${field} must be an ISO date-time string.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${tableName}.${field} is not a valid date-time.`);
  }
  return parsed;
}

function projectRows(tableName: string, rows: unknown): BackupRow[] {
  if (!Array.isArray(rows)) {
    throw new Error(`${tableName} must be an array.`);
  }

  return rows.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${tableName}[${index}] must be an object.`);
    }

    const row = { ...(value as BackupRow) };
    if (row.id !== undefined && (!Number.isInteger(row.id) || Number(row.id) < 1)) {
      throw new Error(`${tableName}[${index}].id must be a positive integer.`);
    }
    for (const field of DATE_FIELDS[tableName] ?? []) {
      if (row[field] !== undefined) row[field] = toDate(row[field], field, tableName);
    }
    if (tableName === "clientAccounts" || tableName === "staffAccounts") {
      delete row.passwordHash;
    }
    return row;
  });
}

function withoutId(row: BackupRow) {
  const { id: _id, ...rest } = row;
  return rest;
}

function withoutKeys(row: BackupRow, keys: string[]) {
  const result = { ...row };
  for (const key of keys) delete result[key];
  return result;
}

async function exportBackup(scope: BackupScope): Promise<BackupPayload> {
  const tables: Record<string, BackupRow[]> = {};
  const counts: Record<string, number> = {};

  for (const tableName of SCOPE_TABLES[scope]) {
    const table = TABLES[tableName as keyof typeof TABLES] as any;
    const rows = await db.select().from(table).orderBy(asc(table.id));
    tables[tableName] = rows.map((row: Record<string, unknown>) => toExportRow(tableName, row));
    counts[tableName] = rows.length;
  }

  return {
    format: "ayden-therapy-backup",
    version: 1,
    scope,
    exportedAt: new Date().toISOString(),
    tables,
    counts,
  };
}

async function upsertRowsById(tx: any, table: any, rows: BackupRow[]) {
  let imported = 0;
  for (const row of rows) {
    if (row.id === undefined) {
      await tx.insert(table).values(row);
    } else {
      await tx.insert(table).values(row).onConflictDoUpdate({
        target: table.id,
        set: withoutId(row),
      });
    }
    imported += 1;
  }
  return imported;
}

async function resetSequences(tx: any, tableNames: readonly string[]) {
  for (const tableName of tableNames) {
    await tx.execute(sql.raw(
      `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), (SELECT MAX(id) IS NOT NULL FROM "${tableName}"))`,
    ));
  }
}

async function importBackup(payload: BackupPayload) {
  const tables = payload.tables;
  const imported: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const warnings: string[] = [];
  const rowsByTable: Record<string, BackupRow[]> = {};

  for (const tableName of SCOPE_TABLES[payload.scope]) {
    rowsByTable[tableName] = projectRows(tableName, tables[tableName] ?? []);
  }

  await db.transaction(async (tx) => {
    if (rowsByTable.settings?.length) {
      const [current] = await tx.select().from(settingsTable).orderBy(asc(settingsTable.id)).limit(1);
      const settings = withoutId(rowsByTable.settings[0]);
      if (current) {
        await tx.update(settingsTable).set(settings as any).where(eq(settingsTable.id, current.id));
      } else {
        await tx.insert(settingsTable).values(settings as any);
      }
      imported.settings = 1;
      if (rowsByTable.settings.length > 1) {
        skipped.settings = rowsByTable.settings.length - 1;
        warnings.push("Only the first settings record was restored because site settings use a singleton record.");
      }
    }

    if (rowsByTable.clientAccounts?.length) {
      for (const row of rowsByTable.clientAccounts) {
        if (typeof row.email !== "string" || !row.email.trim()) {
          throw new Error("Every client account must include an email address.");
        }
        const [existing] = await tx.select({ id: clientAccountsTable.id })
          .from(clientAccountsTable)
          .where(eq(clientAccountsTable.email, row.email))
          .limit(1);
        if (!existing) {
          skipped.clientAccounts = (skipped.clientAccounts ?? 0) + 1;
          continue;
        }
        await tx.update(clientAccountsTable)
          .set(withoutKeys(row, ["id", "email"]) as any)
          .where(eq(clientAccountsTable.id, existing.id));
        imported.clientAccounts = (imported.clientAccounts ?? 0) + 1;
      }
      if (skipped.clientAccounts) {
        warnings.push("New client login accounts were not created because backups never contain passwords. Existing profiles were merged by email.");
      }
    }

    if (rowsByTable.staffAccounts?.length) {
      for (const row of rowsByTable.staffAccounts) {
        if (typeof row.email !== "string" || !row.email.trim()) {
          throw new Error("Every staff account must include an email address.");
        }
        const [existing] = await tx.select({ id: staffAccountsTable.id })
          .from(staffAccountsTable)
          .where(eq(staffAccountsTable.email, row.email))
          .limit(1);
        if (!existing) {
          skipped.staffAccounts = (skipped.staffAccounts ?? 0) + 1;
          continue;
        }
        await tx.update(staffAccountsTable)
          .set(withoutKeys(row, ["id", "email"]) as any)
          .where(eq(staffAccountsTable.id, existing.id));
        imported.staffAccounts = (imported.staffAccounts ?? 0) + 1;
      }
      if (skipped.staffAccounts) {
        warnings.push("New staff login accounts were not created because backups never contain passwords. Existing profiles were merged by email.");
      }
    }

    if (rowsByTable.bookings?.length) {
      for (const row of rowsByTable.bookings) {
        if (typeof row.confirmationCode !== "string" || !row.confirmationCode.trim()) {
          throw new Error("Every booking must include a confirmation code.");
        }
        const [existing] = await tx.select({ id: bookingsTable.id })
          .from(bookingsTable)
          .where(eq(bookingsTable.confirmationCode, row.confirmationCode))
          .limit(1);
        if (existing) {
          await tx.update(bookingsTable)
            .set(withoutKeys(row, ["id", "confirmationCode"]) as any)
            .where(eq(bookingsTable.id, existing.id));
        } else {
          await tx.insert(bookingsTable).values(row as any);
        }
        imported.bookings = (imported.bookings ?? 0) + 1;
      }
    }

    const idTables = [
      ["announcements", announcementsTable],
      ["auditLogs", auditLogsTable],
      ["supportThreads", supportThreadsTable],
      ["supportMessages", supportMessagesTable],
      ["wellnessResources", wellnessResourcesTable],
      ["collaborationItems", collaborationItemsTable],
      ["clientNotifications", clientNotificationsTable],
    ] as const;
    for (const [tableName, table] of idTables) {
      if (rowsByTable[tableName]?.length) {
        imported[tableName] = await upsertRowsById(tx, table, rowsByTable[tableName]);
      }
    }

    for (const [tableName, table] of [
      ["messageTemplates", messageTemplatesTable],
      ["clientTemplates", clientTemplatesTable],
    ] as const) {
      if (!rowsByTable[tableName]?.length) continue;
      for (const row of rowsByTable[tableName]) {
        if (typeof row.key !== "string" || !row.key.trim()) {
          throw new Error(`Every ${tableName} record must include a key.`);
        }
        await tx.insert(table).values(row as any).onConflictDoUpdate({
          target: table.key,
          set: withoutKeys(row, ["id", "key"]),
        });
        imported[tableName] = (imported[tableName] ?? 0) + 1;
      }
    }

    await resetSequences(tx, SCOPE_TABLES[payload.scope].filter((name) => SERIAL_TABLES.includes(name as typeof SERIAL_TABLES[number])));
  });

  return { imported, skipped, warnings };
}

router.get("/export", requireAdminAuth, async (req, res): Promise<void> => {
  const scope = req.query.scope;
  if (!isBackupScope(scope)) {
    res.status(400).json({ error: "Choose a valid backup export scope." });
    return;
  }

  try {
    const backup = await exportBackup(scope);
    res.setHeader("Content-Disposition", `attachment; filename="ayden-therapy-${scope}-backup.json"`);
    res.json(backup);
  } catch (err) {
    req.log.error({ err }, "Failed to export backup");
    res.status(500).json({ error: "Backup export failed." });
  }
});

router.post("/import", requireAdminAuth, async (req, res): Promise<void> => {
  const body = req.body as { backup?: unknown; mode?: unknown };
  const payload = body?.backup;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ error: "Choose a valid Ayden backup JSON file." });
    return;
  }
  const backup = payload as Partial<BackupPayload>;
  if (backup.format !== "ayden-therapy-backup" || backup.version !== 1 || !isBackupScope(backup.scope) || !backup.tables || typeof backup.tables !== "object") {
    res.status(400).json({ error: "This file is not a supported Ayden backup." });
    return;
  }
  if (body.mode !== undefined && body.mode !== "merge") {
    res.status(400).json({ error: "Backup imports currently support merge mode only." });
    return;
  }

  try {
    const result = await importBackup(backup as BackupPayload);
    await recordAudit(req, "imported_backup", "backup", backup.scope, `Merged backup data: ${JSON.stringify(result.imported)}.`);
    res.json({ scope: backup.scope, importedAt: new Date().toISOString(), ...result });
  } catch (err) {
    req.log.error({ err }, "Failed to import backup");
    const message = err instanceof Error ? err.message : "Backup import failed.";
    res.status(400).json({ error: message });
  }
});

export default router;