import { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import { BadRequestError } from "../../../lib/error.js";
import { claimedAmong } from "./claims.js";
import {
  afterPosition,
  decodeCursor,
  pageMerged,
  type StreamPage,
} from "./eligible-stream.js";

type DbClient = typeof db | Prisma.TransactionClient;

// An LR counts as "delivered" for transporter-payment purposes once the
// truck has reached the consignee — ACKNOWLEDGED (POD back at the booking
// branch) necessarily implies DELIVERED already happened, so both count.
const DELIVERED_LR_STATUSES = ["DELIVERED", "ACKNOWLEDGED"] as const;

export type EligibleTransporterLR = {
  lrId: string;
  lrNumber: string;
  groupId: string;
  groupNumber: string;
  originBranchId: string;
  marketVehicleNumber: string | null;
  deliveredAt: Date | null;
  // Prefilled from stored data — freight/advance/commission/hamali/TDS come
  // from LRGroup's market* fields (captured at LR-group creation for a
  // market vehicle); detention/damage come from the acknowledgement. These
  // are also the server-authoritative values used to reconcile a submitted
  // line (see reconcileTransporterLines) — everything except stationeryPaise
  // is derived, never taken from the client.
  // stationeryPaise has no stored source and always prefills to 0 — the
  // operator enters it manually, same as legacy.
  freightPaise: bigint;
  detentionPaise: bigint;
  advancePaise: bigint;
  commissionPaise: bigint;
  hamaliPaise: bigint;
  tdsPaise: bigint;
  damagePaise: bigint;
  stationeryPaise: bigint;
};

const lrSelect = {
  id: true,
  createdAt: true,
  lrNumber: true,
  groupId: true,
  group: {
    select: {
      groupNumber: true,
      originBranchId: true,
      marketVehicleNumber: true,
      marketFreightAmount: true,
      marketAdvanceAmount: true,
      marketCommissionAmount: true,
      marketHamaliAmount: true,
      marketTdsAmount: true,
    },
  },
  delivery: { select: { deliveredAt: true } },
  acknowledgement: { select: { detentionAmount: true, damageAmount: true } },
} satisfies Prisma.LorryReceiptSelect;

type LrRow = Prisma.LorryReceiptGetPayload<{ select: typeof lrSelect }>;

const toEligible = (lr: LrRow): EligibleTransporterLR => ({
  lrId: lr.id,
  lrNumber: lr.lrNumber,
  groupId: lr.groupId,
  groupNumber: lr.group.groupNumber,
  originBranchId: lr.group.originBranchId,
  marketVehicleNumber: lr.group.marketVehicleNumber,
  deliveredAt: lr.delivery?.deliveredAt ?? null,
  freightPaise: lr.group.marketFreightAmount ?? 0n,
  detentionPaise: lr.acknowledgement?.detentionAmount ?? 0n,
  advancePaise: lr.group.marketAdvanceAmount ?? 0n,
  commissionPaise: lr.group.marketCommissionAmount ?? 0n,
  hamaliPaise: lr.group.marketHamaliAmount ?? 0n,
  tdsPaise: lr.group.marketTdsAmount ?? 0n,
  damagePaise: lr.acknowledgement?.damageAmount ?? 0n,
  stationeryPaise: 0n,
});

export type FindEligibleTransporterLRsParams = {
  transportId: string;
  /** `{ originBranchId }` for a chosen branch, or the caller's branch scope
   *  fragment — same convention as ledger.route.ts's branchWhereFor. */
  branchWhere?: Prisma.LRGroupWhereInput;
  from?: Date;
  to?: Date;
  /** Matched in the database against LR no., LR-group no. and market vehicle no. */
  search?: string;
  /** `nextCursor` from the previous chunk; omit for the first chunk. */
  cursor?: string;
  size: number;
};

// A single stream — the rank only matters when several sources are merged.
const LR_STREAM_RANK = 0;

const eligibleLrWhere = (
  params: FindEligibleTransporterLRsParams,
): Prisma.LorryReceiptWhereInput => {
  const search = params.search?.trim();
  return {
    status: { in: [...DELIVERED_LR_STATUSES] },
    ...(params.from || params.to
      ? {
          delivery: {
            deliveredAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          },
        }
      : {}),
    group: {
      is: {
        isMarketVehicle: true,
        marketTransportId: params.transportId,
        ...params.branchWhere,
      },
    },
    ...(search
      ? {
          OR: [
            { lrNumber: { contains: search, mode: "insensitive" } },
            { group: { is: { groupNumber: { contains: search, mode: "insensitive" } } } },
            {
              group: {
                is: { marketVehicleNumber: { contains: search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };
};

/**
 * Eligible = delivered market-vehicle LRs for this transporter, within
 * branch scope, that have no active vendor-payment-slip source reservation
 * yet. Feeds the create-slip screen's browse step, one chunk at a time —
 * there is no row cap; the caller pages on with `nextCursor`.
 */
export async function findEligibleTransporterLRs(
  client: DbClient,
  params: FindEligibleTransporterLRsParams,
): Promise<StreamPage<EligibleTransporterLR>> {
  const base = eligibleLrWhere(params);

  const page = await pageMerged<LrRow>(
    [
      {
        rank: LR_STREAM_RANK,
        fetch: (after, take) =>
          client.lorryReceipt.findMany({
            where: { AND: [base, afterPosition(LR_STREAM_RANK, after)] },
            select: lrSelect,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take,
          }),
        dropClaimed: async (rows) => {
          const claimed = await claimedAmong(
            client,
            ["LR"],
            rows.map((row) => row.id),
          );
          return rows.filter((row) => !claimed.has(row.id));
        },
      },
    ],
    params.cursor ? decodeCursor(params.cursor) : null,
    params.size,
  );

  return { items: page.items.map(toEligible), nextCursor: page.nextCursor };
}

/**
 * Re-derive every server-owned component (everything but stationeryPaise)
 * for a set of submitted LR source ids, straight from the LR/LRGroup/
 * Acknowledgement records — never from client input. Also re-checks
 * eligibility (delivered, belongs to this transporter, not actively claimed
 * by another slip) so a stale or tampered sourceId fails loudly instead of
 * silently posting whatever the client sent.
 *
 * `excludeSlipId` lets a draft re-save its own already-claimed lines.
 */
export async function reconcileTransporterLines(
  client: DbClient,
  transportId: string,
  sourceIds: string[],
  excludeSlipId?: string,
): Promise<Map<string, EligibleTransporterLR>> {
  if (sourceIds.length === 0) return new Map();

  const claimed = await claimedAmong(client, ["LR"], sourceIds, excludeSlipId);
  const conflicting = sourceIds.filter((id) => claimed.has(id));
  if (conflicting.length)
    throw new BadRequestError(
      `These LRs are already claimed by another vendor payment slip: ${conflicting.join(", ")}`,
    );

  const lrs = await client.lorryReceipt.findMany({
    where: {
      id: { in: sourceIds },
      status: { in: [...DELIVERED_LR_STATUSES] },
      group: { is: { isMarketVehicle: true, marketTransportId: transportId } },
    },
    select: lrSelect,
  });
  const byId = new Map(lrs.map((lr) => [lr.id, toEligible(lr)]));

  const missing = sourceIds.filter((id) => !byId.has(id));
  if (missing.length)
    throw new BadRequestError(
      `These LRs are not eligible for this transporter: ${missing.join(", ")}`,
    );

  return byId;
}
