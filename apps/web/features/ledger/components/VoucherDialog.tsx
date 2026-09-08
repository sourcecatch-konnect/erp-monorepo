import { IconFileInvoice } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import type { Voucher, VoucherType } from "../voucher.types";
import {
    formatLabel,
    invoiceDate,
    money,
} from "../voucher.util";
import { JournalStatusBadge } from "./journalStatusBadge";

// One line per voucher type — a reversal contra (voucherNumber "REV/...")
// overrides all of these, since it isn't really any one of them.
const VOUCHER_DESCRIPTIONS: Record<VoucherType, string> = {
    SALES: "Double-entry accounting posting generated when the bill was finalised.",
    RECEIPT: "Double-entry accounting posting generated when this receipt was posted.",
    PAYMENT: "Double-entry accounting posting generated when this payment was made.",
    JOURNAL: "Manually posted double-entry journal voucher.",
    CONTRA: "Double-entry accounting posting for this fund transfer.",
    CREDIT_NOTE: "Double-entry accounting posting for this credit note.",
    DEBIT_NOTE: "Double-entry accounting posting for this debit note.",
};

export type VoucherDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    voucher: Voucher | undefined;
    isLoading: boolean;
    isError: boolean;
    errorMessage?: string;
    fallbackVoucherNumber?: string;
};

function VoucherTableSkeleton() {
    return (
        <div className="overflow-hidden rounded-xl border bg-background">
            <div className="grid grid-cols-3 gap-4 border-b bg-muted/40 px-4 py-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-16" />
                <Skeleton className="ml-auto h-4 w-16" />
            </div>

            {[0, 1, 2, 3].map((row) => (
                <div
                    key={row}
                    className="grid grid-cols-3 gap-4 border-b px-4 py-4 last:border-b-0"
                >
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-24" />
                    </div>

                    <Skeleton className="ml-auto h-4 w-20" />
                    <Skeleton className="ml-auto h-4 w-20" />
                </div>
            ))}
        </div>
    );
}

/**
 * Read-only view of a posted double-entry voucher — shared by Billing
 * (SALES voucher, one bill) and Receivables (RECEIPT voucher, one or more
 * bills settled by the same receipt).
 */
