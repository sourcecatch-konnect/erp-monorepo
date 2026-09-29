import { BadRequestError } from "../../../lib/error.js";

/**
 * Cursor paging over one or more ordered "eligible source" streams.
 *
 * Each source is ordered by (createdAt, id) in the database and knows how to
 * fetch the candidates strictly after a position and how to drop rows that are
 * already claimed by another slip. `pageMerged` k-way merges the sources into
 * one stream ordered by (createdAt, rank, id) and returns one chunk at a time,
 * so no fixed row cap is needed: the caller keeps asking for the next chunk
 * with `nextCursor` until it is null.
 *
 * Claimed rows are dropped per fetched batch (an indexed `sourceId IN (...)`
 * lookup) rather than by loading every claim in the system up front.
 */

/** A position in the merged stream. `rank` breaks ties between sources that
 *  share a `createdAt`, and is unique per source. */
export type StreamPosition = { createdAt: Date; rank: number; id: string };

export type StreamRow = { id: string; createdAt: Date };

export type StreamSource<Row extends StreamRow> = {
  rank: number;
  /** Candidates strictly after `after` in (createdAt, id) order, at most `take`. */
  fetch: (after: StreamPosition | null, take: number) => Promise<Row[]>;
  /** Returns the rows that are NOT already claimed by another slip. */
  dropClaimed: (rows: Row[]) => Promise<Row[]>;
};

export type StreamPage<Row> = { items: Row[]; nextCursor: string | null };

export const encodeCursor = (position: StreamPosition): string =>
  Buffer.from(
    JSON.stringify({
      c: position.createdAt.toISOString(),
      r: position.rank,
      i: position.id,
    }),
  ).toString("base64url");

export const decodeCursor = (raw: string): StreamPosition => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      c?: unknown;
      r?: unknown;
      i?: unknown;
    };
    const createdAt = new Date(String(parsed.c));
    if (
      typeof parsed.c !== "string" ||
      Number.isNaN(createdAt.getTime()) ||
      typeof parsed.r !== "number" ||
      !Number.isInteger(parsed.r) ||
      typeof parsed.i !== "string" ||
      !parsed.i
    ) {
      throw new Error("malformed cursor");
    }
    return { createdAt, rank: parsed.r, id: parsed.i };
  } catch {
    throw new BadRequestError("Invalid cursor");
  }
};

/**
 * Prisma `where` fragment selecting a source's rows strictly after `after`.
 * Combine it with other clauses through `AND: [...]` — it uses `OR` itself.
 */
export const afterPosition = (
  rank: number,
  after: StreamPosition | null,
): { OR?: ({ createdAt: { gt: Date } } | { createdAt: Date; id?: { gt: string } })[] } => {
  if (!after) return {};
  // Rows created at the very same instant as the cursor row: a later source
  // contributes all of them, the same source only the ones after the cursor
  // id, an earlier source none (it was already fully emitted for that instant).
  const sameInstant =
    rank > after.rank
      ? { createdAt: after.createdAt }
      : rank === after.rank
        ? { createdAt: after.createdAt, id: { gt: after.id } }
        : null;
  return {
    OR: [{ createdAt: { gt: after.createdAt } }, ...(sameInstant ? [sameInstant] : [])],
  };
};

type SourceState<Row extends StreamRow> = {
  source: StreamSource<Row>;
  buffer: Row[];
  done: boolean;
  after: StreamPosition | null;
};

export async function pageMerged<Row extends StreamRow>(
  sources: StreamSource<Row>[],
  cursor: StreamPosition | null,
  size: number,
): Promise<StreamPage<Row>> {
  // One extra row tells us whether another chunk exists without a count query.
  const need = size + 1;
  const states: SourceState<Row>[] = sources.map((source) => ({
    source,
    buffer: [],
    done: false,
    after: cursor,
  }));

  const refill = async (state: SourceState<Row>): Promise<void> => {
    // A whole batch can be claimed rows; keep scanning until something is
    // eligible or the source is exhausted.
    while (state.buffer.length === 0 && !state.done) {
      const rows = await state.source.fetch(state.after, need);
      if (rows.length < need) state.done = true;
      const last = rows.at(-1);
      if (last) {
        state.after = { createdAt: last.createdAt, rank: state.source.rank, id: last.id };
      }
      state.buffer = rows.length ? await state.source.dropClaimed(rows) : [];
    }
  };

  await Promise.all(states.map(refill));

  const merged: { row: Row; rank: number }[] = [];
  while (merged.length < need) {
    for (const state of states) await refill(state);
    const live = states.filter((state) => state.buffer.length > 0);
    if (live.length === 0) break;

    const next = live.reduce((best, state) => {
      const a = state.buffer[0]!;
      const b = best.buffer[0]!;
      const order =
        a.createdAt.getTime() - b.createdAt.getTime() ||
        state.source.rank - best.source.rank;
      return order < 0 ? state : best;
    });
    merged.push({ row: next.buffer.shift()!, rank: next.source.rank });
  }

  const items = merged.slice(0, size).map((entry) => entry.row);
  const last = merged[size - 1];
  return {
    items,
    nextCursor:
      merged.length > size && last
        ? encodeCursor({ createdAt: last.row.createdAt, rank: last.rank, id: last.row.id })
        : null,
  };
}
