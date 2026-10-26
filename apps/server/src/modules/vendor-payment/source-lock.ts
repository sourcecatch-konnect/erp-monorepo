import type {
  Prisma,
  VendorPaymentSourceType,
} from "../../../generated/prisma/index.js";
import type { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";

type DbClient = typeof db | Prisma.TransactionClient;

/**
 * A source document (LR, GRN, Branch GRN, VP wagon loading) that sits on an
 * active vendor-payment slip line is locked: the slip — and, once approved,
 * its accrual voucher — holds amounts copied from it, so changing the source
 * afterwards would leave the slip and the books silently out of step.
 *
 * Throws, naming the slip(s), when any of `sourceIds` is claimed. The fix for
 * the user is to edit the draft slip (drop the line) or cancel the slip
 * first. A cancelled slip's lines are inactive and never block.
 */
export async function assertNotOnVendorSlip(
  client: DbClient,
  sourceType: VendorPaymentSourceType,
  sourceIds: string[],
  action: string,
): Promise<void> {
  if (sourceIds.length === 0) return;
  const claims = await client.vendorPaymentSlipLine.findMany({
    where: { sourceType, sourceId: { in: sourceIds }, isActive: true },
    select: { slip: { select: { slipNumber: true, status: true } } },
  });
  throwIfClaimed(claims, action);
}

/**
 * LRs are paid two ways: on a truck line (LR_GROUP — the normal case) or on
 * a legacy per-LR line. An LR is locked if either line holds it.
 */
export async function assertLRsNotOnVendorSlip(
  client: DbClient,
  lrIds: string[],
  action: string,
): Promise<void> {
  if (lrIds.length === 0) return;
  const lrs = await client.lorryReceipt.findMany({
    where: { id: { in: lrIds } },
    select: { groupId: true },
  });
  const groupIds = [...new Set(lrs.map((lr) => lr.groupId))];
  const claims = await client.vendorPaymentSlipLine.findMany({
    where: {
      isActive: true,
      OR: [
        { sourceType: "LR", sourceId: { in: lrIds } },
        { sourceType: "LR_GROUP", sourceId: { in: groupIds } },
      ],
    },
    select: { slip: { select: { slipNumber: true, status: true } } },
  });
  throwIfClaimed(claims, action);
}

function throwIfClaimed(
  claims: { slip: { slipNumber: string; status: string } }[],
  action: string,
) {
  if (claims.length === 0) return;

  const slips = [
    ...new Map(
      claims.map(({ slip }) => [slip.slipNumber, `${slip.slipNumber} (${slip.status})`]),
    ).values(),
  ].join(", ");
  throw new BadRequestError(
    `Cannot ${action}: it is on vendor payment slip ${slips}. Remove it from that slip or cancel the slip first.`,
  );
}

/** Nullable money/id equality — `bigint`s compare by value with `===`. */
export const sameValue = <T extends string | bigint>(
  a: T | null | undefined,
  b: T | null | undefined,
) => (a ?? null) === (b ?? null);
