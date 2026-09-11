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
    <div className="overflow-auto" style={{ maxHeight }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_theme(colors.border)]">
          <TableRow>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Source</TableHead>
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
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(e.occurredAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm" title={e.description}>
                    <div className="truncate">{e.description}</div>
                    {reference ? (
                      <div className="truncate font-mono text-[11px] text-muted-foreground">{reference}</div>
                    ) : null}
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
                  <TableCell className={`text-right ${e.direction === "IN" ? "text-emerald-600" : "text-red-600"}`}>
                    {debit ? <CompactMoney className="text-sm font-medium" value={e.amountPaise} /> : null}
                  </TableCell>
                  <TableCell className={`text-right ${e.direction === "IN" ? "text-emerald-600" : "text-red-600"}`}>
                    {!debit ? <CompactMoney className="text-sm font-medium" value={e.amountPaise} /> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-baseline gap-1">
                      <CompactMoney className="text-sm font-semibold" value={e.runningBalance} />
                      {balanceConvention ? (
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {isDrBalance(e.runningBalance) ? "Dr" : "Cr"}
                        </span>
                      ) : null}
                    </span>
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