export function VoucherDialog({
    open,
    onOpenChange,
    voucher,
    isLoading,
    isError,
    errorMessage,
    fallbackVoucherNumber,
}: VoucherDialogProps) {
    const totalDebit = voucher
        ? voucher.lines.reduce(
            (sum, line) => sum + BigInt(line.debitPaise),
            0n,
        )
        : 0n;

    const totalCredit = voucher
        ? voucher.lines.reduce(
            (sum, line) => sum + BigInt(line.creditPaise),
            0n,
        )
        : 0n;
    const debitLines =
        voucher?.lines.filter(
            (line) => BigInt(line.debitPaise) > 0n,
        ) ?? [];

    const creditLines =
        voucher?.lines.filter(
            (line) => BigInt(line.creditPaise) > 0n,
        ) ?? [];

    // A SALES voucher settles exactly one bill; a RECEIPT voucher can settle
    // several at once, so this list can carry more than one entry.
    const billNumbers = voucher
        ? [
            ...new Set(
                voucher.allocations.map(
                    (allocation) => allocation.bill?.billNumber ?? allocation.billId,
                ),
            ),
        ]
        : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="
    flex
    max-h-[calc(100dvh-2rem)]
    w-[calc(100vw-2rem)]
    max-w-[calc(100vw-2rem)]
    flex-col
    gap-0
    overflow-hidden
    p-0
    sm:max-w-4xl
  "
            >
                {/* Header */}
                <DialogHeader className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-background px-5 py-4 pr-12 text-left sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                            <IconFileInvoice size={22} stroke={1.8} />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-lg font-semibold">
                                    {voucher
                                        ? `${formatLabel(voucher.voucherType)} Voucher`
                                        : "Voucher"}
                                </DialogTitle>

                                {voucher ? (
                                    <JournalStatusBadge status={voucher.status} />
                                ) : null}
                            </div>

                            <p className="break-all text-sm font-medium text-foreground">
                                {voucher?.voucherNumber ??
                                    fallbackVoucherNumber ??
                                    "Voucher details"}
                            </p>

                            <DialogDescription>
                                {voucher
                                    ? voucher.voucherNumber.startsWith("REV/")
                                        ? "Reversal posting — cancels the original voucher with matching contra entries."
                                        : VOUCHER_DESCRIPTIONS[voucher.voucherType]
                                    : "Double-entry accounting posting."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Scrollable body */}
                <div className="overflow-y-auto">
                    <div className="space-y-3 p-4 sm:p-5">
                        {isLoading ? (
                            <>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[0, 1, 2].map((item) => (
                                        <Skeleton
                                            key={item}
                                            className="h-[74px] rounded-xl"
                                        />
                                    ))}
                                </div>

                                <VoucherTableSkeleton />
                            </>
                        ) : null}

                        {!isLoading && isError ? (
                            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                                <p className="text-sm font-medium text-destructive">
                                    {errorMessage ?? "Could not load the voucher"}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    Please close this dialog and try again.
                                </p>
                            </div>
                        ) : null}

                        {!isLoading && !isError && voucher ? (
                            <>
                                {/* Important voucher information */}
                                <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
                                    {/* Linked bill(s) */}
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            {billNumbers.length > 1
                                                ? "Linked bills"
                                                : "Linked bill"}
                                        </p>

                                        <p className="mt-0.5 break-all text-sm font-semibold text-foreground">
                                            {billNumbers.length > 0
                                                ? billNumbers.join(", ")
                                                : (voucher.sourceNumber ?? "—")}
                                        </p>

                                        {voucher.allocations.length > 0 ? (
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {voucher.allocations
                                                    .map((allocation) =>
                                                        formatLabel(allocation.refType),
                                                    )
                                                    .join(" · ")}
                                            </p>
                                        ) : null}
                                    </div>

                                    {/* Voucher information */}
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:justify-end">
                                        <div>
                                            <span className="text-muted-foreground">
                                                Date:
                                            </span>{" "}

                                            <span className="font-medium text-foreground">
                                                {invoiceDate(voucher.voucherDate)}
                                            </span>
                                        </div>

                                        <span className="hidden text-muted-foreground/40 sm:inline">
                                            |
                                        </span>

                                        <div>
                                            <span className="text-muted-foreground">
                                                Branch:
                                            </span>{" "}

                                            <span className="font-medium text-foreground">
                                                {voucher.branch?.name ?? "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>


                                {/* Ledger section heading */}


                                {/* Compact accounting table */}
                                {/* Double-entry ledger */}
                                <section className="space-y-2">
                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold">
                                                Ledger posting
                                            </h3>

                                            <p className="text-xs text-muted-foreground">
                                                Double-entry accounting movement for this
                                                voucher.
                                            </p>
                                        </div>

                                        {totalDebit === totalCredit ? (
                                            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                <span className="size-2 rounded-full bg-emerald-500" />
                                                Balanced
                                            </div>
                                        ) : (
                                            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-destructive">
                                                <span className="size-2 rounded-full bg-destructive" />
                                                Not balanced
                                            </div>
                                        )}
                                    </div>

                                    <div className="overflow-hidden rounded-lg border bg-background">
                                        <div className="grid grid-cols-1 sm:grid-cols-2">
                                            {/* Debit side */}
                                            <div className="flex min-w-0 flex-col sm:border-r">
                                                <div className="flex items-center justify-between border-b bg-blue-50/70 px-4 py-2.5 dark:bg-blue-950/20">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                                            Dr
                                                        </span>

                                                        <div>
                                                            <p className="text-sm font-semibold">
                                                                Debit
                                                            </p>

                                                            <p className="text-[11px] text-muted-foreground">
                                                                Amount receivable and deductions
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 divide-y">
                                                    {debitLines.length > 0 ? (
                                                        debitLines.map((line) => (
                                                            <div
                                                                key={line.id}
                                                                className="flex items-start justify-between gap-4 px-4 py-3"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p
                                                                        className={`break-words text-sm ${line.ledger.kind === "PARTY"
                                                                            ? "font-semibold"
                                                                            : "font-medium"
                                                                            }`}
                                                                    >
                                                                        {line.ledger.name}
                                                                    </p>

                                                                    {line.narration ? (
                                                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                                            {line.narration}
                                                                        </p>
                                                                    ) : null}
                                                                </div>

                                                                <p className="shrink-0 text-sm font-semibold tabular-nums">
                                                                    {money(line.debitPaise)}
                                                                </p>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="px-4 py-5 text-center text-xs text-muted-foreground">
                                                            No debit entries
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2.5">
                                                    <span className="text-sm font-semibold">
                                                        Total debit
                                                    </span>

                                                    <span className="text-sm font-bold tabular-nums">
                                                        {money(totalDebit)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Credit side */}
                                            <div className="flex min-w-0 flex-col border-t sm:border-t-0">
                                                <div className="flex items-center justify-between border-b bg-emerald-50/70 px-4 py-2.5 dark:bg-emerald-950/20">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                                                            Cr
                                                        </span>

                                                        <div>
                                                            <p className="text-sm font-semibold">
                                                                Credit
                                                            </p>

                                                            <p className="text-[11px] text-muted-foreground">
                                                                Income, tax and other credits
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 divide-y">
                                                    {creditLines.length > 0 ? (
                                                        creditLines.map((line) => (
                                                            <div
                                                                key={line.id}
                                                                className="flex items-start justify-between gap-4 px-4 py-3"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p
                                                                        className={`break-words text-sm ${line.ledger.kind === "PARTY"
                                                                            ? "font-semibold"
                                                                            : "font-medium"
                                                                            }`}
                                                                    >
                                                                        {line.ledger.name}
                                                                    </p>

                                                                    {line.narration ? (
                                                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                                            {line.narration}
                                                                        </p>
                                                                    ) : null}
                                                                </div>

                                                                <p className="shrink-0 text-sm font-semibold tabular-nums">
                                                                    {money(line.creditPaise)}
                                                                </p>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="px-4 py-5 text-center text-xs text-muted-foreground">
                                                            No credit entries
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2.5">
                                                    <span className="text-sm font-semibold">
                                                        Total credit
                                                    </span>

                                                    <span className="text-sm font-bold tabular-nums">
                                                        {money(totalCredit)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </>
                        ) : null}

                        {!isLoading && !isError && !voucher ? (
                            <div className="rounded-xl border border-dashed p-8 text-center">
                                <p className="text-sm font-medium">
                                    Voucher is not available
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    No accounting voucher was found for this record.
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="relative z-10 mb-0.5 shrink-0 border-t bg-background px-5 py-3 sm:px-6">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
