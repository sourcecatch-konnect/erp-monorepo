"use client";

import type { LedgerEntryRow, LedgerSourceType } from "@skerp/types";
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
};

export function LedgerTable({
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