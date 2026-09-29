import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Redis } from "ioredis";
import { getRedisConnectionOptions } from "../notifications/redis.js";

/**
 * Read-through cache for expensive *derived* reads (scans, dashboard counts).
 * Never use it for data a financial decision is taken on without an explicit
 * invalidation path — see `invalidateCacheOnWrite`.
 *
 * Redis is pure acceleration. Every operation has a hard timeout and a circuit
 * breaker: if Redis is slow or down, callers fall straight through to the
 * loader (the shared BullMQ connection options retry forever, which would make
 * a cache read hang the request instead).
 *
 * Invalidation is by namespace version: writers bump `cache:<ns>:ver`, and
 * readers embed that version in the entry key, so a bump orphans every entry
 * of the namespace at once. The TTL is a backstop for a missed write path, not
 * the correctness mechanism.
 */

const KEY_PREFIX = "cache";
const OP_TIMEOUT_MS = 300;
const BREAKER_MS = 10_000;

let client: Redis | undefined;
let disabledUntil = 0;

const trip = (error: unknown): void => {
  if (Date.now() >= disabledUntil) {
    console.error(
      `[cache] Redis unavailable, bypassing cache for ${BREAKER_MS / 1000}s:`,
      error instanceof Error ? error.message : error,
    );
  }
  disabledUntil = Date.now() + BREAKER_MS;
};

const getClient = (): Redis => {
  if (!client) {
    client = new Redis({
      ...getRedisConnectionOptions(),
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    client.on("error", trip);
  }
  return client;
};

const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("cache operation timed out")),
      OP_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const redisOp = async <T>(
  op: (redis: Redis) => Promise<T>,
): Promise<T | undefined> => {
  if (Date.now() < disabledUntil) return undefined;
  try {
    return await withTimeout(op(getClient()));
  } catch (error) {
    trip(error);
    return undefined;
  }
};

const versionKey = (namespace: string): string =>
  `${KEY_PREFIX}:${namespace}:ver`;

// Bumped synchronously on every invalidation so concurrent-request coalescing
// below never hands a post-write caller a result computed before the write,
// even while Redis is unreachable.
const localVersions = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();

export const bumpCacheNamespace = async (namespace: string): Promise<void> => {
  localVersions.set(namespace, (localVersions.get(namespace) ?? 0) + 1);
  await redisOp((redis) => redis.incr(versionKey(namespace)));
};

type CacheOptions = {
  namespace: string;
  /** Everything the result depends on (scope, filters). Hashed into the key. */
  key: unknown;
  ttlSeconds: number;
};

export const cached = async <T>(
  { namespace, key, ttlSeconds }: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> => {
  const digest = createHash("sha1").update(JSON.stringify(key)).digest("hex");
  const remoteVersion =
    (await redisOp((redis) => redis.get(versionKey(namespace)))) ?? "0";
  const localVersion = localVersions.get(namespace) ?? 0;
  const dataKey = `${KEY_PREFIX}:${namespace}:${remoteVersion}:${digest}`;
  const flightKey = `${localVersion}:${dataKey}`;

  const pending = inflight.get(flightKey) as Promise<T> | undefined;
  if (pending) return pending;

  const run = (async (): Promise<T> => {
    const hit = await redisOp((redis) => redis.get(dataKey));
    if (hit) {
      try {
        return JSON.parse(hit) as T;
      } catch {
        // Corrupt entry — recompute and overwrite it.
      }
    }
    const value = await loader();
    await redisOp((redis) =>
      redis.set(dataKey, JSON.stringify(value), "EX", ttlSeconds),
    );
    return value;
  })().finally(() => {
    inflight.delete(flightKey);
  });

  inflight.set(flightKey, run);
  return run;
};

/**
 * Router middleware: any non-GET request bumps the given namespaces once the
 * response is done. Bumps regardless of status — a failed multi-step write may
 * still have partially applied, and an extra invalidation is only a cache miss.
 */
export const invalidateCacheOnWrite =
  (...namespaces: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      res.on("close", () => {
        for (const namespace of namespaces) void bumpCacheNamespace(namespace);
      });
    }
    next();
  };
