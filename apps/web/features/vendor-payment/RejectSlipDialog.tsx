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

export type RejectSlipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slipNumber: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  pending: boolean;
};

/** Rejection returns the slip to DRAFT with no journal — the reason is
 * required and recorded, so the creator knows what to fix before resubmitting. */
export function RejectSlipDialog({
  open,
  onOpenChange,
  slipNumber,
  reason,
  onReasonChange,
  onConfirm,
  pending,
}: RejectSlipDialogProps) {
  const canConfirm = reason.trim().length >= MIN_REASON_LENGTH && !pending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <IconAlertTriangle size={18} />
            </span>
            <DialogTitle>Reject {slipNumber}?</DialogTitle>
          </div>
          <DialogDescription>
            The slip returns to Draft for correction — no journal is posted, and its claimed
            sources stay reserved so the creator can fix and resubmit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor={`reject-reason-${slipNumber}`} className="text-sm font-medium">
            Rejection reason
          </label>
          <Textarea
            id={`reject-reason-${slipNumber}`}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            placeholder="What needs to change before resubmitting?"
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
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canConfirm}>
            {pending ? "Rejecting..." : "Reject slip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
