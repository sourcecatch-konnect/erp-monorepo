"use client";

import Link from "next/link";
import type {
  LedgerEntryRow,
  LedgerSourceType,
  StatementLine,
} from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { CompactMoney } from "./CompactMoney";

const sourceBadge: Record<LedgerSourceType, string> = {
  RECEIPT: "bg-emerald-50 text-emerald-700",
  PAYMENT: "bg-red-50 text-red-700",
  ADJUSTMENT: "bg-muted text-muted-foreground",
};

const sourceLabel: Record<LedgerSourceType, string> = {
  RECEIPT: "Receipt",
  PAYMENT: "Payment",
  ADJUSTMENT: "Adjustment",
};

const statementKindBadge: Record<StatementLine["kind"], string> = {
  BILL: "bg-blue-50 text-blue-700",
  RECEIPT: "bg-emerald-50 text-emerald-700",
  CREDIT_NOTE: "bg-amber-50 text-amber-700",
  DEBIT_NOTE: "bg-orange-50 text-orange-700",
  JOURNAL: "bg-muted text-muted-foreground",
};

const statementKindLabel: Record<StatementLine["kind"], string> = {
  BILL: "Bill",
  RECEIPT: "Receipt",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
  JOURNAL: "Journal",
};

/**
 * Which side of the ledger a positive running balance reads as — see the
 * matching type/comment in LedgerPage.tsx. `null` means "no accounting
 * balance, just a running total" (used for the Expense tab).
 */
export type BalanceConvention = "asset" | "liability" | null;

/**
 * TODO: `reference` isn't on `LedgerEntryRow` yet (as of this file's last
 * sync with @skerp/types). Add `reference?: string` there — the voucher/LR
 * number — to light up the second line under the description. Until then
 * this component degrades gracefully and just omits it.
 */
type EntryWithReference = LedgerEntryRow & { reference?: string };

type Props = {
  entries: LedgerEntryRow[];
  openingBalance: number;
  isLoading: boolean;
  emptyLabel: string;
  /** Controls Debit/Credit column mapping and the Dr/Cr balance suffix. */
  balanceConvention: BalanceConvention;
  /** Caps the scroll area so header + footer totals stay visible on long
   * ledgers instead of pushing the totals bar off-screen. */
  maxHeight?: number;
  /** Opens the source voucher for a row (receipt/payment/adjustment). Rows
   * become clickable only when this is provided. */
  onRowClick?: (entry: LedgerEntryRow) => void;
  /**
   * `"cash"` (default) — the Bank/Cash/Creditor/Expense IN/OUT ledger.
   * `"statement"` — the Debtor customer statement (ACCT-R3): bill / receipt /
   * credit-note rows with server-computed Dr/Cr and drill-down links. When
   * `"statement"`, `statementRows` + `statementOpeningPaise` are used and
   * `entries` / `balanceConvention` are ignored.
   */
  variant?: "cash" | "statement";
  statementRows?: StatementLine[];
  statementOpeningPaise?: number;
};

const dateFmt = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function LedgerTable(props: Props) {
  if (props.variant === "statement") {
    return <StatementTable {...props} />;
  }
  return <CashLedgerTable {...props} />;
}

/* ------------------------------------------------------------------ */
/* Debtor statement (ACCT-R3)                                          */
/* ------------------------------------------------------------------ */

