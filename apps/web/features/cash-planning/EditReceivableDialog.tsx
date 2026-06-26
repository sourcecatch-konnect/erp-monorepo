"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  CashReceivable,
  ReceivablesView,
  UpdateCashReceivableBody,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { DatePicker } from "@skerp/ui/components/datepicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { formatPaise } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";

const toPaise = (rupees: string): number => Math.round(Number(rupees) * 100);
const toRupeeInput = (paise: number): string => (paise / 100).toFixed(2);

/** Local-date YYYY-MM-DD (avoids the UTC shift from toISOString). */
const toIsoDate = (d: Date): string => {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

type Props = {
  /** the receivable being edited, or null when the dialog is closed */
  receivable: CashReceivable | null;
  onOpenChange: (open: boolean) => void;
};

export function EditReceivableDialog({ receivable, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const open = receivable != null;

  const [party, setParty] = React.useState("");
  const [total, setTotal] = React.useState("");
  const [expectedAmt, setExpectedAmt] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState<Date | undefined>();

  // Prefill whenever a new receivable is opened.
  React.useEffect(() => {
    if (!receivable) return;
    setParty(receivable.partyName);
    setTotal(toRupeeInput(receivable.totalAmount));
    setExpectedAmt(
      receivable.expectedAmount > 0 ? toRupeeInput(receivable.expectedAmount) : "",
    );
    setExpectedDate(
      receivable.expectedDate ? new Date(receivable.expectedDate) : undefined,
    );
  }, [receivable]);

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateCashReceivableBody = {
        partyName: party.trim(),
        totalAmount: toPaise(total),
        expectedAmount: expectedAmt ? toPaise(expectedAmt) : 0,
        expectedDate: expectedDate ? toIsoDate(expectedDate) : undefined,
      };
      return cashPlanningApi.updateReceivable(receivable!.id, body);
    },
    onSuccess: (view: ReceivablesView) => {
      queryClient.setQueryData(cashPlanningKeys.receivables(), view);
      toast.success("Receivable updated");
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const expectedExceeds =
    expectedAmt !== "" && Number(expectedAmt) > Number(total || "0");
  const canSave =
    party.trim().length > 0 &&
    Number(total) > 0 &&
    !expectedExceeds &&
    !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit receivable</DialogTitle>
          <DialogDescription>
            Update the total pending, the expected slice and its date.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Party</label>
            <Input value={party} onChange={(e) => setParty(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">
                Total pending (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                className="text-right"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">
                Expected amount (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                className="text-right"
                value={expectedAmt}
                onChange={(e) => setExpectedAmt(e.target.value)}
                aria-invalid={expectedExceeds || undefined}
              />
            </div>
          </div>

          {expectedExceeds ? (
            <p className="text-xs text-destructive">
              Expected amount cannot exceed the total pending (
              {formatPaise(toPaise(total || "0"))}).
            </p>
          ) : null}

          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Expected date</label>
            <DatePicker selected={expectedDate} onSelect={setExpectedDate} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
