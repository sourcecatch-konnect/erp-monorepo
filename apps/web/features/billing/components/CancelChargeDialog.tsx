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
import type { AvailableBillCharge } from "../billing.service";
import { formatLabel, money } from "../billing.util";

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

export type CancelChargeDialogProps = {
    charge: AvailableBillCharge | null;
    onOpenChange: (open: boolean) => void;
    reason: string;
    onReasonChange: (value: string) => void;
    onConfirm: () => void;
    pending: boolean;
};

/** Confirms cancelling one manual charge before it's added to a bill. */
export function CancelChargeDialog({
    charge,
    onOpenChange,
    reason,
    onReasonChange,
    onConfirm,
    pending,
}: CancelChargeDialogProps) {
    const canConfirm = reason.trim().length >= MIN_REASON_LENGTH && !pending;
    return (
        <Dialog open={Boolean(charge)} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                            <IconAlertTriangle size={18} />
                        </span>
                        <DialogTitle>Cancel this manual charge?</DialogTitle>
                    </div>
                    <DialogDescription>
                        It disappears from billing but stays in the audit record.
                    </DialogDescription>
                </DialogHeader>
                {charge ? (
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <span className="font-medium">
                            {charge.lrNumber} · {formatLabel(charge.type)}
                        </span>
                        <span className="font-medium">
                            {money(charge.remainingAmountPaise)}
                        </span>
                    </div>
                ) : null}
                <div className="space-y-1.5">
                    <label
                        htmlFor={`charge-cancel-reason-${charge?.id ?? "charge"}`}
                        className="text-sm font-medium"
                    >
                        Cancellation reason
                    </label>
                    <Textarea
                        id={`charge-cancel-reason-${charge?.id ?? "charge"}`}
                        value={reason}
                        maxLength={MAX_REASON_LENGTH}
                        placeholder="For example: Added by mistake during testing"
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
                        Keep charge
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={!canConfirm}>
                        {pending ? "Cancelling..." : "Cancel charge"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
