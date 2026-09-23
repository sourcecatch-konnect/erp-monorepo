import { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import { BadRequestError } from "../../../lib/error.js";

type DbClient = typeof db | Prisma.TransactionClient;

export type HamaliSourceType = "GRN_HAMALI" | "RAIL_BRANCH_GRN" | "VP_LOADING";
const HAMALI_SOURCE_TYPES: readonly HamaliSourceType[] = [
  "GRN_HAMALI",
  "RAIL_BRANCH_GRN",
  "VP_LOADING",
];

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
  branchId?: string;
  from?: Date;
  to?: Date;
};

/** Active claims across all three hamali source types — a draft's own
 *  current lines never block its own re-save (excludeSlipId). */
async function claimedSourceIds(
  client: DbClient,
  excludeSlipId?: string,
): Promise<Set<string>> {
  const claims = await client.vendorPaymentSlipLine.findMany({
    where: {
      sourceType: { in: [...HAMALI_SOURCE_TYPES] },
      isActive: true,
      ...(excludeSlipId ? { slipId: { not: excludeSlipId } } : {}),
    },
    select: { sourceId: true },
  });
  return new Set(claims.map((c) => c.sourceId));
}

const inDateRange = (date: Date | null, from?: Date, to?: Date): boolean => {
  if (!from && !to) return true;
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

/** Origin GRN hamali — GRN.labourCharge paid to GRN.labourId, branch-scoped
 *  via the LR's origin branch. Eligible once SUBMITTED. */
async function fetchGrnHamali(
  client: DbClient,
  labourId: string,
  branchId?: string,
): Promise<EligibleHamaliSource[]> {
  const rows = await client.gRN.findMany({
    where: {
      status: "SUBMITTED",
      labourId,
      labourCharge: { not: null },
      deletedAt: null,
      lorryReceipt: branchId
        ? { group: { is: { originBranchId: branchId } } }
        : undefined,
    },
    select: {
      id: true,
      grnNumber: true,
      labourCharge: true,
      outDateTime: true,
      inDateTime: true,
      createdAt: true,
      lorryReceipt: {
        select: { group: { select: { originBranchId: true } } },
      },
    },
    take: 500,
  });
  return rows.map((r) => ({
    sourceType: "GRN_HAMALI" as const,
    sourceId: r.id,
    label: r.grnNumber,
    branchId: r.lorryReceipt.group.originBranchId,
    occurredAt: r.outDateTime ?? r.inDateTime ?? r.createdAt,
    hamaliPaise: r.labourCharge ?? 0n,
  }));
}

/** Rail Branch GRN labour charge — paid to labourLeaderId, branch-scoped via
 *  the rail rake's destination branch. Eligible once SUBMITTED. */
async function fetchRailBranchGrn(
  client: DbClient,
  labourId: string,
  branchId?: string,
): Promise<EligibleHamaliSource[]> {
  const rows = await client.railBranchGRN.findMany({
    where: {
      status: "SUBMITTED",
      labourLeaderId: labourId,
      labourCharge: { not: null },
      railRake: branchId ? { toBranchId: branchId } : undefined,
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
    take: 500,
  });
  return rows.map((r) => ({
    sourceType: "RAIL_BRANCH_GRN" as const,
    sourceId: r.id,
    label: `Rake ${r.railRake.rakeNumber}`,
    branchId: r.railRake.toBranchId,
    occurredAt: r.outDateTime ?? r.inDateTime ?? r.submittedAt ?? r.createdAt,
    hamaliPaise: r.labourCharge ?? 0n,
  }));
}

/** VP Wagon Loading labour charge — paid to labourId, branch-scoped via the
 *  loading VP schedule's origin branch. Eligible once COMPLETED or VERIFIED. */
async function fetchVpWagonLoading(
  client: DbClient,
  labourId: string,
  branchId?: string,
): Promise<EligibleHamaliSource[]> {
  const rows = await client.vPWagonLoading.findMany({
    where: {
      status: { in: ["COMPLETED", "VERIFIED"] },
      labourId,
      labourCharge: { not: null },
      mrRrRow: branchId
        ? { mrRr: { vpSchedule: { is: { fromBranchId: branchId } } } }
        : undefined,
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
    take: 500,
  });
  return rows.map((r) => ({
    sourceType: "VP_LOADING" as const,
    sourceId: r.id,
    label: r.gateNo ? `Gate ${r.gateNo}` : r.id,
    branchId: r.mrRrRow.mrRr.vpSchedule.fromBranchId,
    occurredAt: r.loadingCompletedAt ?? r.loadingStartedAt ?? r.createdAt,
    hamaliPaise: r.labourCharge ?? 0n,
  }));
}

/**
 * Eligible = unreserved hamali amounts for this labour across all three
 * source types, branch-scoped, in range. Feeds the create-slip screen's
 * browse step — the three source types can be freely combined on one slip.
 */
export async function findEligibleHamaliSources(
  client: DbClient,
  params: FindEligibleHamaliSourcesParams,
): Promise<EligibleHamaliSource[]> {
  const claimed = await claimedSourceIds(client);
  const [grn, railBranch, vpLoading] = await Promise.all([
    fetchGrnHamali(client, params.labourId, params.branchId),
    fetchRailBranchGrn(client, params.labourId, params.branchId),
    fetchVpWagonLoading(client, params.labourId, params.branchId),
  ]);

  return [...grn, ...railBranch, ...vpLoading]
    .filter((s) => !claimed.has(s.sourceId))
    .filter((s) => inDateRange(s.occurredAt, params.from, params.to))
    .sort((a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0));
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

  const claimed = await claimedSourceIds(client, excludeSlipId);
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
