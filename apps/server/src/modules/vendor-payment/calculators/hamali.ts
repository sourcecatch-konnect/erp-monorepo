import { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import { BadRequestError } from "../../../lib/error.js";
import { claimedAmong } from "./claims.js";
import {
  afterPosition,
  decodeCursor,
  pageMerged,
  type StreamPage,
  type StreamSource,
} from "./eligible-stream.js";

type DbClient = typeof db | Prisma.TransactionClient;

export type HamaliSourceType = "GRN_HAMALI" | "RAIL_BRANCH_GRN" | "VP_LOADING";

export type EligibleHamaliSource = {
  sourceType: HamaliSourceType;
  sourceId: string;
  /** Human label for the browse table — GRN number / rake+wagon gate / gate no. */
  label: string;
  branchId: string | null;
  occurredAt: Date | null;
  // Gross claimed amount, straight from the source record — the same figure
  // reconcileHamaliLines re-derives at create/update time.
  hamaliPaise: bigint;
};

export type FindEligibleHamaliSourcesParams = {
  labourId: string;
  /** Branches the caller may see (a chosen branch, or their scope). `undefined`
   *  means unrestricted; an empty list matches nothing. */
  branchIds?: string[];
  from?: Date;
  to?: Date;
  /** Matched in the database against the GRN no. / rake no. / gate no. */
  search?: string;
  /** `nextCursor` from the previous chunk; omit for the first chunk. */
  cursor?: string;
  size: number;
};

// A candidate as the merge sees it: the eligible source plus the (id,
// createdAt) key its stream is ordered by. `id` is the source record id, which
// is unique across the three tables.
type Candidate = EligibleHamaliSource & { id: string; createdAt: Date };

// Order in which sources win a tie on createdAt when merged.
const RANK: Record<HamaliSourceType, number> = {
  GRN_HAMALI: 0,
  RAIL_BRANCH_GRN: 1,
  VP_LOADING: 2,
};

const rangeOf = (from?: Date, to?: Date) => ({
  ...(from ? { gte: from } : {}),
  ...(to ? { lte: to } : {}),
});

const insensitive = (search: string) =>
  ({ contains: search, mode: "insensitive" }) as const;

/* Each source's "occurredAt" is COALESCE(first non-null of several columns),
 * and the from/to filter applies to that value. Prisma can't filter on a
 * COALESCE, so it is expressed as "the first non-null column is in range" —
 * exactly equivalent, and evaluated in the database. */

const grnFilters = (
  params: FindEligibleHamaliSourcesParams,
): Prisma.GRNWhereInput[] => {
  const range = rangeOf(params.from, params.to);
  const search = params.search?.trim();
  return [
    ...(params.from || params.to
      ? [
          {
            OR: [
              { outDateTime: range },
              { outDateTime: null, inDateTime: range },
              { outDateTime: null, inDateTime: null, createdAt: range },
            ],
          },
        ]
      : []),
    ...(params.branchIds
      ? [{ lorryReceipt: { group: { is: { originBranchId: { in: params.branchIds } } } } }]
      : []),
    ...(search ? [{ grnNumber: insensitive(search) }] : []),
  ];
};

const railBranchFilters = (
  params: FindEligibleHamaliSourcesParams,
): Prisma.RailBranchGRNWhereInput[] => {
  const range = rangeOf(params.from, params.to);
  const search = params.search?.trim();
  return [
    ...(params.from || params.to
      ? [
          {
            OR: [
              { outDateTime: range },
              { outDateTime: null, inDateTime: range },
              { outDateTime: null, inDateTime: null, submittedAt: range },
              {
                outDateTime: null,
                inDateTime: null,
                submittedAt: null,
                createdAt: range,
              },
            ],
          },
        ]
      : []),
    ...(params.branchIds ? [{ railRake: { toBranchId: { in: params.branchIds } } }] : []),
    ...(search ? [{ railRake: { rakeNumber: insensitive(search) } }] : []),
  ];
};

const vpLoadingFilters = (
  params: FindEligibleHamaliSourcesParams,
): Prisma.VPWagonLoadingWhereInput[] => {
  const range = rangeOf(params.from, params.to);
  const search = params.search?.trim();
  return [
    ...(params.from || params.to
      ? [
          {
            OR: [
              { loadingCompletedAt: range },
              { loadingCompletedAt: null, loadingStartedAt: range },
              { loadingCompletedAt: null, loadingStartedAt: null, createdAt: range },
            ],
          },
        ]
      : []),
    ...(params.branchIds
      ? [
          {
            mrRrRow: {
              mrRr: { vpSchedule: { is: { fromBranchId: { in: params.branchIds } } } },
            },
          },
        ]
      : []),
    ...(search ? [{ gateNo: insensitive(search) }] : []),
  ];
};

const dropClaimedFor =
  (client: DbClient, sourceType: HamaliSourceType) =>
  async (rows: Candidate[]): Promise<Candidate[]> => {
    const claimed = await claimedAmong(
      client,
      [sourceType],
      rows.map((row) => row.id),
    );
    return rows.filter((row) => !claimed.has(row.id));
  };

/** Origin GRN hamali — GRN.labourCharge paid to GRN.labourId, branch-scoped
 *  via the LR's origin branch. Eligible once SUBMITTED. */
const grnSource = (
  client: DbClient,
  params: FindEligibleHamaliSourcesParams,
): StreamSource<Candidate> => ({
  rank: RANK.GRN_HAMALI,
  fetch: async (after, take) => {
    const rows = await client.gRN.findMany({
      where: {
        AND: [
          {
            status: "SUBMITTED",
            labourId: params.labourId,
            labourCharge: { not: null },
            deletedAt: null,
          },
          ...grnFilters(params),
          afterPosition(RANK.GRN_HAMALI, after),
        ],
      },
      select: {
        id: true,
        grnNumber: true,
        labourCharge: true,
        outDateTime: true,
        inDateTime: true,
        createdAt: true,
        lorryReceipt: { select: { group: { select: { originBranchId: true } } } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      sourceType: "GRN_HAMALI" as const,
      sourceId: r.id,
      label: r.grnNumber,
      branchId: r.lorryReceipt.group.originBranchId,
      occurredAt: r.outDateTime ?? r.inDateTime ?? r.createdAt,
      hamaliPaise: r.labourCharge ?? 0n,
    }));
  },
  dropClaimed: dropClaimedFor(client, "GRN_HAMALI"),
});

/** Rail Branch GRN labour charge — paid to labourLeaderId, branch-scoped via
 *  the rail rake's destination branch. Eligible once SUBMITTED. */
const railBranchSource = (
  client: DbClient,
  params: FindEligibleHamaliSourcesParams,
): StreamSource<Candidate> => ({
  rank: RANK.RAIL_BRANCH_GRN,
  fetch: async (after, take) => {
    const rows = await client.railBranchGRN.findMany({
      where: {
        AND: [
          {
            status: "SUBMITTED",
            labourLeaderId: params.labourId,
            labourCharge: { not: null },
          },
          ...railBranchFilters(params),
          afterPosition(RANK.RAIL_BRANCH_GRN, after),
        ],
      },
      select: {
        id: true,
        labourCharge: true,
        outDateTime: true,
        inDateTime: true,
        submittedAt: true,
        createdAt: true,
        railRake: { select: { rakeNumber: true, toBranchId: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      sourceType: "RAIL_BRANCH_GRN" as const,
      sourceId: r.id,
      label: `Rake ${r.railRake.rakeNumber}`,
      branchId: r.railRake.toBranchId,
      occurredAt: r.outDateTime ?? r.inDateTime ?? r.submittedAt ?? r.createdAt,
      hamaliPaise: r.labourCharge ?? 0n,
    }));
  },
  dropClaimed: dropClaimedFor(client, "RAIL_BRANCH_GRN"),
});

/** VP Wagon Loading labour charge — paid to labourId, branch-scoped via the
 *  loading VP schedule's origin branch. Eligible once COMPLETED or VERIFIED. */
const vpLoadingSource = (
  client: DbClient,
  params: FindEligibleHamaliSourcesParams,
): StreamSource<Candidate> => ({
  rank: RANK.VP_LOADING,
  fetch: async (after, take) => {
    const rows = await client.vPWagonLoading.findMany({
      where: {
        AND: [
          {
            status: { in: ["COMPLETED", "VERIFIED"] },
            labourId: params.labourId,
            labourCharge: { not: null },
          },
          ...vpLoadingFilters(params),
          afterPosition(RANK.VP_LOADING, after),
        ],
      },
      select: {
        id: true,
        gateNo: true,
        labourCharge: true,
        loadingCompletedAt: true,
        loadingStartedAt: true,
        createdAt: true,
        mrRrRow: {
          select: { mrRr: { select: { vpSchedule: { select: { fromBranchId: true } } } } },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      sourceType: "VP_LOADING" as const,
      sourceId: r.id,
      label: r.gateNo ? `Gate ${r.gateNo}` : r.id,
      branchId: r.mrRrRow.mrRr.vpSchedule.fromBranchId,
      occurredAt: r.loadingCompletedAt ?? r.loadingStartedAt ?? r.createdAt,
      hamaliPaise: r.labourCharge ?? 0n,
    }));
  },
  dropClaimed: dropClaimedFor(client, "VP_LOADING"),
});

/**
 * Eligible = unreserved hamali amounts for this labour across all three
 * source types, branch-scoped, in range. Feeds the create-slip screen's
 * browse step — the three source types can be freely combined on one slip.
 *
 * Served one chunk at a time as a single merged stream (oldest record first);
 * there is no row cap — the caller pages on with `nextCursor`.
 */
export async function findEligibleHamaliSources(
  client: DbClient,
  params: FindEligibleHamaliSourcesParams,
): Promise<StreamPage<EligibleHamaliSource>> {
  const page = await pageMerged<Candidate>(
    [
      grnSource(client, params),
      railBranchSource(client, params),
      vpLoadingSource(client, params),
    ],
    params.cursor ? decodeCursor(params.cursor) : null,
    params.size,
  );

  return {
    items: page.items.map((candidate) => ({
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      label: candidate.label,
      branchId: candidate.branchId,
      occurredAt: candidate.occurredAt,
      hamaliPaise: candidate.hamaliPaise,
    })),
    nextCursor: page.nextCursor,
  };
}

/**
 * Re-derive hamaliPaise (gross) for a set of submitted source refs, straight
 * from the source record — never from client input. Also re-checks
 * eligibility (right labour, eligible status, not actively claimed by
 * another slip) so a stale/foreign/tampered ref fails loudly.
 * `excludeSlipId` lets a draft re-save its own already-claimed lines.
 */
export async function reconcileHamaliLines(
  client: DbClient,
  labourId: string,
  refs: { sourceType: HamaliSourceType; sourceId: string }[],
  excludeSlipId?: string,
): Promise<Map<string, bigint>> {
  if (refs.length === 0) return new Map();

  const claimed = await claimedAmong(
    client,
    ["GRN_HAMALI", "RAIL_BRANCH_GRN", "VP_LOADING"],
    refs.map((r) => r.sourceId),
    excludeSlipId,
  );
  const conflicting = refs.filter((r) => claimed.has(r.sourceId));
  if (conflicting.length)
    throw new BadRequestError(
      `These sources are already claimed by another vendor payment slip: ${conflicting
        .map((r) => r.sourceId)
        .join(", ")}`,
    );

  const idsByType = {
    GRN_HAMALI: refs.filter((r) => r.sourceType === "GRN_HAMALI").map((r) => r.sourceId),
    RAIL_BRANCH_GRN: refs
      .filter((r) => r.sourceType === "RAIL_BRANCH_GRN")
      .map((r) => r.sourceId),
    VP_LOADING: refs.filter((r) => r.sourceType === "VP_LOADING").map((r) => r.sourceId),
  };

  const [grnRows, railBranchRows, vpLoadingRows] = await Promise.all([
    idsByType.GRN_HAMALI.length
      ? client.gRN.findMany({
          where: { id: { in: idsByType.GRN_HAMALI }, status: "SUBMITTED", labourId },
          select: { id: true, labourCharge: true },
        })
      : Promise.resolve([]),
    idsByType.RAIL_BRANCH_GRN.length
      ? client.railBranchGRN.findMany({
          where: {
            id: { in: idsByType.RAIL_BRANCH_GRN },
            status: "SUBMITTED",
            labourLeaderId: labourId,
          },
          select: { id: true, labourCharge: true },
        })
      : Promise.resolve([]),
    idsByType.VP_LOADING.length
      ? client.vPWagonLoading.findMany({
          where: {
            id: { in: idsByType.VP_LOADING },
            status: { in: ["COMPLETED", "VERIFIED"] },
            labourId,
          },
          select: { id: true, labourCharge: true },
        })
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, bigint>();
  for (const r of grnRows) byId.set(r.id, r.labourCharge ?? 0n);
  for (const r of railBranchRows) byId.set(r.id, r.labourCharge ?? 0n);
  for (const r of vpLoadingRows) byId.set(r.id, r.labourCharge ?? 0n);

  const missing = refs.filter((r) => !byId.has(r.sourceId));
  if (missing.length)
    throw new BadRequestError(
      `These sources are not eligible for this labour: ${missing.map((r) => r.sourceId).join(", ")}`,
    );

  return byId;
}
