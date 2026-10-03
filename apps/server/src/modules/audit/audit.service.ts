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
  | "user.branches.update"
  | "vendor_payment.submit"
  | "vendor_payment.approve"
  | "vendor_payment.reject"
  | "vendor_payment.disburse"
  | "vendor_payment.cancel"
  | "driver_finance.salary_advance.create"
  | "driver_finance.salary_advance.reverse"
  | "driver_finance.payout.create"
  | "driver_finance.payout.reverse"
  | "driver_finance.salary_run.create"
  | "driver_finance.salary_run.approve"
  | "driver_finance.salary_run.pay"
  | "driver_finance.salary_run.cancel"
  | "driver_finance.salary_run.update_master_salary";

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
        before:
          entry.before === undefined ? undefined : (entry.before as object),
        after: entry.after === undefined ? undefined : (entry.after as object),
      },
    });
  } catch (err) {
    // Audit logging must never break the underlying mutation.
    console.error("[audit] failed to record entry", err);
  }
};
