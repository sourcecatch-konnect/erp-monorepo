import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@skerp/ui/components/dialog";
import { Textarea } from "@skerp/ui/components/textarea";

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

export type CancelBillDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    billId: string;
    reason: string;
    onReasonChange: (value: string) => void;
    onConfirm: () => void;
    pending: boolean;
};

/** Confirms cancelling a bill — a destructive, recorded action, so the copy
 * spells out exactly what happens before the operator commits. */
export function CancelBillDialog({
    open,
    onOpenChange,
    billId,
    reason,
    onReasonChange,
    onConfirm,
    pending,
}: CancelBillDialogProps) {
    const canConfirm = reason.trim().length >= MIN_REASON_LENGTH && !pending;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                            <IconAlertTriangle size={18} />
                        </span>
                        <DialogTitle>Cancel this bill?</DialogTitle>
                    </div>
                    <DialogDescription>
                        This is recorded in the bill&apos;s history and cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <ul className="list-disc space-y-1 rounded-md border border-destructive/20 bg-destructive/5 p-3 pl-7 text-xs text-muted-foreground">
                    <li>The bill moves to Cancelled.</li>
                    <li>Its LR charges become available for a new bill.</li>
                    <li>
                        If a Sales voucher was already posted, it is reversed with a
                        matching contra entry.
                    </li>
                </ul>
                <div className="space-y-1.5">
                    <label
                        htmlFor={`cancel-reason-${billId}`}
                        className="text-sm font-medium"
                    >
                        Cancellation reason
                    </label>
                    <Textarea
                        id={`cancel-reason-${billId}`}
                        value={reason}
                        maxLength={MAX_REASON_LENGTH}
                        placeholder="For example: Whirlpool must use one combined bill"
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
                        Keep bill
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={!canConfirm}
                    >
                        {pending ? "Cancelling..." : "Confirm cancellation"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
