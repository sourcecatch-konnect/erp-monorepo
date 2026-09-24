import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Force an unreachable Redis so these tests exercise the degrade-to-loader path
// deterministically, whether or not a real Redis happens to be running locally.
let cached: typeof import("../cache.js").cached;
let bumpCacheNamespace: typeof import("../cache.js").bumpCacheNamespace;
const previousRedisUrl = process.env.REDIS_URL;

beforeAll(async () => {
  process.env.REDIS_URL = "redis://127.0.0.1:1";
  ({ cached, bumpCacheNamespace } = await import("../cache.js"));
  // The first Redis call pays its timeout before the breaker opens; absorb that
  // here so every test below sees the immediate fall-through path.
  await cached({ namespace: "warmup", key: 0, ttlSeconds: 1 }, async () => 0);
});

afterAll(() => {
  if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = previousRedisUrl;
});

const opts = (key: unknown, namespace = "test-ns") => ({
  namespace,
  key,
  ttlSeconds: 30,
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("cached", () => {
  it("falls through to the loader when Redis is unreachable", async () => {
    const value = await cached(opts({ a: 1 }), async () => "loaded");
    expect(value).toBe("loaded");
  });

  it("coalesces concurrent calls with the same key into one load", async () => {
    let calls = 0;
    const gate = deferred<string>();
    const loader = () => {
      calls += 1;
      return gate.promise;
    };

    const first = cached(opts({ scope: "x" }, "coalesce"), loader);
    const second = cached(opts({ scope: "x" }, "coalesce"), loader);
    // Both callers must have registered before the loader settles.
    await new Promise((r) => setTimeout(r, 50));
    gate.resolve("shared");

    expect(await first).toBe("shared");
    expect(await second).toBe("shared");
    expect(calls).toBe(1);
  });

  it("does not share a load between different keys", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return calls;
    };
    await Promise.all([
      cached(opts({ scope: "a" }, "distinct"), loader),
      cached(opts({ scope: "b" }, "distinct"), loader),
    ]);
    expect(calls).toBe(2);
  });

  it("does not hand a post-invalidation caller a load that started before the write", async () => {
    let calls = 0;
    const gate = deferred<string>();
    const slowStale = () => {
      calls += 1;
      return gate.promise;
    };
    const fresh = async () => {
      calls += 1;
      return "fresh";
    };

    const before = cached(opts({ scope: "y" }, "bump"), slowStale);
    await new Promise((r) => setTimeout(r, 50));
    await bumpCacheNamespace("bump");
    const after = cached(opts({ scope: "y" }, "bump"), fresh);

    expect(await after).toBe("fresh");
    gate.resolve("stale");
    expect(await before).toBe("stale");
    expect(calls).toBe(2);
  });

  it("propagates loader errors and clears the in-flight entry", async () => {
    await expect(
      cached(opts({ scope: "z" }, "errors"), async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const value = await cached(opts({ scope: "z" }, "errors"), async () => "ok");
    expect(value).toBe("ok");
  });
});
