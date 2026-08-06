import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";
import type { RequestWithSession } from "../middleware/auth";

export async function recordAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  details?: string,
): Promise<void> {
  const actor = (req as RequestWithSession).staffSession;
  if (!actor) return;
  await db.insert(auditLogsTable).values({
    actorEmail: actor.email,
    actorName: actor.name,
    action,
    entityType,
    entityId,
    details,
  });
}