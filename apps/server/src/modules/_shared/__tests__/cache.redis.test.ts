import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, sets } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  sets: [] as { key: string; mode?: string; ttl?: number }[],
}));

// In-memory stand-in for the three commands cache.ts uses.
vi.mock("ioredis", () => ({
  Redis: class {
    on() {
      return this;
    }
    async get(key: string) {
      return store.get(key) ?? null;
    }
    async set(key: string, value: string, mode?: string, ttl?: number) {
      store.set(key, value);
      sets.push({ key, mode, ttl });
      return "OK";
    }
    async incr(key: string) {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    }
  },
}));

import { bumpCacheNamespace, cached, invalidateCacheOnWrite } from "../cache.js";

const opts = (key: unknown, namespace = "ns") => ({
  namespace,
  key,
  ttlSeconds: 45,
});

beforeEach(() => {
  store.clear();
  sets.length = 0;
});

describe("cached (Redis available)", () => {
  it("serves the second identical call from cache", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { rows: [1, 2, 3] };
    };

    const first = await cached(opts({ scope: "a" }), loader);
    const second = await cached(opts({ scope: "a" }), loader);

    expect(first).toEqual({ rows: [1, 2, 3] });
    expect(second).toEqual({ rows: [1, 2, 3] });
    expect(calls).toBe(1);
  });

  it("stores entries with the configured TTL", async () => {
    await cached(opts({ scope: "ttl" }), async () => "v");
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ mode: "EX", ttl: 45 });
  });

  it("keeps different keys and namespaces apart", async () => {
    let calls = 0;
    const loader = async () => ++calls;

    const a = await cached(opts({ scope: "a" }), loader);
    const b = await cached(opts({ scope: "b" }), loader);
    const otherNs = await cached(opts({ scope: "a" }, "other"), loader);

    expect([a, b, otherNs]).toEqual([1, 2, 3]);
  });

  it("recomputes after the namespace is bumped, but only for that namespace", async () => {
    let billing = 0;
    let stats = 0;
    const loadBilling = async () => ++billing;
    const loadStats = async () => ++stats;

    await cached(opts({ q: 1 }, "billing"), loadBilling);
    await cached(opts({ q: 1 }, "stats"), loadStats);
    await bumpCacheNamespace("billing");

    expect(await cached(opts({ q: 1 }, "billing"), loadBilling)).toBe(2);
    expect(await cached(opts({ q: 1 }, "stats"), loadStats)).toBe(1);
  });

  it("recomputes and overwrites a corrupt cache entry", async () => {
    let calls = 0;
    const loader = async () => ++calls;
    await cached(opts({ scope: "c" }), loader);

    for (const key of store.keys()) {
      if (!key.endsWith(":ver")) store.set(key, "{not json");
    }

    expect(await cached(opts({ scope: "c" }), loader)).toBe(2);
    expect(await cached(opts({ scope: "c" }), loader)).toBe(2);
    expect(calls).toBe(2);
  });
});

describe("invalidateCacheOnWrite", () => {
  const run = (method: string) => {
    const res = new EventEmitter() as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    invalidateCacheOnWrite("ns-a", "ns-b")({ method } as Request, res, next);
    (res as unknown as EventEmitter).emit("close");
    return next;
  };

  it("bumps every namespace after a write request finishes", async () => {
    const next = run("POST");
    await vi.waitFor(() => {
      expect(store.get("cache:ns-a:ver")).toBe("1");
      expect(store.get("cache:ns-b:ver")).toBe("1");
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["GET", "HEAD", "OPTIONS"])("leaves the cache alone for %s", async (method) => {
    const next = run(method);
    await new Promise((r) => setTimeout(r, 20));
    expect(store.size).toBe(0);
    expect(next).toHaveBeenCalledOnce();
  });
});
