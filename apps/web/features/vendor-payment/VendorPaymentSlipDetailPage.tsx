"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

import { vendorPaymentApi } from "./vendor-payment.service";
import { PageHeader, VendorPaymentStatusBadge, formatDate, money } from "./vendor-payment.ui";

export function VendorPaymentSlipDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["vendor-payment", "slip", id],
    queryFn: () => vendorPaymentApi.slip(id),
  });

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
      queryClient.invalidateQueries({ queryKey: ["vendor-payment", "slip", id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit the slip"),
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
            <Button variant="outline" onClick={() => router.push("/accounts/vendor-payments")}>
              Back to register
            </Button>
          </>
        }
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {slip.disbursements.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{formatDate(d.paidAt)}</TableCell>
                    <TableCell className="text-xs">{d.mode}</TableCell>
                    <TableCell className="text-xs">{d.referenceNo ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(d.paidPaise)}</TableCell>
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
