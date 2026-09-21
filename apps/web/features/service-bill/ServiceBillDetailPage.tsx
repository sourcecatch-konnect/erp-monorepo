"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconFileInvoice, IconCash } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { useCan } from "@/features/auth";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import { serviceBillApi, type PaymentMode } from "./api/service-bill.service";
import { serviceBillKeys } from "./api/service-bill.keys";
import { ServiceBillStatusBadge } from "./serviceBillStatusBadge";

const today = () => new Date().toISOString().slice(0, 10);


export function ServiceBillDetailPage({ serviceBillId }: { serviceBillId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.SERVICEBILL_MANAGE);
  const canPay = useCan(PERMS.WORKSHOP.SERVICEBILL_PAY);

  const bill = useQuery({
    queryKey: serviceBillKeys.detail(serviceBillId),
    queryFn: () => serviceBillApi.get(serviceBillId),
  });
  const cashAccounts = useQuery({
    queryKey: serviceBillKeys.cashAccounts,
    queryFn: serviceBillApi.cashAccounts,
  });

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: voucherOpen && Boolean(voucherId),
  });

  const [payOpen, setPayOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [payTds, setPayTds] = React.useState("");
  const [payMode, setPayMode] = React.useState<PaymentMode>("BANK");
  const [payDate, setPayDate] = React.useState(today());
  const [payReference, setPayReference] = React.useState("");
  const [payAccountId, setPayAccountId] = React.useState("");

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const pay = useMutation({
    mutationFn: () =>
      serviceBillApi.pay(serviceBillId, {
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
      setPayOpen(false);
      setPayAmount("");
      setPayTds("");
      setPayReference("");
      setPayAccountId("");
      if (payment.journalEntry) {
        setVoucherId(payment.journalEntry.id);
        setVoucherOpen(true);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not pay"),
  });

  const cancel = useMutation({
    mutationFn: () => serviceBillApi.cancel(serviceBillId, cancelReason.trim()),
    onSuccess: () => {
      toast.success("Service bill cancelled");
      queryClient.invalidateQueries({ queryKey: serviceBillKeys.all });
      setCancelOpen(false);
      setCancelReason("");
      router.push("/workshop/service-bills");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  const pending = bill.data ? Number(bill.data.netAmountPaise) - Number(bill.data.paidAmountPaise) : 0;
  const settledThisRound = rupeesToPaise(Number(payAmount) || 0) + rupeesToPaise(Number(payTds) || 0);
  const pendingAfterThisPayment = pending - settledThisRound;

  if (bill.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!bill.data) {
    return <p className="text-sm text-muted-foreground">Service bill not found.</p>;
  }

  const sb = bill.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Service Bill</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{sb.serviceBillNumber ?? "Service Bill"}</h1>
            <ServiceBillStatusBadge status={sb.status} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{sb.serviceProvider.name}</span>
            <span>·</span>
            <span>{new Date(sb.billDate).toLocaleDateString("en-IN")}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sb.journalEntry && (
            <Button
              variant="outline"
              onClick={() => {
                setVoucherId(sb.journalEntry!.id);
                setVoucherOpen(true);
              }}
            >
              <IconFileInvoice size={15} className="mr-1" /> Voucher
            </Button>
          )}
          {sb.status === "POSTED" && pending > 0 && canPay && (
            <Button
              onClick={() => {
                setPayAmount(String(pending / 100));
                setPayOpen(true);
              }}
            >
              <IconCash size={15} className="mr-1" /> Pay
            </Button>
          )}
          {sb.status === "POSTED" && canManage && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Cancel bill
            </Button>
          )}
        </div>
      </div>

      <DetailSection title="Bill Details" contentClassName="grid gap-4 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Branch</p>
          <p className="text-sm">
            {sb.branch.name} <span className="text-xs text-muted-foreground">(single workshop — fixed)</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Service Provider</p>
          <p className="text-sm">
            {sb.serviceProvider.shopName
              ? `${sb.serviceProvider.name} (${sb.serviceProvider.shopName})`
              : sb.serviceProvider.name}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Provider&apos;s bill no.</p>
          <p className="text-sm">
            {sb.providerInvoiceNo}
            {sb.providerInvoiceDate && (
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(sb.providerInvoiceDate).toLocaleDateString("en-IN")}
              </span>
            )}
          </p>
        </div>
        {sb.remarks && (
          <div className="space-y-1.5 sm:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">Remarks</p>
            <p className="text-sm text-muted-foreground">{sb.remarks}</p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Billed Services">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">SN</TableHead>
                <TableHead>Job Card</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sb.lines.map((line, i) => (
                <TableRow key={line.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/workshop/job-cards/${line.jobCardServiceLine.jobCard.id}`}
                      className="text-primary hover:underline"
                    >
                      {line.jobCardServiceLine.jobCard.jobCardNumber ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {line.jobCardServiceLine.sparePart.name}
                    {line.jobCardServiceLine.description && (
                      <span className="text-muted-foreground"> ({line.jobCardServiceLine.description})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{line.jobCardServiceLine.qty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(line.jobCardServiceLine.ratePaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPaise(line.amountPaise)}</TableCell>
                </TableRow>
              ))}
              {sb.lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No lines on this bill.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-6 border-t bg-muted/20 px-4 py-2.5 text-sm">
          <span>
            Gross <span className="font-semibold tabular-nums">{formatPaise(sb.grossAmountPaise)}</span>
          </span>
          <span>
            Discount <span className="font-semibold tabular-nums">{formatPaise(sb.discountPaise)}</span>
          </span>
          <span>
            Net <span className="font-semibold tabular-nums">{formatPaise(sb.netAmountPaise)}</span>
          </span>
          <span>
            Paid <span className="font-semibold tabular-nums">{formatPaise(sb.paidAmountPaise)}</span>
          </span>
          <span>
            Pending <span className="font-semibold tabular-nums">{formatPaise(pending)}</span>
          </span>
        </div>
      </DetailSection>

      <Dialog open={payOpen} onOpenChange={(open) => !open && setPayOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay {sb.serviceBillNumber}</DialogTitle>
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
            <Button variant="outline" onClick={() => setPayOpen(false)}>
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

      <Dialog open={cancelOpen} onOpenChange={(open) => !open && setCancelOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {sb.serviceBillNumber}?</DialogTitle>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Cancelling..." : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
      />
    </div>
  );
}
