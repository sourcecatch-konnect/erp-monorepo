import { db } from "../../../prisma/prisma.js";
import { NotFoundError } from "../../lib/error.js";
import { cached } from "../_shared/cache.js";
import {
  chargeDetention,
  resolveDetentionWindow,
  type DetentionCharge,
  type DetentionSlabRules,
  type DetentionWindow,
  type LRWindowInput,
  type SlabBand,
} from "./detention.engine.js";

/**
 * Loads what the engine needs and decides which slab applies. The arithmetic
 * itself lives in `detention.engine.ts` and never touches the database.
 */

/** Slabs change rarely and are read on every quote — the classic cache shape. */
export const DETENTION_SLAB_NAMESPACE = "detention-slab";
const SLAB_TTL_SECONDS = 300;

/* ─────────────────────── slab loading ─────────────────────── */

export type SlabRow = {
  id: string;
  name: string;
  transportId: string | null;
  customerId: string | null;
  vehicleTypeId: string | null;
  freightFromPaise: string | null;
  freightToPaise: string | null;
  basis: "DAY" | "HOUR";
  firstDayFree: boolean;
  lastDayFree: boolean;
  freeHours: number | null;
  blockHours: number | null;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  bands: { fromUnit: number; toUnit: number | null; ratePaise: string }[];
};

/**
 * Every live slab, in one query, cached.
 *
 * Matching is in-memory rather than a per-quote `WHERE`: the scope columns are
 * all nullable ("applies to any"), so a SQL match would be four `OR IS NULL`
 * branches that no index helps with. The whole table is small — tens of rows,
 * one per broker/vehicle combination — so loading it once per 5 minutes and
 * filtering in JS is both faster and far easier to reason about than the
 * query that would replace it.
 *
 * BigInt and Date are serialised as strings because the cache round-trips
 * through JSON; `toRules` converts back at the point of use.
 */
export const loadActiveSlabs = (): Promise<SlabRow[]> =>
  cached(
    {
      namespace: DETENTION_SLAB_NAMESPACE,
      key: "active",
      ttlSeconds: SLAB_TTL_SECONDS,
    },
    async () => {
      const rows = await db.detentionSlab.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          transportId: true,
          customerId: true,
          vehicleTypeId: true,
          freightFromPaise: true,
          freightToPaise: true,
          basis: true,
          firstDayFree: true,
          lastDayFree: true,
          freeHours: true,
          blockHours: true,
          priority: true,
          effectiveFrom: true,
          effectiveTo: true,
          bands: {
            orderBy: { fromUnit: "asc" },
            select: { fromUnit: true, toUnit: true, ratePaise: true },
          },
        },
      });

      return rows.map((row) => ({
        ...row,
        freightFromPaise: row.freightFromPaise?.toString() ?? null,
        freightToPaise: row.freightToPaise?.toString() ?? null,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo?.toISOString() ?? null,
        bands: row.bands.map((band) => ({
          ...band,
          ratePaise: band.ratePaise.toString(),
        })),
      }));
    },
  );

const toRules = (slab: SlabRow): DetentionSlabRules => ({
  basis: slab.basis,
  firstDayFree: slab.firstDayFree,
  lastDayFree: slab.lastDayFree,
  freeHours: slab.freeHours,
  blockHours: slab.blockHours,
  bands: slab.bands.map(
    (band): SlabBand => ({
      fromUnit: band.fromUnit,
      toUnit: band.toUnit,
      ratePaise: BigInt(band.ratePaise),
    }),
  ),
});

/* ─────────────────────── slab matching ─────────────────────── */

export type SlabMatchContext = {
  transportId: string | null;
  vehicleTypeId: string | null;
  freightPaise: bigint | null;
  on: Date;
};

/**
 * A slab applies when every scope it names matches. A `null` scope is a
 * wildcard, so an unscoped house slab is the fallback for everything.
 *
 * Customer is deliberately not a scope. Detention slabs price what the
 * business PAYS the broker; what it RECOVERS from the customer is entered by
 * hand at acknowledgement and billed through `LRCharge`. The column and the
 * API field remain so existing rows keep their data, but nothing matches on
 * them.
 */
