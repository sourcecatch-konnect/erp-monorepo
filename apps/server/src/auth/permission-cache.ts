import { resolvePermissions, type UserPermissionContext } from "./permission-resolver.js";

/**
 * In-memory permission cache. Single-instance deployments only — see
 * docs/RBAC_PLAN.md §2.5. Swap to a Redis-backed implementation with the
 * same shape when horizontal scaling lands.
 */

type Entry = {
  context: UserPermissionContext;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, Entry>();

export const getPermissionContext = async (
  userId: string
): Promise<UserPermissionContext | null> => {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.context;

  const fresh = await resolvePermissions(userId);
  if (!fresh) {
    cache.delete(userId);
    return null;
  }
  cache.set(userId, { context: fresh, expiresAt: Date.now() + TTL_MS });
  return fresh;
};

/**
 * Invalidate a single user. Call after:
 *   - User.roleId change
 *   - UserPermission change
 *   - UserBranch change
 *   - User.branchScope change
 */
export const invalidateUser = (userId: string): void => {
  cache.delete(userId);
};

/**
 * Invalidate every cached entry. Call after a Role or RolePermission mutation
 * — those affect every user holding that role and we don't track reverse
 * membership.
 */
export const invalidateAll = (): void => {
  cache.clear();
};

/**
 * For tests / introspection only.
 */
export const __cacheSize = (): number => cache.size;
