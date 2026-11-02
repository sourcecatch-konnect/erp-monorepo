import type { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import { BadRequestError } from "../../../lib/error.js";
import { quoteChallanDetention } from "../../detention/detention.service.js";
import { claimedAmong } from "./claims.js";

/**
 * LDC (Local Delivery Challan) broker payment — the last-mile leg from the
 * destination branch to the consignee.
 *
 * The payable is the challan's own freight plus detention, less the advance
 * already handed over and TDS. Detention is NOT taken from the client: it is
 * recomputed here from the broker's slab and the challan's LR dates, so the
 * amount a broker is paid always matches the rule the business agreed. See
 * `modules/detention`.
 *
 * Legacy ran this through a separate DCApproval stage that reconciled two
 * independent acknowledgements (supervisor and broker) before a slip could be
 * made — see docs/ACCOUNTS_MODULE_MAP.md §2.F. That stage is not built; a slip
 * is made straight from an issued challan.
 */

type DbClient = typeof db | Prisma.TransactionClient;

/** Only an issued challan can be claimed — a draft may still change. */
const CLAIMABLE_STATUS = "ISSUED" as const;

export type EligibleLDCSource = {
  sourceId: string;
  /** Challan number, for the browse table. */
  label: string;
  vehicleNumber: string | null;
  branchId: string;
  occurredAt: Date;
  freightPaise: bigint;
  advancePaise: bigint;
  /** Computed from the slab; 0 when no slab matches or dates are missing. */
  detentionPaise: bigint;
  /** Why the detention figure may be wrong — surfaced on the browse row. */
  detentionWarnings: string[];
};

export type FindEligibleLDCSourcesParams = {
  transportId: string;
  /** Branches the caller may see. `undefined` = unrestricted. */
  branchIds?: string[];
  from?: Date;
  to?: Date;
  search?: string;
  page: number;
  size: number;
};

const rangeOf = (from?: Date, to?: Date) =>
  from || to
    ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
    : undefined;

/**
 * Issued challans for this broker that no active slip line already claims.
 *
 * Paged in the database rather than loaded whole: a busy branch issues
 * hundreds of challans a month and the browse table only ever shows one page.
 * The claimed-set lookup is a single `IN` over the page's ids, not a query per
 * row.
 */
export async function findEligibleLDCSources(
  params: FindEligibleLDCSourcesParams,
): Promise<{ rows: EligibleLDCSource[]; total: number }> {
  const loadingAt = rangeOf(params.from, params.to);

  const where: Prisma.DeliveryChallanWhereInput = {
    transportId: params.transportId,
    status: CLAIMABLE_STATUS,
    ...(params.branchIds ? { sourceBranchId: { in: params.branchIds } } : {}),
    ...(loadingAt ? { loadingAt } : {}),
    ...(params.search
      ? { challanNumber: { contains: params.search, mode: "insensitive" } }
      : {}),
  };

  const [total, challans] = await Promise.all([
    db.deliveryChallan.count({ where }),
    db.deliveryChallan.findMany({
      where,
      orderBy: [{ loadingAt: "desc" }, { id: "desc" }],
      skip: params.page * params.size,
      take: params.size,
      select: {
        id: true,
        challanNumber: true,
        sourceBranchId: true,
        loadingAt: true,
        freightAmount: true,
        advanceAmount: true,
        vehicleNumberSnapshot: true,
        vehicle: { select: { vehicleNumber: true } },
      },
    }),
  ]);

  const claimed = await claimedAmong(
    db,
    ["DELIVERY_CHALLAN"],
    challans.map((c) => c.id),
  );

  const unclaimed = challans.filter((c) => !claimed.has(c.id));

  // One quote per challan, in parallel. Each is two queries behind a 5-minute
  // Redis cache on the slab set, so a page of 20 costs 20 challan reads, not
  // 20 slab reads as well.
  const quotes = await Promise.all(
    unclaimed.map((c) => quoteChallanDetention(c.id).catch(() => null)),
  );

  return {
    total,
    rows: unclaimed.map((challan, index) => {
      const quote = quotes[index];
      return {
        sourceId: challan.id,
        label: challan.challanNumber,
        vehicleNumber:
          challan.vehicle?.vehicleNumber ?? challan.vehicleNumberSnapshot,
        branchId: challan.sourceBranchId,
        occurredAt: challan.loadingAt,
        freightPaise: challan.freightAmount ?? 0n,
        advancePaise: challan.advanceAmount ?? 0n,
        detentionPaise: quote?.charge.amountPaise ?? 0n,
        detentionWarnings: quote
          ? quote.warnings
          : ["Could not compute detention for this challan"],
      };
    }),
  };
}

export type ReconciledLDCLine = {
  freightPaise: bigint;
  advancePaise: bigint;
  detentionPaise: bigint;
};

/**
 * Re-derive every amount server-side for the challans a slip claims.
 *
 * Mirrors `reconcileTransporterTrucks`: a client cannot inflate an amount by
 * sending a different number, and a challan that is not this broker's, not
 * issued, or already on another active slip fails loudly rather than silently
 * posting.
 */
export async function reconcileLDCLines(
  client: DbClient,
  transportId: string,
  challanIds: string[],
  excludeSlipId?: string,
): Promise<Map<string, ReconciledLDCLine>> {
  if (challanIds.length === 0) return new Map();

  const unique = [...new Set(challanIds)];
  if (unique.length !== challanIds.length)
    throw new BadRequestError("The same challan appears twice on this slip");

  const challans = await client.deliveryChallan.findMany({
    where: { id: { in: unique }, transportId, status: CLAIMABLE_STATUS },
    select: {
      id: true,
      challanNumber: true,
      freightAmount: true,
      advanceAmount: true,
    },
  });

  const found = new Set(challans.map((c) => c.id));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length)
    throw new BadRequestError(
      `${missing.length} challan(s) are not this broker's, or are not issued`,
    );

  const claimed = await claimedAmong(
    client,
    ["DELIVERY_CHALLAN"],
    unique,
    excludeSlipId,
  );
  if (claimed.size)
    throw new BadRequestError(
      `${claimed.size} challan(s) are already on another payment slip`,
    );

  const quotes = await Promise.all(
    challans.map((c) => quoteChallanDetention(c.id)),
  );

  const result = new Map<string, ReconciledLDCLine>();
  challans.forEach((challan, index) => {
    const freightPaise = challan.freightAmount ?? 0n;
    const advancePaise = challan.advanceAmount ?? 0n;
    const detentionPaise = quotes[index]?.charge.amountPaise ?? 0n;

    // Caught here rather than at the slip level so the message names the
    // challan the operator has to fix.
    if (advancePaise > freightPaise + detentionPaise)
      throw new BadRequestError(
        `Challan ${challan.challanNumber}: the advance exceeds freight plus detention`,
      );

    result.set(challan.id, { freightPaise, advancePaise, detentionPaise });
  });

  return result;
}
