"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconEdit,
  IconSend,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { formatPaise } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import { DeliveryChallanStatusBadge } from "./DeliveryChallanStatusBadge";
import {
  useCancelDeliveryChallan,
  useDeliveryChallanDetail,
  useIssueDeliveryChallan,
} from "./useDeliveryChallan";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
    : "—";

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>

    <div className="mt-1 text-sm font-medium">
      {value === null || value === undefined || value === ""
        ? "—"
        : value}
    </div>
  </div>
);
export default function DeliveryChallanDetail({
  deliveryChallanId,
}: {
  deliveryChallanId: string;
}) {
  const query = useDeliveryChallanDetail(deliveryChallanId);
  const issue = useIssueDeliveryChallan();
  const cancel = useCancelDeliveryChallan();
  const canUpdate = useCan(PERMS.DELIVERY_CHALLAN.UPDATE);
  const canIssue = useCan(PERMS.DELIVERY_CHALLAN.ISSUE);
  const canCancel = useCan(PERMS.DELIVERY_CHALLAN.CANCEL);
  const row = query.data;

  const handleIssue = async () => {
    if (!row || !window.confirm("Issue this Delivery Challan?")) return;
    try {
      await issue.mutateAsync({ id: row.id, version: row.version });
      toast.success("Delivery Challan issued");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = async () => {
    if (!row) return;
    const reason = window.prompt("Enter cancellation reason:");
    if (!reason?.trim()) return;
    try {
      await cancel.mutateAsync({
        id: row.id,
        version: row.version,
        reason: reason.trim(),
      });
      toast.success("Delivery Challan cancelled");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (query.isError || !row) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border bg-card p-5">
          <p className="font-semibold">Unable to load Delivery Challan</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getErrorMessage(query.error)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/vp-management/delivery-challans">
              <IconArrowLeft size={16} />
            </Link>
          </Button>
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconTruckDelivery size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{row.challanNumber}</h1>
              <DeliveryChallanStatusBadge status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(row.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canUpdate && row.status === "DRAFT" ? (
            <Button variant="outline" asChild>
              <Link href={`/vp-management/delivery-challans/${row.id}/edit`}>
                <IconEdit size={16} className="mr-1.5" />
                Edit
              </Link>
            </Button>
          ) : null}
          {canIssue && row.status === "DRAFT" ? (
            <Button onClick={handleIssue} disabled={issue.isPending}>
              <IconSend size={16} className="mr-1.5" />
              Issue
            </Button>
          ) : null}
          {canCancel && row.status !== "CANCELLED" ? (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              <IconX size={16} className="mr-1.5" />
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold">Dispatch details</h2>
          <div className="grid grid-cols-2 gap-4">
            <DetailField
              label="Rake ID"
              value={row.branchGrn.railRake.rakeNumber}
            />
            <DetailField
              label="VP number"
              value={
                row.branchGrn.vpWagonLoading.mrRrRow.vpNo ||
                row.branchGrn.vpWagonLoading.mrRrRow.rowLabel
              }
            />
            <DetailField label="Source branch" value={row.sourceBranch.name} />
            <DetailField
              label="Schedule"
              value={row.branchGrn.railRake.vpSchedule.scheduleNumber}
            />
            <DetailField label="Loading at" value={formatDate(row.loadingAt)} />
            <DetailField
              label="Unloading supervisor"
              value={row.supervisor?.name ?? "—"}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold">
            Vehicle and destination
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Delivery mode" value={row.vehicleMode} />
            <DetailField
              label="Vehicle"
              value={row.vehicleNumberSnapshot || "Client delivery"}
            />
            <DetailField
              label="Transporter"
              value={row.transporterNameSnapshot}
            />
            <DetailField label="Vehicle type" value={row.vehicleTypeSnapshot} />
            <DetailField label="Driver" value={row.driverName} />
            <DetailField label="Driver mobile" value={row.driverMobile} />
            <div className="col-span-2">
              <DetailField
                label="Delivery address"
                value={row.deliveryAddressSnapshot}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Goods</h2>
          <p className="text-xs text-muted-foreground">
            Total quantity: {row.totalQuantity}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LR number</TableHead>
                <TableHead>Consignee</TableHead>
                <TableHead>Goods</TableHead>

                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.lrNumberSnapshot}
                  </TableCell>
                  <TableCell>{item.consigneeNameSnapshot || "—"}</TableCell>
                  <TableCell>{item.goodsNameSnapshot}</TableCell>

                  <TableCell className="text-right font-medium">
                    {item.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            Loading and transport charges
          </h2>

          <p className="text-xs text-muted-foreground">
            Freight, advance and remaining transporter payment.
          </p>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField
            label="Total weight"
            value={
              row.totalWeight !== null &&
                row.totalWeight !== undefined
                ? `${row.totalWeight} MT`
                : "—"
            }
          />

          <DetailField
            label="Freight paid by"
            value={row.paymentBy || "—"}
          />

          <DetailField
            label="Total freight"
            value={formatPaise(row.freightAmount)}
          />

          <DetailField
            label="Advance paid"
            value={formatPaise(row.advanceAmount)}
          />

          <DetailField
            label="Balance payable"
            value={
              <span className="font-semibold text-primary">
                {formatPaise(row.balancePayable)}
              </span>
            }
          />

          <DetailField
            label="Advance paid to"
            value={
              Number(row.advanceAmount ?? 0) > 0
                ? row.transporterNameSnapshot || "Transporter not available"
                : "No advance paid"
            }
          />

          {row.remarks ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <DetailField label="Remarks" value={row.remarks} />
            </div>
          ) : null}
        </div>
      </section>
      {row.cancelReason ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-medium text-destructive">
            Cancellation reason
          </p>
          <p className="mt-1 text-sm">{row.cancelReason}</p>
        </div>
      ) : null}
    </div>
  );
}
