import { IconEye } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import type { Bill } from "../billing.service";
import { formatLabel, money } from "../billing.util";
import { JournalStatusBadge } from "@/features/ledger/components/journalStatusBadge";

export type BillAccountingCardProps = {
    journalEntry: NonNullable<Bill["journalEntry"]>;
    outstandingAmountPaise: string;
    canViewVoucher: boolean;
    onViewVoucher: () => void;
};

/** Summary of the SALES voucher posted when this bill was finalised, with a
 * link into the full Dr/Cr breakdown. */
export function BillAccountingCard({
    journalEntry,
    outstandingAmountPaise,
    canViewVoucher,
    onViewVoucher,
}: BillAccountingCardProps) {
    return (
        <div className="rounded-md border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Accounting
                    </p>
                    <JournalStatusBadge status={journalEntry.status} />
                </div>
                {canViewVoucher ? (
                    <Button variant="outline" size="sm" onClick={onViewVoucher}>
                        <IconEye size={15} className="mr-1" /> View voucher
                    </Button>
                ) : null}
            </div>
            <dl className="grid gap-x-8 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Voucher type</dt>
                    <dd className="font-medium">
                        {formatLabel(journalEntry.voucherType ?? "SALES")}
                    </dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Voucher number</dt>
                    <dd className="font-medium">{journalEntry.voucherNumber}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Customer outstanding</dt>
                    <dd className="font-medium">{money(outstandingAmountPaise)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Tally</dt>
                    <dd className="font-medium">
                        {journalEntry.tallySyncStatus === "SYNCED"
                            ? "Synced"
                            : journalEntry.tallySyncStatus === "FAILED"
                                ? "Sync failed"
                                : "Not synced"}
                    </dd>
                </div>
            </dl>
        </div>
    );
}
