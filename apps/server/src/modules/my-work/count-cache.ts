/**
 * The sidebar badge's count, cached per user.
 *
 * `GET /my-work/count` fans out to one count query per queue — up to 29 of
 * them — and the badge sits on every screen in the app, for every signed-in
 * user. Without a cache that is the heaviest query path we have, and it
 * exists only to print a number next to a nav link.
 *
 * A short TTL is the right trade: the badge is a nudge, not a ledger, and a
 * count that is up to a minute stale costs nothing. The page itself
 * (`GET /my-work`) is never cached — that one has to be live.
 *
 * Single-instance only, same as auth/permission-cache.ts. Swap both to Redis
 * together when horizontal scaling lands.
 */

type Entry = { value: number; expiresAt: number };

const TTL_MS = 60 * 1000;
/** Keeps a long-running process from growing without bound. */
const MAX_ENTRIES = 5_000;

const cache = new Map<string, Entry>();

/** Scope is part of the key: the same user filtered to a branch is a different count. */
const keyFor = (userId: string, branchId: string | null) =>
  branchId ? `${userId}:${branchId}` : userId;

export const getCachedCount = async (
  userId: string,
  branchId: string | null,
  compute: () => Promise<number>,
): Promise<number> => {
  const key = keyFor(userId, branchId);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await compute();

  // Cheapest possible eviction: the entries are tiny and all expire within a
  // minute, so dropping everything beats tracking per-entry recency.
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
};

/**
 * Drop a user's cached count. Worth calling where an action obviously empties
 * a queue, so the badge does not sit on a stale number for a minute.
 */
export const invalidateCount = (userId: string) => {
  for (const key of cache.keys()) {
    if (key === userId || key.startsWith(`${userId}:`)) cache.delete(key);
  }
};

export const clearCountCache = () => cache.clear();
