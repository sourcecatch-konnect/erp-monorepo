import { db } from "../../../prisma/prisma.js";

/**
 * Audit log writer. Persists into the AuditLog table. Call from any mutation
 * that an admin would later need to justify — role / permission / user
 * access changes are the v1 scope. Extend to sensitive master mutations as
 * compliance needs grow.
 */

export type AuditAction =
  | "role.create"
  | "role.update"
  | "role.delete"
  | "role.permissions.update"
  | "user.role.update"
  | "user.permissions.update"
  | "user.branches.update";

export type AuditEntry = {
  actor: { id: string };
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export const recordAuditEntry = async (entry: AuditEntry): Promise<void> => {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actor.id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before === undefined ? undefined : (entry.before as object),
        after: entry.after === undefined ? undefined : (entry.after as object),
      },
    });
  } catch (err) {
    // Audit logging must never break the underlying mutation.
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record entry", err);
  }
};
