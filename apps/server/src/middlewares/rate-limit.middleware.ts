import type { NextFunction, Request, Response } from "express";
import { sendError } from "../modules/_shared/response.js";

type Bucket = { count: number; resetAt: number };

type RateLimitOptions = {
  /** Namespace so unrelated limiters never share a bucket. */
  name: string;
  /** Rolling window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per key within one window. */
  max: number;
  /** Builds the bucket key for a request (e.g. client IP + email). */
  key: (req: Request) => string;
};

/**
 * In-memory fixed-window rate limiter — no external dependency.
 *
 * Single-instance only, same caveat as the permission cache
 * (`apps/server/src/auth/permission-cache.ts`): swap for a Redis token bucket
 * when horizontal scaling lands.
 *
 * Each key gets `max` hits per `windowMs`. Once the window elapses the counter
 * resets completely, so a blocked caller can try again after the window — the
 * exact wait is returned in the `Retry-After` header (seconds).
 */
export const rateLimit = (opts: RateLimitOptions) => {
  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Opportunistic cleanup so the map can't grow without bound.
    if (buckets.size > 5000) sweep(now);

    const key = `${opts.name}:${opts.key(req)}`;
    const current = buckets.get(key);
    const bucket: Bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + opts.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, opts.max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > opts.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
      res.setHeader("Retry-After", String(retryAfterSec));

      return sendError(res, 429, {
        code: "TOO_MANY_REQUESTS",
        message: `Too many attempts. Please try again in ${mins} minute${
          mins === 1 ? "" : "s"
        }.`,
        details: null,
      });
    }

    return next();
  };
};

/** Client IP, tolerant of a missing `trust proxy` setting. */
export const clientIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || "unknown";
