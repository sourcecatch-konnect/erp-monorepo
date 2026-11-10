import type { Prisma } from "../../../generated/prisma/index.js";
import type { db } from "../../../prisma/prisma.js";
import { quoteChallanDetention } from "../detention/detention.service.js";

type DbClient = typeof db | Prisma.TransactionClient;

/**
 * Why an LDC slip line's detention figure is what it is — for the approver.
 *
 * The maker sees the full diagnostic set while browsing eligible challans
 * (`findEligibleLDCSources` returns `detentionWarnings`, the window dates and
 * the matched slab, and the wizard renders them). None of that survived onto
 * the slip, so the person authorising the money saw a bare amount — and a
 * line whose slab did not match showed a plain "₹0" with nothing to say why.
 * This re-derives the working for a saved slip so the approver sees the same
 * diagnostics that were available while the slip was prepared.
 *
 * Read-only. Nothing here writes, and nothing here changes what is paid:
 * `storedDetentionPaise` — the amount the slip actually carries and the
 * accrual actually posted — stays authoritative everywhere. The recomputed
 * figure is shown only so a divergence is visible rather than silent.
 *
 * A divergence is possible even though the slip's inputs are locked (a
 * claimed challan cannot be edited, and `assertNotOnVendorSlip` blocks its
 * report date from moving) because a `DetentionSlab` is editable and
 * soft-deletable. If someone re-rates a slab after a slip was made, `drifts`
 * goes true and the UI says so; the stored figure is not quietly replaced.
 */
export type SlipLineDetentionDiagnostics = {
  /** The DeliveryChallan id — the slip line's `sourceId`. */
  sourceId: string;
  /** What the slip line carries today, and what the accrual posted. */
  storedDetentionPaise: bigint;
  /** What the slab prices it at now. `null` when the quote could not run. */
  recomputedDetentionPaise: bigint | null;
  /** True when the two differ — a slab changed after the slip was made. */
  drifts: boolean;
  /** The slab the recompute matched; `null` when none did. */
  slabName: string | null;
  reportingAt: Date | null;
  unloadingAt: Date | null;
  detentionDays: number | null;
  lrNumbers: string[];
  /** Plain-language reasons the figure may be wrong. Empty when clean. */
  warnings: string[];
};

/**
 * Diagnostics for every active delivery-challan line on a slip.
 *
 * Returns `[]` for a slip with no challan lines (any non-LDC slip), so a
 * caller can hand its result straight to the UI without branching on type.
 *
 * One quote per line, in parallel. Each is two queries behind the 5-minute
 * cache on the slab set, and this runs on a deliberate request for one slip
 * rather than on every slip read — the same trade-off `findEligibleLDCSources`
 * already makes for a page of browse rows. A quote that throws (a challan
 * deleted from under the slip, say) degrades to a warning on that one line
 * instead of failing the whole response.
 */
export async function loadSlipDetentionDiagnostics(
  client: DbClient,
  slipId: string,
): Promise<SlipLineDetentionDiagnostics[]> {
  const lines = await client.vendorPaymentSlipLine.findMany({
    where: { slipId, isActive: true, sourceType: "DELIVERY_CHALLAN" },
    orderBy: { createdAt: "asc" },
    select: { sourceId: true, detentionPaise: true },
  });
  if (lines.length === 0) return [];

  const quotes = await Promise.all(
    lines.map((line) =>
      quoteChallanDetention(line.sourceId).catch(() => null),
    ),
  );

  return lines.map((line, index) => {
    const quote = quotes[index];
    if (!quote) {
      return {
        sourceId: line.sourceId,
        storedDetentionPaise: line.detentionPaise,
        recomputedDetentionPaise: null,
        drifts: false,
        slabName: null,
        reportingAt: null,
        unloadingAt: null,
        detentionDays: null,
        lrNumbers: [],
        warnings: ["Could not re-check the detention working for this challan"],
      };
    }

    const recomputed = quote.charge.amountPaise;
    return {
      sourceId: line.sourceId,
      storedDetentionPaise: line.detentionPaise,
      recomputedDetentionPaise: recomputed,
      drifts: recomputed !== line.detentionPaise,
      slabName: quote.slab?.name ?? null,
      reportingAt: quote.window.finalReportingAt,
      unloadingAt: quote.window.finalUnloadingAt,
      detentionDays: quote.window.detentionDays,
      lrNumbers: quote.lrNumbers,
      warnings: quote.warnings,
    };
  });
}
