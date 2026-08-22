/**
 * Redis-backed cache for the "eligible GRNs" list used by the VP loading
 * wizard (schedule -> VP No -> gate -> LR/GRN). Eligibility depends only on
 * the schedule's branch/area route (see getEligibleGRNsForRow), so every
 * wagon in the same schedule shares one cache entry keyed by that route —
 * a 15-wagon schedule computes this list once instead of once per wagon.
 *
 * Correctness relies on invalidateEligibleGrns being called after any write
 * that changes a GRN's allocated quantity (create/update/cancel an
 * allocation) — see the call sites in vp-loading.route.ts. The TTL below is
 * a safety net for a missed invalidation path, not the primary correctness
 * mechanism.
 *
 * Redis is treated as pure acceleration: any connection error degrades to a
 * cache miss (falls through to the DB) rather than failing the request.
 */
import { Redis } from "ioredis";
import { getRedisConnectionOptions } from "../notifications/redis.js";
import type { EligibilityScheduleRoute } from "./vp-loading.service.js";

const TTL_SECONDS = 300;
const KEY_PREFIX = "vpl:eligible-grns";

const globalForRedis = globalThis as unknown as {
  vpLoadingCacheClient?: Redis;
};

const getClient = (): Redis => {
  if (!globalForRedis.vpLoadingCacheClient) {
    globalForRedis.vpLoadingCacheClient = new Redis({
      ...getRedisConnectionOptions(),
      lazyConnect: true,
    });
    globalForRedis.vpLoadingCacheClient.on("error", (error) => {
      console.error("VP loading cache Redis error", error);
    });
  }
  return globalForRedis.vpLoadingCacheClient;
};

const routeCacheKey = (route: EligibilityScheduleRoute): string =>
  [
    KEY_PREFIX,
    route.fromBranchId,
    route.toBranchId,
    route.sourceAreaId,
    route.destinationAreaId,
  ].join(":");

export const getCachedEligibleGrns = async <T>(
  route: EligibilityScheduleRoute,
): Promise<T | null> => {
  try {
    const raw = await getClient().get(routeCacheKey(route));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.error("VP loading cache read failed", error);
    return null;
  }
};

export const setCachedEligibleGrns = async <T>(
  route: EligibilityScheduleRoute,
  data: T,
): Promise<void> => {
  try {
    await getClient().set(
      routeCacheKey(route),
      JSON.stringify(data),
      "EX",
      TTL_SECONDS,
    );
  } catch (error) {
    console.error("VP loading cache write failed", error);
  }
};

export const invalidateEligibleGrns = async (
  route: EligibilityScheduleRoute,
): Promise<void> => {
  try {
    await getClient().del(routeCacheKey(route));
  } catch (error) {
    console.error("VP loading cache invalidation failed", error);
  }
};
