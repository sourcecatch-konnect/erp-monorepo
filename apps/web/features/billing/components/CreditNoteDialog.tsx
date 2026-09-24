import { IconFileDollar } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@skerp/ui/components/select";
import type { BillCreditNoteType } from "../billing.service";

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

export type CreditNoteDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    billId: string;
    outstandingAmountPaise: string;
    noteType: BillCreditNoteType;
    onNoteTypeChange: (value: BillCreditNoteType) => void;
    amount: string;
    onAmountChange: (value: string) => void;
    reason: string;
    onReasonChange: (value: string) => void;
    onConfirm: () => void;
    pending: boolean;
};

/** Raises a post-finalisation correction against a bill. GST freezes the
 * invoice itself once issued, so this is a separate document (its own
 * voucher, its own number) rather than an edit to the bill. */
export function CreditNoteDialog({
    open,
    onOpenChange,
    billId,
    outstandingAmountPaise,
    noteType,
    onNoteTypeChange,
    amount,
    onAmountChange,
    reason,
    onReasonChange,
    onConfirm,
    pending,
}: CreditNoteDialogProps) {
    const amountRupees = Number(amount || "0");
    const outstandingRupees = Number(outstandingAmountPaise) / 100;
    const exceedsOutstanding =
        noteType === "CREDIT_NOTE" && amountRupees > outstandingRupees;
    const canConfirm =
        amountRupees > 0 &&
        !exceedsOutstanding &&
        reason.trim().length >= MIN_REASON_LENGTH &&
        !pending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <IconFileDollar size={18} />
                        </span>
                        <DialogTitle>Raise a correction on this bill</DialogTitle>
                    </div>
                    <DialogDescription>
                        The bill itself is not edited — GST freezes it once issued. This
                        posts a separate Credit/Debit Note with its own voucher.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Note type</label>
                    <Select
                        value={noteType}
                        onValueChange={(value) =>
                            onNoteTypeChange(value as BillCreditNoteType)
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CREDIT_NOTE">
                                Credit Note — reduce what the customer owes
                            </SelectItem>
                            <SelectItem value="DEBIT_NOTE">
                                Debit Note — increase what the customer owes
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor={`credit-note-amount-${billId}`}
                        className="text-sm font-medium"
                    >
                        Amount (₹)
                    </label>
                    <Input
                        id={`credit-note-amount-${billId}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => onAmountChange(event.target.value)}
                        placeholder="0.00"
                    />
                    {noteType === "CREDIT_NOTE" ? (
                        <p className="text-xs text-muted-foreground">
                            Outstanding on this bill: ₹{outstandingRupees.toFixed(2)}
                        </p>
                    ) : null}
                    {exceedsOutstanding ? (
                        <p className="text-xs font-medium text-destructive">
                            Exceeds the bill&apos;s outstanding amount
                        </p>
                    ) : null}
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor={`credit-note-reason-${billId}`}
                        className="text-sm font-medium"
                    >
                        Reason
                    </label>
                    <Textarea
                        id={`credit-note-reason-${billId}`}
                        value={reason}
                        maxLength={MAX_REASON_LENGTH}
                        placeholder="For example: Rate renegotiated after invoicing"
                        onChange={(event) => onReasonChange(event.target.value)}
                        rows={3}
                        className="resize-none"
                    />
                    <p className="text-right text-xs text-muted-foreground">
                        {reason.trim().length}/{MAX_REASON_LENGTH}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={pending}
                    >
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={!canConfirm}>
                        {pending ? "Posting..." : "Post note"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
