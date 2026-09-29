import type {
  VendorPartyType,
  VendorStatementLine,
  VendorStatementLineKind,
  VendorStatementView,
} from "@skerp/types";

/**
 * Pure composition core for the Vendor Statement (VP-8) — the Debtor
 * statement's mirror for transporter/labour party ledgers. No Prisma, no
 * I/O — takes plain fixture arrays so it can be unit-tested directly, same
 * split as customer-statement.compute.ts.
 *
 * All money is paise. Balance is Cr-positive here (opposite of the Debtor
 * statement's Dr-positive): an accrual raises what we owe, a payment lowers
 * it — matching the sign convention ledgerForCreditor already uses for
 * every other creditor-side party in this codebase.
 */

export const num = (v: bigint | number): number => Number(v);
const iso = (d: Date): string => d.toISOString();

export type VendorStatementInputRow = {
  id: string;
  date: Date;
  kind: VendorStatementLineKind;
  particulars: string;
  voucherNumber: string | null;
  /** Always the *slip* id — an ACCRUAL row and every PAYMENT row against it
   *  drill into the same slip page, unlike a disbursement's own JournalEntry
   *  whose sourceId is the disbursement, not the slip. */
  slipId: string;
  debitPaise: number;
  creditPaise: number;
  /** Stable tiebreak for rows sharing a `date` (kind order: accrual before payment). */
  sortSeq?: number;
};

export type VendorStatementRange = { from?: Date | null; to?: Date | null };

export type VendorStatementMeta = {
  partyId: string;
  partyType: VendorPartyType;
  partyName: string;
};

export function composeVendorStatement(
  rows: VendorStatementInputRow[],
  range: VendorStatementRange,
  meta: VendorStatementMeta,
): VendorStatementView {
  const from = range.from ?? null;
  const to = range.to ?? null;

  const ordered = rows
    .filter((r) => !to || r.date <= to)
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        (a.sortSeq ?? 0) - (b.sortSeq ?? 0) ||
        a.id.localeCompare(b.id),
    );

  let running = 0;
  let openingBalancePaise = 0;
  const lines: VendorStatementLine[] = [];
  const totals = { accruedPaise: 0, paidPaise: 0, reversedPaise: 0, outstandingPaise: 0 };

  for (const r of ordered) {
    running += r.creditPaise - r.debitPaise;

    if (from && r.date < from) {
      openingBalancePaise = running;
      continue;
    }

    lines.push({
      id: r.id,
      date: iso(r.date),
      kind: r.kind,
      particulars: r.particulars,
      voucherNumber: r.voucherNumber,
      voucherId: r.slipId,
      href: `/accounts/vendor-payments/${r.slipId}`,
      debitPaise: r.debitPaise,
      creditPaise: r.creditPaise,
      runningBalancePaise: running,
    });

    if (r.kind === "ACCRUAL") totals.accruedPaise += r.creditPaise;
    else if (r.kind === "PAYMENT") totals.paidPaise += r.debitPaise;
    else totals.reversedPaise += r.debitPaise;
  }

  const closingBalancePaise = ordered.length ? running : openingBalancePaise;
  totals.outstandingPaise = closingBalancePaise;

  return {
    partyId: meta.partyId,
    partyType: meta.partyType,
    partyName: meta.partyName,
    openingBalancePaise,
    closingBalancePaise,
    lines,
    totals,
  };
}
