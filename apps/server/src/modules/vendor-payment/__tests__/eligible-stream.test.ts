import { describe, expect, it } from "vitest";

import {
  afterPosition,
  decodeCursor,
  encodeCursor,
  pageMerged,
  type StreamPosition,
  type StreamRow,
  type StreamSource,
} from "../calculators/eligible-stream.js";

type Row = StreamRow & { source: string };

const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

/** In-memory source that evaluates the real `afterPosition` fragment, ordered
 *  like the database would be: (createdAt, id). */
const makeSource = (
  name: string,
  rank: number,
  rows: { id: string; ms: number }[],
  claimed: Set<string> = new Set(),
  onFetch?: () => void,
): StreamSource<Row> => {
  const data: Row[] = rows
    .map((r) => ({ id: r.id, createdAt: at(r.ms), source: name }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

  return {
    rank,
    fetch: async (after, take) => {
      onFetch?.();
      const fragment = afterPosition(rank, after);
      const matches = (row: Row) =>
        !fragment.OR ||
        fragment.OR.some((clause) => {
          const gt = (clause.createdAt as { gt?: Date }).gt;
          if (gt) return row.createdAt.getTime() > gt.getTime();
          const same = clause.createdAt as Date;
          if (row.createdAt.getTime() !== same.getTime()) return false;
          return "id" in clause && clause.id ? row.id > clause.id.gt : true;
        });
      return data.filter(matches).slice(0, take);
    },
    dropClaimed: async (batch) => batch.filter((row) => !claimed.has(row.id)),
  };
};

const drain = async (sources: StreamSource<Row>[], size: number) => {
  const pages: string[][] = [];
  let cursor: StreamPosition | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const page = await pageMerged(sources, cursor, size);
    pages.push(page.items.map((r) => r.id));
    if (!page.nextCursor) return pages;
    cursor = decodeCursor(page.nextCursor);
  }
  throw new Error("paging did not terminate");
};

describe("pageMerged", () => {
  it("pages one source in chunks without repeating or skipping rows", async () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const src = makeSource("S", 0, ids.map((id, i) => ({ id, ms: i * 10 })));
    expect(await drain([src], 3)).toEqual([["a", "b", "c"], ["d", "e", "f"], ["g"]]);
  });

  it("ends with a null cursor when the rows exactly fill the last chunk", async () => {
    const src = makeSource("S", 0, [
      { id: "a", ms: 1 },
      { id: "b", ms: 2 },
    ]);
    const page = await pageMerged([src], null, 2);
    expect(page.items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBeNull();
  });

  it("merges several sources by createdAt and breaks ties by source rank", async () => {
    const grn = makeSource("grn", 0, [
      { id: "g1", ms: 10 },
      { id: "g2", ms: 40 },
    ]);
    const rail = makeSource("rail", 1, [
      { id: "r1", ms: 10 },
      { id: "r2", ms: 30 },
    ]);
    const vp = makeSource("vp", 2, [
      { id: "v1", ms: 20 },
      { id: "v2", ms: 40 },
    ]);
    const pages = await drain([grn, rail, vp], 2);
    expect(pages.flat()).toEqual(["g1", "r1", "v1", "r2", "g2", "v2"]);
  });

  it("returns every row exactly once regardless of chunk size", async () => {
    const mk = () => [
      makeSource("a", 0, Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, ms: (i % 4) * 5 }))),
      makeSource("b", 1, Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, ms: (i % 3) * 5 }))),
    ];
    const reference = (await drain(mk(), 100)).flat();
    for (const size of [1, 2, 3, 5, 7]) {
      const paged = (await drain(mk(), size)).flat();
      expect(paged).toEqual(reference);
      expect(new Set(paged).size).toBe(15);
    }
  });

  it("drops claimed rows and still fills the chunk by scanning past them", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, ms: i }));
    const claimed = new Set(["r0", "r1", "r2", "r3", "r4", "r5"]);
    const src = makeSource("S", 0, rows, claimed);
    const page = await pageMerged([src], null, 2);
    expect(page.items.map((r) => r.id)).toEqual(["r6", "r7"]);
    expect(page.nextCursor).not.toBeNull();
  });

  it("returns an empty final chunk when everything is claimed", async () => {
    const src = makeSource("S", 0, [{ id: "a", ms: 1 }, { id: "b", ms: 2 }], new Set(["a", "b"]));
    expect(await pageMerged([src], null, 5)).toEqual({ items: [], nextCursor: null });
  });

  it("does not re-fetch a source once it is exhausted", async () => {
    let fetches = 0;
    const src = makeSource("S", 0, [{ id: "a", ms: 1 }], new Set(), () => {
      fetches += 1;
    });
    await pageMerged([src], null, 5);
    expect(fetches).toBe(1);
  });
});

describe("cursor", () => {
  it("round-trips a position", () => {
    const position: StreamPosition = { createdAt: at(1234), rank: 2, id: "cabc123" };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each(["", "not-a-cursor", Buffer.from("{}").toString("base64url")])(
    "rejects a malformed cursor (%j)",
    (raw) => {
      expect(() => decodeCursor(raw)).toThrow("Invalid cursor");
    },
  );
});
