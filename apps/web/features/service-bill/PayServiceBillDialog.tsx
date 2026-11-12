"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { formatPaise } from "@/lib/money";
import {
  serviceBillApi,
  type ServiceBillSummary,
} from "./api/service-bill.service";
import { serviceBillKeys } from "./api/service-bill.keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: ServiceBillSummary;
  onPaid?: (journalEntryId: string | undefined) => void;
};

/** Shared entry point into approval; never disburses directly from a bill. */
export function PayServiceBillDialog({ open, onOpenChange, bill }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prepare = useMutation({
    mutationFn: () => serviceBillApi.preparePayment(bill.id),
    onSuccess: (slip) => {
      void queryClient.invalidateQueries({ queryKey: serviceBillKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["vendor-payment"] });
      onOpenChange(false);
      router.push(`/accounts/vendor-payments/${slip.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not prepare payment",
      ),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prepare service bill payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          {bill.serviceBillNumber} · {bill.serviceProvider.name}
        </p>
        <p className="text-sm">
          Outstanding:{" "}
          {formatPaise(
            (
              BigInt(bill.netAmountPaise) - BigInt(bill.paidAmountPaise)
            ).toString(),
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Prepare a payment slip, submit it for approval, then record cash and
          TDS during disbursement. An existing active slip will be opened.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button disabled={prepare.isPending} onClick={() => prepare.mutate()}>
            {prepare.isPending ? "Preparing..." : "Prepare payment slip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
