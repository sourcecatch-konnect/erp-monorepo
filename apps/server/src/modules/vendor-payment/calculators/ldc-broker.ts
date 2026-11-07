import type {
  DeliveryChallanPaymentBy,
  Prisma,
} from "../../../../generated/prisma/index.js";
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

// The payable rule itself is pure and lives beside this file so it can be
// unit-tested without a database (see payment-by.ts).
import {
  PAYABLE_PAYMENT_BY,
  isPayablePaymentBy,
  reviewReasonFor,
} from "./payment-by.js";
import {
  ackRequiredFrom,
  approvalRequiredReason,
  isPayableWithoutApproval,
} from "../../delivery-challan-ack/ack-requirement.js";

export type EligibleLDCSource = {
  sourceId: string;
  /** Challan number, for the browse table. */
  label: string;
  /**
   * Who bears this challan's last-mile freight. On a payable row this is
   * always `COMPANY` (Q1); on a review row it is whatever was recorded, or
   * `null` if nothing was.
   */
  paymentBy: DeliveryChallanPaymentBy | null;
  /** Set only on review rows — why this challan is not payable. */
  reviewReason?: string;
  vehicleNumber: string | null;
  branchId: string;
  occurredAt: Date;
  freightPaise: bigint;
  advancePaise: bigint;
  /** The slab this figure came from — null when none matched. Shown on the
   *  browse row so a mis-scoped slab is visible before a slip is made. */
  slabName: string | null;
  /** The window the charge was measured over, and what it came to. All free
   *  on the quote that is already computed for the detention figure, so the
   *  row can explain itself without a second call. */
  reportingAt: Date | null;
  unloadingAt: Date | null;
  detentionDays: number | null;
  /** Every LR on this challan. */
  lrNumbers: string[];
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
  /**
   * `PAYABLE` (default) — challans the broker can actually be paid for.
   * `REVIEW` — the ones held back by the `paymentBy` rule, so they are
   * visible to an operator instead of silently vanishing from the browse
   * list. A review row is never selectable for a slip.
   */
  mode?: "PAYABLE" | "REVIEW";
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
  const review = params.mode === "REVIEW";

  // Q1: only a COMPANY-borne challan is payable. The review list is the exact
  // complement — `NOT in (...)` plus the nulls, which Prisma's `notIn` would
  // drop, since SQL `NOT IN` is never true for NULL.
  const paymentByWhere: Prisma.DeliveryChallanWhereInput = review
    ? {
        OR: [
          { paymentBy: null },
          { paymentBy: { notIn: [...PAYABLE_PAYMENT_BY] } },
        ],
      }
    : { paymentBy: { in: [...PAYABLE_PAYMENT_BY] } };

  const where: Prisma.DeliveryChallanWhereInput = {
    transportId: params.transportId,
    status: CLAIMABLE_STATUS,
    ...paymentByWhere,
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
        paymentBy: true,
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
  //
  // Skipped entirely in REVIEW mode: a row that cannot be paid has no
  // detention figure worth computing, and pricing it would only invite
  // someone to act on a number the rule says is not payable.
  const quotes = review
    ? unclaimed.map(() => null)
    : await Promise.all(
        unclaimed.map((c) => quoteChallanDetention(c.id).catch(() => null)),
      );

  return {
    total,
    rows: unclaimed.map((challan, index) => {
      const quote = quotes[index];
      return {
        sourceId: challan.id,
        label: challan.challanNumber,
        paymentBy: challan.paymentBy,
        vehicleNumber:
          challan.vehicle?.vehicleNumber ?? challan.vehicleNumberSnapshot,
        branchId: challan.sourceBranchId,
        occurredAt: challan.loadingAt,
        freightPaise: challan.freightAmount ?? 0n,
        advancePaise: challan.advanceAmount ?? 0n,
        slabName: quote?.slab?.name ?? null,
        reportingAt: quote?.window.finalReportingAt ?? null,
        unloadingAt: quote?.window.finalUnloadingAt ?? null,
        detentionDays: quote?.window.detentionDays ?? null,
        lrNumbers: quote?.lrNumbers ?? [],
        detentionPaise: quote?.charge.amountPaise ?? 0n,
        ...(review ? { reviewReason: reviewReasonFor(challan.paymentBy) } : {}),
        detentionWarnings: review
          ? []
          : quote
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
  /** Days the truck was held, both end dates counted. Null when unknown. */
  detentionDays: number | null;
  /** The slab that produced the figure, snapshotted for the audit trail. */
  detentionSlabId: string | null;
  detentionSlabName: string | null;
  /** Deduction heads as the approver ruled them (L4). Absent approval, or
   *  an unruled head, is zero — nothing is assumed in the broker.s favour. */
  parkingPaise: bigint;
  labourPaise: bigint;
  otherPaise: bigint;
  damagePaise: bigint;
  shortagePaise: bigint;
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

  // Take the same per-challan lock the acknowledgement/approval handlers
  // take, so a slip cannot be built from an ack or a ruling that is being
  // amended at the same moment — the slip's detention is computed from those
  // dates. Sorted, so two requests claiming overlapping challans acquire the
  // locks in the same order and cannot deadlock. Released when the caller's
  // transaction ends.
  const lockKeys = [...unique].sort().map((id) => `delivery-challan:${id}`);
  for (const key of lockKeys)
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

  const challans = await client.deliveryChallan.findMany({
    where: { id: { in: unique }, transportId, status: CLAIMABLE_STATUS },
    select: {
      id: true,
      challanNumber: true,
      freightAmount: true,
      advanceAmount: true,
      paymentBy: true,
      loadingAt: true,
      approval: {
        select: {
          id: true,
          approvedParkingPaise: true,
          approvedLabourPaise: true,
          approvedOtherPaise: true,
          approvedDamagePaise: true,
          approvedShortagePaise: true,
        },
      },
    },
  });

  const found = new Set(challans.map((c) => c.id));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length)
    throw new BadRequestError(
      `${missing.length} challan(s) are not this broker's, or are not issued`,
    );

  // Q1 enforced server-side, not only by hiding rows in the browse list: a
  // challan the company does not bear must not become a payable even if its
  // id is posted straight to the API. Named individually — an operator who
  // hits this needs to know which challan to go and fix.
  const notPayable = challans.filter((c) => !isPayablePaymentBy(c.paymentBy));
  if (notPayable.length)
    throw new BadRequestError(
      `Not payable by the company: ${notPayable
        .map(
          (c) => `${c.challanNumber} (${c.paymentBy ?? "payment-by not set"})`,
        )
        .join(
          ", ",
        )}. Only challans borne by the company can be paid to a broker.`,
    );

  // Q8 — a challan issued on or after the cutover needs a DC approval before
  // it can be paid. Q10 grandfathers the ones issued before it, which were
  // delivered under the old rules and must not be stranded.
  const cutover = ackRequiredFrom();
  const unapproved = challans.filter(
    (c) =>
      !isPayableWithoutApproval(
        { issuedAt: c.loadingAt, hasApproval: Boolean(c.approval) },
        cutover,
      ),
  );
  if (unapproved.length)
    throw new BadRequestError(
      `${unapproved.length} challan(s) are not approved: ${unapproved
        .map((c) => c.challanNumber)
        .join(", ")}. ${approvalRequiredReason}`,
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

    const quote = quotes[index];
    // L4: the approver's ruling on each head, or zero. A challan with no
    // approval (grandfathered under Q10) carries no heads — nothing is
    // assumed in either party's favour.
    const ruling = challan.approval;
    result.set(challan.id, {
      freightPaise,
      advancePaise,
      detentionPaise,
      detentionDays: quote?.window.detentionDays ?? null,
      detentionSlabId: quote?.slab?.id ?? null,
      detentionSlabName: quote?.slab?.name ?? null,
      parkingPaise: ruling?.approvedParkingPaise ?? 0n,
      labourPaise: ruling?.approvedLabourPaise ?? 0n,
      otherPaise: ruling?.approvedOtherPaise ?? 0n,
      damagePaise: ruling?.approvedDamagePaise ?? 0n,
      shortagePaise: ruling?.approvedShortagePaise ?? 0n,
    });
  });

  return result;
}