function StatementTable({
  statementRows = [],
  statementOpeningPaise = 0,
  isLoading,
  emptyLabel,
  maxHeight = 480,
}: Props) {
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_theme(colors.border)]">
          <TableRow>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Particulars</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-right text-xs">Debit</TableHead>
            <TableHead className="text-right text-xs">Credit</TableHead>
            <TableHead className="text-right text-xs">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} className="text-xs text-muted-foreground">
              Opening balance
            </TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-baseline gap-1">
                <CompactMoney className="text-sm font-medium" value={statementOpeningPaise} />
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {statementOpeningPaise >= 0 ? "Dr" : "Cr"}
                </span>
              </span>
            </TableCell>
          </TableRow>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : statementRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            statementRows.map((r) => (
              <TableRow key={`${r.kind}-${r.id}`}>
                <TableCell className="whitespace-nowrap text-sm">{dateFmt(r.date)}</TableCell>
                <TableCell className="max-w-sm text-sm">
                  <div className="truncate" title={r.particulars}>
                    {r.href ? (
                      <Link href={r.href} className="text-primary hover:underline">
                        {r.particulars}
                      </Link>
                    ) : (
                      r.particulars
                    )}
                  </div>
                  {r.voucherNumber ? (
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {r.voucherNumber}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statementKindBadge[r.kind]}`}
                  >
                    {statementKindLabel[r.kind]}
                  </span>
                </TableCell>
                <TableCell className="text-right text-red-600">
                  {r.debitPaise > 0 ? (
                    <CompactMoney className="text-sm font-medium" value={r.debitPaise} />
                  ) : null}
                </TableCell>
                <TableCell className="text-right text-emerald-600">
                  {r.creditPaise > 0 ? (
                    <CompactMoney className="text-sm font-medium" value={r.creditPaise} />
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-baseline gap-1">
                    <CompactMoney className="text-sm font-semibold" value={r.runningBalancePaise} />
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {r.runningBalancePaise >= 0 ? "Dr" : "Cr"}
                    </span>
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bank / Cash / Creditor / Expense IN-OUT ledger (unchanged)          */
/* ------------------------------------------------------------------ */
const formatLedgerMoney = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);

function LedgerAmount({
  paise,
  strong = false,
}: {
  paise: number;
  strong?: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap tabular-nums tracking-tight ${strong ? "font-semibold text-foreground" : "font-medium text-foreground"
        }`}
    >
      {formatLedgerMoney(paise)}
    </span>
  );
}
function CashLedgerTable({
  entries,
  openingBalance,
  isLoading,
  emptyLabel,
  balanceConvention,
  maxHeight = 480,
  onRowClick,
}: Props) {
  const isDebitEntry = (direction: LedgerEntryRow["direction"]) => {
    if (!balanceConvention) return direction === "IN";
    return balanceConvention === "liability" ? direction === "OUT" : direction === "IN";
  };

  const isDrBalance = (balance: number) =>
    !balanceConvention || balance >= 0 === (balanceConvention === "asset");

  return (
    <div className="relative overflow-auto" style={{ maxHeight }}>

      <Table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
        <TableHeader >
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 z-20 w-32 border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="sticky top-0 z-20 min-w-72 border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Particulars
            </TableHead>

            <TableHead className="sticky top-0 z-20 w-32 border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Source
            </TableHead>

            <TableHead className="sticky top-0 z-20 w-36 border-b border-border bg-muted text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Debit
            </TableHead>

            <TableHead className="sticky top-0 z-20 w-36 border-b border-border bg-muted text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Credit
            </TableHead>

            <TableHead className="sticky top-0 z-20 w-44 border-b border-border bg-muted text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Balance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} className="text-xs text-muted-foreground">
              Opening balance
            </TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-baseline gap-1">
                <CompactMoney className="text-sm font-medium" value={openingBalance} />
                {balanceConvention ? (
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {isDrBalance(openingBalance) ? "Dr" : "Cr"}
                  </span>
                ) : null}
              </span>
            </TableCell>
          </TableRow>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((e) => {
              const debit = isDebitEntry(e.direction);
              const reference = (e as EntryWithReference).reference;
              return (
                <TableRow
                  key={e.id}
                  onClick={onRowClick ? () => onRowClick(e) : undefined}
                  className={`h-14 border-b border-border/60 transition-colors hover:bg-muted/30 ${onRowClick ? "cursor-pointer" : ""
                    }`}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(e.occurredAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="max-w-[22rem] py-2.5">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-foreground"
                        title={e.description}
                      >
                        {e.description}
                      </p>

                      {reference && (
                        <p
                          className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                          title={reference}
                        >
                          {reference}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${sourceBadge[e.sourceType]}`}
                    >
                      {sourceLabel[e.sourceType]}
                    </span>
                  </TableCell>
                  {/* Colored by cash direction (received vs paid), not by the
                      Debit/Credit column it lands in — keeps the familiar
                      green-in/red-out read accountants already use here,
                      independent of which side the accounting label falls on. */}
                  <TableCell className="text-right">
                    {debit ? (
                      <LedgerAmount paise={e.amountPaise} />
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {!debit ? (
                      <LedgerAmount paise={e.amountPaise} />
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-baseline justify-end gap-1.5">
                      <LedgerAmount paise={Math.abs(e.runningBalance)} strong />
                      {balanceConvention && e.runningBalance !== 0 && (
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {isDrBalance(e.runningBalance) ? "Dr" : "Cr"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
