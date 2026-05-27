import { Request } from "express";
import { ForbiddenError } from "../lib/error.js";

/**
 * Branch scoping helper.
 *
 * Returns a Prisma `where` fragment that constrains a query to the branches
 * the current user can see. For users with branchScope=ALL, returns `{}` —
 * no constraint. For ASSIGNED users, returns `{ [field]: { in: branchIds } }`.
 *
 * Pass the actual scalar field on the queried model (often `branchId`, but
 * some models use `fromBranchId` / `toBranchId` / `leadGeneratedByBranchId`).
 *
 *   prisma.lorryReceipt.findMany({
 *     where: { ...branchFilter(req), status: "in_transit" },
 *   });
 *
 * On write paths, validate the body's branchId against `req.ctx.branchIds`
 * with `assertBranchAccess(req, body.branchId)` BEFORE inserting/updating.
 */
export const branchFilter = (
  req: Request,
  field: string = "branchId"
): Record<string, unknown> => {
  if (!req.ctx) return {};
  if (req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) {
    // Assigned scope but no branches — user sees nothing. Use an
    // impossible filter to avoid leaking data on a misconfiguration.
    return { [field]: { in: [] } };
  }
  return { [field]: { in: req.ctx.branchIds } };
};

/**
 * Throw if a write touches a branch outside the user's scope.
 */
export const assertBranchAccess = (req: Request, branchId: string): void => {
  if (!req.ctx) {
    throw new ForbiddenError("Not authenticated");
  }
  if (req.ctx.branchScope === "ALL") return;
  if (!req.ctx.branchIds.includes(branchId)) {
    throw new ForbiddenError("Branch not in scope");
  }
};
