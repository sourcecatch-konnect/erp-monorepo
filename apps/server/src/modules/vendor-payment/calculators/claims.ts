import type {
  Prisma,
  VendorPaymentSourceType,
} from "../../../../generated/prisma/index.js";
import type { db } from "../../../../prisma/prisma.js";

type DbClient = typeof db | Prisma.TransactionClient;

/**
 * Which of `sourceIds` are actively claimed by a (different) vendor payment
 * slip. Looks up only the ids in question — served by the partial unique index
 * on (sourceType, sourceId) WHERE isActive — instead of loading every claim in
 * the system, which grows without bound as slips accumulate.
 *
 * `excludeSlipId` lets a draft re-save its own already-claimed lines.
 */
export async function claimedAmong(
  client: DbClient,
  sourceTypes: VendorPaymentSourceType[],
  sourceIds: string[],
  excludeSlipId?: string,
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set();
  const claims = await client.vendorPaymentSlipLine.findMany({
    where: {
      sourceType: { in: sourceTypes },
      sourceId: { in: sourceIds },
      isActive: true,
      ...(excludeSlipId ? { slipId: { not: excludeSlipId } } : {}),
    },
    select: { sourceId: true },
  });
  return new Set(claims.map((claim) => claim.sourceId));
}
