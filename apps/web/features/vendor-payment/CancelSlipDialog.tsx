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
import type { VendorPaymentStatus } from "./vendor-payment.service";

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

export type CancelSlipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slipNumber: string;
  status: VendorPaymentStatus;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  pending: boolean;
};

/** DRAFT/PENDING_APPROVAL cancel without reversal; APPROVED reverses the
 * accrual. A partially or fully paid slip can never reach this dialog —
 * the detail page hides the Cancel action for those statuses. */
export function CancelSlipDialog({
  open,
  onOpenChange,
  slipNumber,
  status,
  reason,
  onReasonChange,
  onConfirm,
  pending,
}: CancelSlipDialogProps) {
  const canConfirm = reason.trim().length >= MIN_REASON_LENGTH && !pending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <IconAlertTriangle size={18} />
            </span>
            <DialogTitle>Cancel {slipNumber}?</DialogTitle>
          </div>
          <DialogDescription>
            {status === "APPROVED"
              ? "This reverses the posted accrual journal with a matching contra entry and releases its claimed sources."
              : "No journal was posted yet — this just releases its claimed sources."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor={`cancel-vp-reason-${slipNumber}`} className="text-sm font-medium">
            Cancellation reason
          </label>
          <Textarea
            id={`cancel-vp-reason-${slipNumber}`}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            placeholder="Why is this slip being cancelled?"
            onChange={(event) => onReasonChange(event.target.value)}
            rows={3}
            className="resize-none"
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.trim().length}/{MAX_REASON_LENGTH}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Keep slip
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canConfirm}>
            {pending ? "Cancelling..." : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
