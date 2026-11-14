"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@skerp/ui/components/dialog";

export function SettlementReversalButton({
  reverse,
}: {
  reverse: (reason: string) => Promise<unknown>;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => reverse(reason.trim()),
    onSuccess: async () => {
      setOpen(false);
      setReason("");
      toast.success("Settlement reversed; balance reopened");
      await Promise.all(
        ["vendor-payment", "service-bill", "job-card", "ledger"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not reverse settlement",
      ),
  });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Reverse
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse settlement?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This posts a reversal voucher and reopens the cash plus TDS
            liability. The original payment stays in history.
          </p>
          <Textarea
            aria-label="Reversal reason"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for reversal"
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Reversing..." : "Confirm reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
