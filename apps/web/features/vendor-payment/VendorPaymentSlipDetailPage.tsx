"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import { PERMS } from "@skerp/types";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { vendorPaymentApi } from "./vendor-payment.service";
import { RejectSlipDialog } from "./RejectSlipDialog";
import { CancelSlipDialog } from "./CancelSlipDialog";
import { PageHeader, VendorPaymentStatusBadge, formatDate, money } from "./vendor-payment.ui";

const CANCELLABLE_STATUSES = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED"]);

export function VendorPaymentSlipDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canApprove = useCan(PERMS.ACCOUNTS.PAYMENT.APPROVE);
  const canDisburse = useCan(PERMS.ACCOUNTS.PAYMENT.DISBURSE);
  const canCancel = useCan(PERMS.ACCOUNTS.PAYMENT.CANCEL);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: voucherOpen && Boolean(voucherId),
  });
  const openVoucher = (journalEntryId: string) => {
    setVoucherId(journalEntryId);
    setVoucherOpen(true);
  };

  const query = useQuery({
    queryKey: ["vendor-payment", "slip", id],
    queryFn: () => vendorPaymentApi.slip(id),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["vendor-payment", "slip", id] });

  const submit = useMutation({
    mutationFn: () => {
      const slip = query.data;
      if (!slip) throw new Error("Slip not loaded");
      return vendorPaymentApi.submitSlip(slip.id, slip.version);
    },
    onSuccess: (slip) => {
      toast.success(
        slip.status === "APPROVED"
          ? `${slip.slipNumber} auto-approved and posted`
          : `${slip.slipNumber} submitted — pending approval`,
      );
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit the slip"),
  });

  const approve = useMutation({
    mutationFn: () => {
      const slip = query.data;
      if (!slip) throw new Error("Slip not loaded");
      return vendorPaymentApi.approveSlip(slip.id, slip.version);
    },
    onSuccess: (slip) => {
      toast.success(`${slip.slipNumber} approved and posted`);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not approve the slip"),
  });

  const reject = useMutation({
    mutationFn: () => {
      const slip = query.data;
      if (!slip) throw new Error("Slip not loaded");
      return vendorPaymentApi.rejectSlip(slip.id, slip.version, rejectReason.trim());
    },
    onSuccess: (slip) => {
      toast.success(`${slip.slipNumber} rejected — back to draft`);
      setRejectOpen(false);
      setRejectReason("");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not reject the slip"),
  });

  const cancel = useMutation({
    mutationFn: () => {
      const slip = query.data;
      if (!slip) throw new Error("Slip not loaded");
      return vendorPaymentApi.cancelSlip(slip.id, slip.version, cancelReason.trim());
    },
    onSuccess: (slip) => {
      toast.success(`${slip.slipNumber} cancelled`);
      setCancelOpen(false);
      setCancelReason("");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not cancel the slip"),
  });

  if (query.isLoading) return <Skeleton className="h-96" />;
  const slip = query.data;
  if (!slip) return <p className="text-sm text-muted-foreground">Slip not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={slip.slipNumber}
        description={`${slip.type === "TRANSPORTER" ? "Transporter" : slip.type} payment slip for ${
          slip.transport?.name ?? slip.labour?.name ?? "—"
        } — ${slip.branch?.name ?? "—"}`}
        actions={
          <>
            <VendorPaymentStatusBadge status={slip.status} />
            {slip.status === "DRAFT" ? (
              <Button
                onClick={() => submit.mutate()}
                disabled={submit.isPending || !slip.lines?.length}
              >
                {submit.isPending ? "Submitting..." : "Submit"}
              </Button>
            ) : null}
            {slip.status === "PENDING_APPROVAL" && canApprove ? (
              <>
                <Button variant="outline" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
                <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                  {approve.isPending ? "Approving..." : "Approve"}
                </Button>
              </>
            ) : null}
            {(slip.status === "APPROVED" || slip.status === "PARTIALLY_PAID") && canDisburse ? (
              <Button
                onClick={() => router.push(`/accounts/vendor-payments/${slip.id}/disburse`)}
              >
                Disburse
              </Button>
            ) : null}
            {CANCELLABLE_STATUSES.has(slip.status) && canCancel ? (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                Cancel slip
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => router.push("/accounts/vendor-payments")}>
              Back to register
            </Button>
          </>
        }
      />

      {slip.status === "DRAFT" && slip.rejectionReason ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            <strong>Rejected:</strong> {slip.rejectionReason}
          </p>
        </div>
      ) : null}

      {slip.status === "CANCELLED" && slip.cancelReason ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            <strong>Cancelled:</strong> {slip.cancelReason}
          </p>
        </div>
      ) : null}

      {slip.accrualJournalEntryId ? (
        <Button variant="outline" size="sm" onClick={() => openVoucher(slip.accrualJournalEntryId!)}>
          View accrual voucher
        </Button>
      ) : null}

      <RejectSlipDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        slipNumber={slip.slipNumber}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={() => reject.mutate()}
        pending={reject.isPending}
      />

      <CancelSlipDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        slipNumber={slip.slipNumber}
        status={slip.status}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={() => cancel.mutate()}
        pending={cancel.isPending}
      />

      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Gross payable", value: money(slip.grossPayablePaise) },
          { label: "Total deductions", value: money(slip.totalDeductionsPaise) },
          { label: "Net payable", value: money(slip.netPayablePaise) },
          { label: "Paid so far", value: money(slip.paidPaise) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-base font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Source lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Freight</TableHead>
                <TableHead className="text-right">Detention</TableHead>
                <TableHead className="text-right">Advance</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Hamali</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Damage</TableHead>
                <TableHead className="text-right">Stationery</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(slip.lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-xs">
                    {line.sourceType} · {line.sourceId}
                  </TableCell>
                  <TableCell className="text-right">{money(line.freightPaise)}</TableCell>
                  <TableCell className="text-right">{money(line.detentionPaise)}</TableCell>
                  <TableCell className="text-right">{money(line.advancePaise)}</TableCell>
                  <TableCell className="text-right">{money(line.commissionPaise)}</TableCell>
                  <TableCell className="text-right">{money(line.hamaliPaise)}</TableCell>
                  <TableCell className="text-right">{money(line.tdsPaise)}</TableCell>
                  <TableCell className="text-right">{money(line.damagePaise)}</TableCell>
                  <TableCell className="text-right">{money(line.stationeryPaise)}</TableCell>
                  <TableCell className="text-right font-medium">{money(line.netPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {slip.disbursements?.length ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>Disbursements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {slip.disbursements.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{formatDate(d.paidAt)}</TableCell>
                    <TableCell className="text-xs">{d.mode}</TableCell>
                    <TableCell className="text-xs">{d.referenceNo ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(d.paidPaise)}</TableCell>
                    <TableCell className="text-right">
                      {d.settlementJournalEntryId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openVoucher(d.settlementJournalEntryId!)}
                        >
                          Voucher
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
