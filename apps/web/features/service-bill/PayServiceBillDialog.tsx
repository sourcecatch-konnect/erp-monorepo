"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { formatPaise, rupeesToPaise } from "@/lib/money";
import { serviceBillApi, type PaymentMode, type ServiceBill } from "./api/service-bill.service";
import { serviceBillKeys } from "./api/service-bill.keys";

const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: ServiceBill;
  /** Called with the posted payment's journal entry id, if any, so the
   *  caller can open the voucher dialog right after paying. */
  onPaid?: (journalEntryId: string | undefined) => void;
};

/** Pay dialog for a POSTED Service Bill — shared between the Service Bill
 *  List table (pay directly from a row) and the Detail page. */
export function PayServiceBillDialog({ open, onOpenChange, bill, onPaid }: Props) {
  const queryClient = useQueryClient();

  const pending = Number(bill.netAmountPaise) - Number(bill.paidAmountPaise);

  const [payAmount, setPayAmount] = React.useState("");
  const [payTds, setPayTds] = React.useState("");
  const [payMode, setPayMode] = React.useState<PaymentMode>("BANK");
  const [payDate, setPayDate] = React.useState(today());
  const [payReference, setPayReference] = React.useState("");
  const [payAccountId, setPayAccountId] = React.useState("");

  const cashAccounts = useQuery({
    queryKey: serviceBillKeys.cashAccounts,
    queryFn: serviceBillApi.cashAccounts,
    enabled: open,
  });

  React.useEffect(() => {
    if (open) {
      setPayAmount(String(pending / 100));
      setPayTds("");
      setPayMode("BANK");
      setPayDate(today());
      setPayReference("");
      setPayAccountId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const settledThisRound = rupeesToPaise(Number(payAmount) || 0) + rupeesToPaise(Number(payTds) || 0);
  const pendingAfterThisPayment = pending - settledThisRound;

  const pay = useMutation({
    mutationFn: () =>
      serviceBillApi.pay(bill.id, {
        paidPaise: rupeesToPaise(Number(payAmount) || 0),
        tdsPaise: rupeesToPaise(Number(payTds) || 0),
        paymentMode: payMode,
        paymentDate: payDate,
        referenceNumber: payReference.trim() || undefined,
        fromAccountId: payAccountId,
      }),
    onSuccess: (payment) => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: serviceBillKeys.all });
      onOpenChange(false);
      onPaid?.(payment.journalEntry?.id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not pay"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {bill.serviceBillNumber}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Bill pending: <span className="font-semibold">{formatPaise(pending)}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Paid Amount (₹)</label>
            <Input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              TDS (₹) <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input inputMode="decimal" value={payTds} onChange={(e) => setPayTds(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mode</label>
            <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From account</label>
            <Select value={payAccountId} onValueChange={setPayAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {cashAccounts.data?.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Payment date</label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">
              Reference no. <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} />
          </div>
        </div>

        {(Number(payAmount) > 0 || Number(payTds) > 0) && (
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            {formatPaise(pending)} pending − {formatPaise(rupeesToPaise(Number(payAmount) || 0))} paid
            {Number(payTds) > 0 && ` − ${formatPaise(rupeesToPaise(Number(payTds) || 0))} TDS`} ={" "}
            <span
              className={
                pendingAfterThisPayment < 0
                  ? "font-semibold text-destructive"
                  : "font-semibold text-emerald-700 dark:text-emerald-400"
              }
            >
              {pendingAfterThisPayment < 0
                ? "exceeds pending"
                : `${formatPaise(pendingAfterThisPayment)} still pending`}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            disabled={
              !payAmount ||
              Number(payAmount) <= 0 ||
              !payAccountId ||
              settledThisRound > pending ||
              pay.isPending
            }
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? "Paying..." : "Confirm payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
