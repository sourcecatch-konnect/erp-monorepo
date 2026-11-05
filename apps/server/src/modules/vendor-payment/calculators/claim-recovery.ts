import type { Prisma } from "../../../../generated/prisma/index.js";
import type { db } from "../../../../prisma/prisma.js";
import { BadRequestError } from "../../../lib/error.js";
import { claimedAmong } from "./claims.js";

type DbClient = typeof db | Prisma.TransactionClient;

/*
 * Claims C7 — an approved damage-claim recovery from a transporter / broker
 * is deducted on their vendor payment slip, as its own line (sourceType
 * CLAIM_RECOVERY, sourceId = ClaimRecovery.id). The active-line unique index
 * keeps it on one slip at a time.
 *
 * The truck line already deducts each LR acknowledgement's damage amount. So
 * when the claim was raised from that acknowledgement and the truck is this
 * transporter's, that much is already being recovered — the claim line only
 * deducts what's above it (₹15,000 recovery − ₹5,000 ack damage = ₹10,000).
 */

export type EligibleClaimRecovery = {
  recoveryId: string;
  claimId: string;
  claimNumber: string;
  lineNo: number;
  lrNumber: string;
  referenceNo: string | null;
  /** The approved recovery. */
  amountPaise: bigint;
  /** Already deducted on the truck line through the LR acknowledgement. */
  coveredByAckPaise: bigint;
  /** What this line deducts: amount − covered. */
  damagePaise: bigint;
};

/** How much of a recovery the truck line's ack damage already takes. Pure. */
export const ackCoveredPaise = (input: {
  origin: string;
  ackDamagePaise: bigint;
  /** The LR's market transporter, null for a fleet truck. */
  lrTransportId: string | null;
  recoveryTransportId: string;
  amountPaise: bigint;
}): bigint => {
  if (input.origin !== "LR_ACK" || input.lrTransportId !== input.recoveryTransportId) return 0n;
  return input.ackDamagePaise < input.amountPaise ? input.ackDamagePaise : input.amountPaise;
};

const recoverySelect = {
  id: true,
  lineNo: true,
  amountPaise: true,
  referenceNo: true,
  transportId: true,
  claim: {
    select: {
      id: true,
      claimNumber: true,
      origin: true,
      lr: {
        select: {
          lrNumber: true,
          acknowledgement: { select: { damageAmount: true } },
          group: { select: { isMarketVehicle: true, marketTransportId: true } },
        },
      },
    },
  },
} satisfies Prisma.ClaimRecoverySelect;
type RecoveryRow = Prisma.ClaimRecoveryGetPayload<{ select: typeof recoverySelect }>;

const toEligible = (row: RecoveryRow): EligibleClaimRecovery => {
  const group = row.claim.lr.group;
  const covered = ackCoveredPaise({
    origin: row.claim.origin,
    ackDamagePaise: row.claim.lr.acknowledgement?.damageAmount ?? 0n,
    lrTransportId: group.isMarketVehicle ? group.marketTransportId : null,
    recoveryTransportId: row.transportId!,
    amountPaise: row.amountPaise,
  });
  return {
    recoveryId: row.id,
    claimId: row.claim.id,
    claimNumber: row.claim.claimNumber,
    lineNo: row.lineNo,
    lrNumber: row.claim.lr.lrNumber,
    referenceNo: row.referenceNo,
    amountPaise: row.amountPaise,
    coveredByAckPaise: covered,
    damagePaise: row.amountPaise - covered,
  };
};

/** Approved TRANSPORTER recoveries of this transporter on a claim still open or settled. */
const deductibleWhere = (
  transportId: string,
  claimBranchWhere: Prisma.ClaimWhereInput = {},
): Prisma.ClaimRecoveryWhereInput => ({
  source: "TRANSPORTER",
  status: "APPROVED",
  transportId,
  claim: { is: { deletedAt: null, status: { in: ["ACTIVE", "SETTLED"] }, ...claimBranchWhere } },
});

/** For the create-slip screen: every such recovery not on another active slip. */
export async function findEligibleClaimRecoveries(
  client: DbClient,
  transportId: string,
  claimBranchWhere?: Prisma.ClaimWhereInput,
): Promise<EligibleClaimRecovery[]> {
  const rows = await client.claimRecovery.findMany({
    where: deductibleWhere(transportId, claimBranchWhere),
    select: recoverySelect,
    orderBy: { createdAt: "asc" },
  });
  const claimed = await claimedAmong(client, ["CLAIM_RECOVERY"], rows.map((row) => row.id));
  return rows.filter((row) => !claimed.has(row.id)).map(toEligible);
}

/**
 * Re-derive each submitted recovery's deduction on the server and re-check
 * it's this transporter's, approved, and not on another active slip.
 * `excludeSlipId` lets a draft re-save its own lines.
 */
export async function reconcileClaimRecoveryLines(
  client: DbClient,
  transportId: string,
  recoveryIds: string[],
  excludeSlipId?: string,
): Promise<Map<string, EligibleClaimRecovery>> {
  if (recoveryIds.length === 0) return new Map();
  const rows = await client.claimRecovery.findMany({
    where: { ...deductibleWhere(transportId), id: { in: recoveryIds } },
    select: recoverySelect,
  });
  const byId = new Map(rows.map((row) => [row.id, toEligible(row)]));

  const missing = recoveryIds.filter((id) => !byId.has(id));
  if (missing.length)
    throw new BadRequestError(
      "A selected damage recovery is no longer an approved recovery from this transporter — refresh the list",
    );

  const claimed = await claimedAmong(client, ["CLAIM_RECOVERY"], recoveryIds, excludeSlipId);
  if (claimed.size)
    throw new BadRequestError(
      `These damage recoveries are already on another vendor payment slip: ${[...byId.values()]
        .filter((row) => claimed.has(row.recoveryId))
        .map((row) => `${row.claimNumber} R${row.lineNo}`)
        .join(", ")}`,
    );
  return byId;
}