const applies = (slab: SlabRow, ctx: SlabMatchContext): boolean => {
  if (slab.transportId && slab.transportId !== ctx.transportId) return false;
  if (slab.vehicleTypeId && slab.vehicleTypeId !== ctx.vehicleTypeId)
    return false;

  if (slab.freightFromPaise !== null || slab.freightToPaise !== null) {
    if (ctx.freightPaise === null) return false;
    if (
      slab.freightFromPaise !== null &&
      ctx.freightPaise < BigInt(slab.freightFromPaise)
    )
      return false;
    if (
      slab.freightToPaise !== null &&
      ctx.freightPaise > BigInt(slab.freightToPaise)
    )
      return false;
  }

  const at = ctx.on.getTime();
  if (new Date(slab.effectiveFrom).getTime() > at) return false;
  if (slab.effectiveTo && new Date(slab.effectiveTo).getTime() < at)
    return false;

  return true;
};

/** How many scopes a slab pins down — the more, the more specific. */
const specificity = (slab: SlabRow): number =>
  (slab.transportId ? 1 : 0) +
  (slab.vehicleTypeId ? 1 : 0) +
  (slab.freightFromPaise !== null || slab.freightToPaise !== null ? 1 : 0);

export type SlabMatch = {
  slab: SlabRow | null;
  /** Other slabs that also matched — shown so an operator can switch. */
  alternatives: SlabRow[];
  reason: string | null;
};

/**
 * Most specific wins; `priority` breaks a tie; the newest effective date
 * breaks that. A tie resolved arbitrarily would make the broker's bill depend
 * on row order, so the order is total and explicit.
 */
export const pickSlab = (
  slabs: SlabRow[],
  ctx: SlabMatchContext,
): SlabMatch => {
  const matching = slabs.filter((slab) => applies(slab, ctx));
  if (matching.length === 0) {
    return {
      slab: null,
      alternatives: [],
      reason:
        "No detention slab matches this broker, vehicle type and freight — add one or set a default",
    };
  }

  const ranked = [...matching].sort((a, b) => {
    const bySpecificity = specificity(b) - specificity(a);
    if (bySpecificity !== 0) return bySpecificity;
    const byPriority = b.priority - a.priority;
    if (byPriority !== 0) return byPriority;
    return (
      new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    );
  });

  return { slab: ranked[0]!, alternatives: ranked.slice(1), reason: null };
};

/* ─────────────────────── challan loading ─────────────────────── */

export type ChallanDetentionContext = {
  challanId: string;
  challanNumber: string;
  transportId: string | null;
  transportName: string | null;
  vehicleTypeId: string | null;
  freightPaise: bigint | null;
  ldcDate: Date | null;
  reportDate: Date | null;
  lrs: LRWindowInput[];
  /** Every LR the challan carries, for display — independent of which source
   *  supplied the dates. */
  lrNumbersOnChallan: string[];
  /**
   * Where the detention window came from (Q18). `DC_APPROVAL` means an
   * approver ruled on the dates; `LR_DELIVERY` means they were derived from
   * the LRs, which is the grandfathered path for challans issued before the
   * approval requirement.
   */
  datesFrom: "DC_APPROVAL" | "LR_DELIVERY";
  /** LR numbers on the challan we could not resolve to a LorryReceipt row. */
  unresolvedLrNumbers: string[];
};

/**
 * Gather the challan, its broker, and every LR's reporting/unloading date.
 *
 * The challan reaches its LRs only through a four-table chain
 * (`DeliveryChallanItem -> RailBranchGRNItem -> VPLoadingGoods -> GRNGoods ->
 * LRGoods`), and `GRNGoods.lrGoodsId` is nullable, so that path can silently
 * drop an LR. Each item also carries `lrNumberSnapshot`, so we take the union:
 * walk the relation where it exists, then resolve any snapshot numbers it
 * missed in a single batched lookup. Anything still unmatched is reported
 * rather than ignored — a dropped LR understates detention.
 */
