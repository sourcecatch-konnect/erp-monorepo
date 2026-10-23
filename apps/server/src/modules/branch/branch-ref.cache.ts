import { db } from "../../../prisma/prisma.js";
import { NotFoundError } from "../../lib/error.js";

/**
 * Branch id → { name, branchCode }, kept in memory. Document numbers need the
 * branch code on every money save, and branches almost never change, so this
 * saves a database round trip per save.
 *
 * Cleared by the Branch master on every update/delete. The TTL covers a
 * second server instance, which doesn't see that clear.
 */
export type BranchRef = { id: string; name: string; branchCode: string };

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { ref: BranchRef; expiresAt: number }>();

/** The cached branch, or undefined when it isn't (freshly) cached. */
export const peekBranchRef = (branchId: string): BranchRef | undefined => {
  const hit = cache.get(branchId);
  return hit && hit.expiresAt > Date.now() ? hit.ref : undefined;
};

export const getBranchRef = async (branchId: string): Promise<BranchRef> => {
  const hit = peekBranchRef(branchId);
  if (hit) return hit;
  const ref = await db.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, branchCode: true },
  });
  if (!ref) throw new NotFoundError("Branch not found");
  cache.set(branchId, { ref, expiresAt: Date.now() + TTL_MS });
  return ref;
};

/** Forget one branch (after an edit/delete), or all of them. */
export const forgetBranchRef = (branchId?: string): void => {
  if (branchId) cache.delete(branchId);
  else cache.clear();
};
