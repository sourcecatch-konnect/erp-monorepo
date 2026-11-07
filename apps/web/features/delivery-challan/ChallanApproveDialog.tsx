"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { Label } from "@skerp/ui/components/lable";
import { Textarea } from "@skerp/ui/components/textarea";

import {
  challanAckApi,
  challanAckKeys,
  type ApproveChallanBody,
  type ChallanAckView,
} from "./ack.service";

/**
 * Rule on the broker's claim, head by head.
 *
 * Approving used to post an empty body, which meant every figure defaulted
 * to whatever the broker claimed — and once the deduction heads reached the
 * payable (L4) that was money leaving on his word alone. Each head is now
 * editable, prefilled from his claim so approving unchanged still records
 * exactly what he asked for.
 *
 * Detention is the exception: the amount is capped by the broker's slab on
 * the payment slip, so only the *days* are ruled on here.
 *
 * Posts nothing to the ledger (decision Q9) — it produces the figures the
 * slip will later accrue.
 */

/** Heads the broker charges — these raise what he is paid. */
const CHARGED_HEADS = [
  { key: "approvedParkingPaise", label: "Parking", from: "parkingPaise" },
  { key: "approvedLabourPaise", label: "Labour", from: "labourPaise" },
  { key: "approvedOtherPaise", label: "Other expenses", from: "otherPaise" },
] as const;

/** Heads recovered from the broker — these reduce what he is paid. */
const RECOVERED_HEADS = [
  { key: "approvedDamagePaise", label: "Damage", from: "damagePaise" },
  // Shortage is a quantity on the acknowledgement, never a claimed amount,
  // so there is nothing to prefill — the approver prices it if it is to be
  // recovered at all.
  { key: "approvedShortagePaise", label: "Shortage", from: null },
] as const;

type HeadKey =
  | (typeof CHARGED_HEADS)[number]["key"]
  | (typeof RECOVERED_HEADS)[number]["key"];

const toPaise = (rupees: string): string | null => {
  const trimmed = rupees.trim();
  if (!trimmed) return null;
  return String(Math.round(Number(trimmed) * 100));
};

const toRupees = (paise: string | null | undefined): string =>
  paise === null || paise === undefined ? "" : String(Number(paise) / 100);

export function ChallanApproveDialog({
  challanId,
  view,
  open,
  onOpenChange,
}: {
  challanId: string;
  view: ChallanAckView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const claim = view.broker;

  const [days, setDays] = React.useState("");
  const [heads, setHeads] = React.useState<Record<HeadKey, string>>({
    approvedParkingPaise: "",
    approvedLabourPaise: "",
    approvedOtherPaise: "",
    approvedDamagePaise: "",
    approvedShortagePaise: "",
  });
  const [remarks, setRemarks] = React.useState("");

  // Prefill from the broker's claim each time the dialog opens, so an
  // abandoned edit never carries into the next ruling.
  React.useEffect(() => {
    if (!open) return;
    setDays(
      claim?.claimedDetentionDays === null ||
        claim?.claimedDetentionDays === undefined
        ? ""
        : String(claim.claimedDetentionDays),
    );
    setHeads({
      approvedParkingPaise: toRupees(claim?.parkingPaise),
      approvedLabourPaise: toRupees(claim?.labourPaise),
      approvedOtherPaise: toRupees(claim?.otherPaise),
      approvedDamagePaise: toRupees(claim?.damagePaise),
      approvedShortagePaise: "",
    });
    setRemarks("");
  }, [open, claim]);

  const approve = useMutation({
    mutationFn: (body: ApproveChallanBody) =>
      challanAckApi.approve(challanId, body),
    onSuccess: () => {
      toast.success("Challan approved");
      void queryClient.invalidateQueries({
        queryKey: challanAckKeys.view(challanId),
      });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not approve the challan",
      ),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    approve.mutate({
      approvedDetentionDays: days.trim() ? Number(days) : null,
      approvedParkingPaise: toPaise(heads.approvedParkingPaise),
      approvedLabourPaise: toPaise(heads.approvedLabourPaise),
      approvedOtherPaise: toPaise(heads.approvedOtherPaise),
      approvedDamagePaise: toPaise(heads.approvedDamagePaise),
      approvedShortagePaise: toPaise(heads.approvedShortagePaise),
      remarks: remarks.trim() || null,
    });
  };

  const headInput = (
    head: { key: HeadKey; label: string; from: string | null },
    claimed: string | null | undefined,
  ) => (
    <div key={head.key}>
      <Label htmlFor={`approve-${head.key}`}>{head.label} (₹)</Label>
      <Input
        id={`approve-${head.key}`}
        type="number"
        min={0}
        step="0.01"
        value={heads[head.key]}
        onChange={(e) =>
          setHeads((h) => ({ ...h, [head.key]: e.target.value }))
        }
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {head.from === null
          ? "Not claimed — price it only if it is to be recovered"
          : `Claimed ₹${toRupees(claimed) || "0"}`}
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Approve challan {view.challanNumber}</DialogTitle>
          <DialogDescription>
            Rule on each head the broker claimed. Every figure is prefilled
            with his claim — change what you do not allow. This records
            figures only; the money is accrued later by the payment slip.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <section className="space-y-3">
            <p className="text-sm font-medium">Detention</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="approve-days">Approved detention days</Label>
                <Input
                  id="approve-days"
                  type="number"
                  min={0}
                  step={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Claimed {claim?.claimedDetentionDays ?? 0} day(s)
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The detention <em>amount</em> is not set here — the slip pays
              the lower of the broker&apos;s claim and his slab.
            </p>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">Allowed to the broker</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CHARGED_HEADS.map((head) =>
                headInput(head, claim?.[head.from]),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              These add to what he is paid, and to the TDS base.
            </p>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">Recovered from the broker</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {RECOVERED_HEADS.map((head) =>
                headInput(head, head.from ? claim?.[head.from] : null),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              These reduce what he is paid. Shortage on this challan:{" "}
              {claim?.totalShortageQty ?? 0} unit(s), damaged{" "}
              {claim?.totalDamageQty ?? 0}.
            </p>
          </section>

          <section>
            <Label htmlFor="approve-remarks">Remarks</Label>
            <Textarea
              id="approve-remarks"
              rows={2}
              maxLength={500}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Why a figure was reduced, if it was"
            />
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={approve.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={approve.isPending}>
              Approve
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