export const loadChallanContext = async (
  challanId: string,
): Promise<ChallanDetentionContext> => {
  const challan = await db.deliveryChallan.findUnique({
    where: { id: challanId },
    select: {
      id: true,
      challanNumber: true,
      transportId: true,
      freightAmount: true,
      loadingAt: true,
      reportDate: true,
      transport: { select: { name: true } },
      vehicle: { select: { vehicleTypeId: true } },
      // Q18: once a challan is approved, the approved acknowledgement's dates
      // are the source of truth for the detention window — not the LR-derived
      // ones. A challan with no approval is either grandfathered (Q10) or
      // not yet payable, and falls back to the LR dates below.
      approval: {
        select: {
          acceptedAck: {
            select: { reportingDate: true, unloadingDate: true },
          },
        },
      },
      items: {
        select: {
          lrNumberSnapshot: true,
          branchGrnItem: {
            select: {
              vpLoadingGoods: {
                select: {
                  grnGoods: {
                    select: {
                      lrGoods: {
                        select: {
                          lorryReceipt: {
                            select: {
                              id: true,
                              lrNumber: true,
                              delivery: {
                                select: { reportedAt: true, unloadingAt: true },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!challan) throw new NotFoundError("Delivery challan not found");

  const byNumber = new Map<string, LRWindowInput>();
  const snapshotNumbers = new Set<string>();

  for (const item of challan.items) {
    snapshotNumbers.add(item.lrNumberSnapshot);
    const lr = item.branchGrnItem.vpLoadingGoods.grnGoods.lrGoods?.lorryReceipt;
    if (!lr) continue;
    byNumber.set(lr.lrNumber, {
      lrNumber: lr.lrNumber,
      reportedAt: lr.delivery?.reportedAt ?? null,
      unloadingAt: lr.delivery?.unloadingAt ?? null,
    });
  }

  // One batched query for whatever the relation chain could not reach, rather
  // than a lookup per item.
  const missing = [...snapshotNumbers].filter(
    (number) => !byNumber.has(number),
  );
  if (missing.length > 0) {
    const rescued = await db.lorryReceipt.findMany({
      where: { lrNumber: { in: missing } },
      select: {
        lrNumber: true,
        delivery: { select: { reportedAt: true, unloadingAt: true } },
      },
    });
    for (const lr of rescued) {
      byNumber.set(lr.lrNumber, {
        lrNumber: lr.lrNumber,
        reportedAt: lr.delivery?.reportedAt ?? null,
        unloadingAt: lr.delivery?.unloadingAt ?? null,
      });
    }
  }

  // Q18 — the approved acknowledgement's dates replace the LR-derived window
  // entirely, rather than joining the earliest/latest contest. That is the
  // point of the ruling: when the supervisor and the broker disagree about
  // when the truck reported or finished, an approver decides, and the engine
  // must use the decision rather than quietly out-voting it with LR data.
  //
  // A challan with no approval keeps the original behaviour — it is either
  // grandfathered under Q10 or not payable yet.
  const approvedAck = challan.approval?.acceptedAck ?? null;
  const approvedWindow =
    approvedAck && (approvedAck.reportingDate || approvedAck.unloadingDate)
      ? approvedAck
      : null;

  return {
    challanId: challan.id,
    challanNumber: challan.challanNumber,
    transportId: challan.transportId,
    transportName: challan.transport?.name ?? null,
    vehicleTypeId: challan.vehicle?.vehicleTypeId ?? null,
    freightPaise: challan.freightAmount,
    ldcDate: approvedWindow ? approvedWindow.reportingDate : challan.loadingAt,
    reportDate: approvedWindow ? null : challan.reportDate,
    lrs: approvedWindow
      ? [
          {
            lrNumber: "DC approval",
            reportedAt: approvedWindow.reportingDate,
            unloadingAt: approvedWindow.unloadingDate,
          },
        ]
      : [...byNumber.values()],
    /** The LRs the challan carries, for display, regardless of which source
     *  priced it — the browse row and the working panel both list them. */
    lrNumbersOnChallan: [...byNumber.keys()],
    datesFrom: approvedWindow
      ? ("DC_APPROVAL" as const)
      : ("LR_DELIVERY" as const),
    unresolvedLrNumbers: [...snapshotNumbers].filter(
      (number) => !byNumber.has(number),
    ),
  };
};

/* ─────────────────────── the quote ─────────────────────── */

export type DetentionQuote = {
  challanId: string;
  challanNumber: string;
  broker: { id: string; name: string } | null;
  window: DetentionWindow;
  slab: { id: string; name: string; basis: "DAY" | "HOUR" } | null;
  alternatives: { id: string; name: string }[];
  charge: DetentionCharge;
  /** Every LR this challan carries, for the browse row and the working panel. */
  lrNumbers: string[];
  /** LR numbers on the challan with no matching LorryReceipt row. */
  unresolvedLrNumbers: string[];
  /** Everything blocking a confident figure, in plain language. */
  warnings: string[];
};

export type QuoteOverrides = {
  reportingAt?: Date | null;
  unloadingAt?: Date | null;
  slabId?: string | null;
};

export const quoteChallanDetention = async (
  challanId: string,
  overrides: QuoteOverrides = {},
): Promise<DetentionQuote> => {
  const [context, slabs] = await Promise.all([
    loadChallanContext(challanId),
    loadActiveSlabs(),
  ]);

  // An operator override replaces the whole LR set for that side of the
  // window, so a known-correct date is not re-beaten by a stale LR row.
  const window = resolveDetentionWindow({
    ldcDate: overrides.reportingAt ?? context.ldcDate,
    reportDate: overrides.reportingAt ? null : context.reportDate,
    lrs:
      overrides.reportingAt || overrides.unloadingAt
        ? context.lrs.map((lr) => ({
            ...lr,
            reportedAt: overrides.reportingAt ?? lr.reportedAt,
            unloadingAt: overrides.unloadingAt ?? lr.unloadingAt,
          }))
        : context.lrs,
  });

  const forced = overrides.slabId
    ? (slabs.find((slab) => slab.id === overrides.slabId) ?? null)
    : null;
  const match = forced
    ? {
        slab: forced,
        alternatives: slabs.filter((s) => s.id !== forced.id),
        reason: null,
      }
    : pickSlab(slabs, {
        transportId: context.transportId,
        vehicleTypeId: context.vehicleTypeId,
        freightPaise: context.freightPaise,
        on: window.finalReportingAt ?? new Date(),
      });

  const charge = match.slab
    ? chargeDetention({ window, slab: toRules(match.slab) })
    : {
        amountPaise: 0n,
        chargeableUnits: 0,
        freeUnits: 0,
        lines: [],
        warning: match.reason,
      };

  // Deduped: when the window cannot be resolved, `chargeDetention` returns
  // `window.reason` as its own warning, so the same sentence arrives twice.
  const warnings = [
    ...new Set(
      [
        window.reason,
        charge.warning,
        window.lrsMissingUnloading.length > 0
          ? `No unloading date on ${window.lrsMissingUnloading.length} LR(s): ${window.lrsMissingUnloading.join(", ")}`
          : null,
        context.unresolvedLrNumbers.length > 0
          ? `Could not find ${context.unresolvedLrNumbers.length} LR(s) named on this challan: ${context.unresolvedLrNumbers.join(", ")}`
          : null,
        context.transportId === null
          ? "This challan has no broker — slab matching fell back to the default"
          : null,
      ].filter((warning): warning is string => Boolean(warning)),
    ),
  ];

  return {
    challanId: context.challanId,
    challanNumber: context.challanNumber,
    broker: context.transportId
      ? { id: context.transportId, name: context.transportName ?? "" }
      : null,
    window,
    slab: match.slab
      ? { id: match.slab.id, name: match.slab.name, basis: match.slab.basis }
      : null,
    alternatives: match.alternatives.map((slab) => ({
      id: slab.id,
      name: slab.name,
    })),
    charge,
    lrNumbers: context.lrs.map((lr) => lr.lrNumber),
    unresolvedLrNumbers: context.unresolvedLrNumbers,
    warnings,
  };
};
