"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Card, CardContent, CardHeader } from "@skerp/ui/components/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { vendorPaymentApi, type PaymentMode } from "./vendor-payment.service";
import { Field, PageHeader, money, rupeesToPaise, today } from "./vendor-payment.ui";

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
};

export function VendorPaymentDisbursePage({ id }: { id: string }) {
  const router = useRouter();

  const slipQuery = useQuery({
    queryKey: ["vendor-payment", "slip", id],
    queryFn: () => vendorPaymentApi.slip(id),
  });

  const fundingLedgers = useQuery({
    queryKey: ["vendor-payment", "funding-ledgers"],
    queryFn: () =>
      ledgerApi.chartOfAccounts({ kind: "GL", groups: ["CASH", "BANK"], isActive: true }),
  });

  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<PaymentMode>("BANK");
  const [paidAt, setPaidAt] = React.useState(today());
  const [referenceNo, setReferenceNo] = React.useState("");
  const [fundingLedgerId, setFundingLedgerId] = React.useState("");

  // Generated once per page visit and reused across retries of the *same*
  // attempt — this is the idempotency key. A fresh page visit (new mount)
  // gets a fresh id, which is correct: that's a genuinely new attempt.
  const clientRequestIdRef = React.useRef(crypto.randomUUID());

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: voucherOpen && Boolean(voucherId),
  });

  const slip = slipQuery.data;
  const outstandingPaise = slip ? BigInt(slip.netPayablePaise) - BigInt(slip.paidPaise) : 0n;
  const amountPaise = amount ? BigInt(rupeesToPaise(amount)) : 0n;
  const exceedsOutstanding = amountPaise > outstandingPaise;

  const canSubmit =
    Boolean(slip) &&
    (slip?.status === "APPROVED" || slip?.status === "PARTIALLY_PAID") &&
    amountPaise > 0n &&
    !exceedsOutstanding &&
    Boolean(fundingLedgerId);

  const disburse = useMutation({
    mutationFn: () =>
      vendorPaymentApi.disburse(id, {
        paidPaise: amountPaise.toString(),
        mode,
        paidAt,
        referenceNo: referenceNo.trim() || undefined,
        fundingLedgerId,
        clientRequestId: clientRequestIdRef.current,
      }),
    onSuccess: (updated) => {
      toast.success(
        updated.status === "PAID"
          ? `${updated.slipNumber} fully settled`
          : `${updated.slipNumber} partially paid — ${money(
              BigInt(updated.netPayablePaise) - BigInt(updated.paidPaise),
            )} still outstanding`,
      );
      const posted = updated.disbursements?.[updated.disbursements.length - 1];
      if (posted?.settlementJournalEntryId) {
        setVoucherId(posted.settlementJournalEntryId);
        setVoucherOpen(true);
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not record the payment"),
  });

  if (slipQuery.isLoading) return <Skeleton className="h-96" />;
  if (!slip) return <p className="text-sm text-muted-foreground">Slip not found.</p>;
  if (slip.status !== "APPROVED" && slip.status !== "PARTIALLY_PAID") {
    return (
      <div className="space-y-6">
        <PageHeader title={slip.slipNumber} description="Disburse payment" />
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>Only an approved or partially paid slip can be disbursed. Current status: {slip.status}.</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/accounts/vendor-payments/${id}`)}>
          Back to slip
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Disburse — ${slip.slipNumber}`}
        description={`${slip.transport?.name ?? slip.labour?.name ?? "—"} · Outstanding ${money(outstandingPaise)}`}
        actions={
          <Button variant="outline" onClick={() => router.push(`/accounts/vendor-payments/${id}`)}>
            Back to slip
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Net payable", value: money(slip.netPayablePaise) },
          { label: "Paid so far", value: money(slip.paidPaise) },
          { label: "Outstanding", value: money(outstandingPaise) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-base font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <p className="text-sm font-medium">Payment details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Amount">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                aria-invalid={exceedsOutstanding || undefined}
              />
              {exceedsOutstanding ? (
                <p className="text-xs text-destructive">Exceeds outstanding balance</p>
              ) : null}
            </Field>
            <Field label="Mode">
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Reference no.">
              <Input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Cheque / UTR number"
              />
            </Field>
          </div>
          <Field label="Cash / Bank ledger" className="max-w-sm">
            <Select value={fundingLedgerId} onValueChange={setFundingLedgerId}>
              <SelectTrigger aria-invalid={!fundingLedgerId || undefined}>
                <SelectValue placeholder="Select funding ledger" />
              </SelectTrigger>
              <SelectContent>
                {(fundingLedgers.data ?? []).map((ledger) => (
                  <SelectItem key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              disabled={!canSubmit || disburse.isPending}
              onClick={() => disburse.mutate()}
            >
              {disburse.isPending ? "Recording..." : "Record payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
