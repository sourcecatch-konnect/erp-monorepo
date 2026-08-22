"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBuildingWarehouse,
  IconCalendarCheck,
  IconCheck,
  IconClock,
  IconFileDescription,
  IconMapPin,
  IconPackage,
  IconReceipt,
  IconRoute,
  IconTrain,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { formatDate, formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import {
  deliveryWorklistApi,
  deliveryWorklistKeys,
} from "./lorry-receipt.service";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const durationLabel = (from?: string | null, to?: string | null) => {
  if (!from || !to) return "Not available";
  const minutes = Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};

export default function LRUnloadingDetailPage({ id }: { id: string }) {
  const query = useQuery({
    queryKey: deliveryWorklistKeys.unloadingReportDetail(id),
    queryFn: () => deliveryWorklistApi.unloadingReportDetail(id),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <section className="rounded-xl border bg-card p-6 text-center">
          <p className="font-semibold">Unloading record not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(query.error)}
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/lorry-receipts/unloading-report">
              Back to unloading records
            </Link>
          </Button>
        </section>
      </div>
    );
  }

  const row = query.data;
  const acknowledged = row.status === "ACKNOWLEDGED";
  const ackItems = new Map(
    row.acknowledgement?.items.map((item) => [item.lrGoodsId, item]) ?? [],
  );
  const loadingLabel = row.loadingLocation
    ? `${row.loadingLocation.name}, ${row.loadingLocation.cityName}`
    : "Pickup location not recorded";
  const unloadingLabel = row.unloadingLocation
    ? `${row.unloadingLocation.name}, ${row.unloadingLocation.cityName}`
    : "Delivery location not recorded";

  const milestones = [
    { label: "Vehicle reported", value: row.delivery.reportedAt },
    { label: "Unloading completed", value: row.delivery.unloadingAt },
    { label: "Receiver handover", value: row.delivery.deliveredAt },
    {
      label: "POD received",
      value: row.acknowledgement?.receivedAt ?? null,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/lorry-receipts/unloading-report">
          <IconArrowLeft size={16} className="mr-1.5" />
          Back to unloading records
        </Link>
      </Button>

      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <IconTruckDelivery size={21} />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    LR unloading record
                  </p>
                  <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                    {row.lrNumber}
                  </h1>
                </div>
                <span
                  className={`ml-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    acknowledged
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  {acknowledged ? (
                    <IconCheck size={13} />
                  ) : (
                    <IconClock size={13} />
                  )}
                  {acknowledged ? "Acknowledged" : "Pending POD"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <span>{formatDate(row.lrDate)}</span>
                <span>•</span>
                <span>{row.groupNumber}</span>
                <span>•</span>
                <span>{row.transportType}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                <span>{row.originBranchName ?? "—"}</span>
                <IconArrowRight size={15} className="text-muted-foreground" />
                <span>{row.destinationBranchName ?? "—"}</span>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link
                href={`/lorry-receipts/${encodeURIComponent(row.lrNumber)}`}
              >
                <IconFileDescription size={16} className="mr-2" />
                Open complete LR
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Delivered",
            value: formatDateTime(row.delivery.deliveredAt),
            hint: row.delivery.receiverName ?? "Receiver not recorded",
            icon: IconCalendarCheck,
          },
          {
            label: "Unloading duration",
            value: durationLabel(
              row.delivery.reportedAt,
              row.delivery.unloadingAt,
            ),
            hint: "Reporting to unloading completion",
            icon: IconClock,
          },
          {
            label: "Delivery challans",
            value: row.deliveryChallans.length,
            hint: `${row.deliveryChallans.reduce((sum, dc) => sum + dc.quantity, 0)} total quantity`,
            icon: IconReceipt,
          },
          {
            label: "POD",
            value: acknowledged ? "Received" : "Pending",
            hint: acknowledged
              ? formatDateTime(row.acknowledgement?.receivedAt)
              : "Awaiting returned document",
            icon: acknowledged ? IconCheck : IconClock,
          },
        ].map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon size={18} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Section
            title="Unloading timeline"
            description="Operational timestamps captured from delivery through returned POD"
            icon={IconClock}
          >
            <div className="grid gap-0 sm:grid-cols-4">
              {milestones.map((milestone, index) => {
                const complete = Boolean(milestone.value);
                return (
                  <div key={milestone.label} className="relative pb-5 sm:pb-0">
                    {index < milestones.length - 1 ? (
                      <span className="absolute left-3 top-6 h-[calc(100%-12px)] w-px bg-border sm:left-6 sm:top-3 sm:h-px sm:w-[calc(100%-24px)]" />
                    ) : null}
                    <div className="relative flex gap-3 sm:block">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          complete
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {complete ? <IconCheck size={14} /> : index + 1}
                      </span>
                      <div className="sm:mt-3 sm:pr-4">
                        <p className="text-sm font-medium">{milestone.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {milestone.value
                            ? formatDateTime(milestone.value)
                            : "Pending"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            title="Delivery challans"
            description="Last-mile dispatch documents connected to this LR"
            icon={IconReceipt}
          >
            {row.deliveryChallans.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {row.deliveryChallans.map((dc) => (
                  <Link
                    key={dc.id}
                    href={`/vp-management/delivery-challans/${dc.id}`}
                    className="rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-primary">
                          {dc.challanNumber}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Loaded {formatDateTime(dc.loadingAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {dc.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <Field label="Vehicle" value={dc.vehicleNumber} />
                      <Field label="Quantity" value={dc.quantity} />
                      <Field label="Driver" value={dc.driverName} />
                      <Field
                        label="Issued"
                        value={formatDateTime(dc.issuedAt)}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active delivery challans found for this LR.
              </p>
            )}
          </Section>

          <Section
            title="Goods and POD quantities"
            description="Booked quantities compared with the returned acknowledgement"
            icon={IconPackage}
          >
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Goods</TableHead>
                    <TableHead className="text-right">Booked</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Damaged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.goods.map((goods) => {
                    const item = ackItems.get(goods.id);
                    return (
                      <TableRow key={goods.id}>
                        <TableCell>
                          <p className="font-medium">{goods.name}</p>
                          {goods.description ? (
                            <p className="text-xs text-muted-foreground">
                              {goods.description}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {goods.quantity} {goods.unit ?? ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {item?.receivedQty ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item?.damagedQty ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-5">
          <Section title="Movement route" icon={IconRoute}>
            <div className="space-y-0">
              {[
                {
                  icon: IconBuildingWarehouse,
                  label: "Pickup",
                  value: loadingLabel,
                },
                row.sourceRailhead
                  ? {
                      icon: IconTrain,
                      label: "Source railhead",
                      value: `${row.sourceRailhead.name}, ${row.sourceRailhead.cityName}`,
                    }
                  : null,
                row.destinationRailhead
                  ? {
                      icon: IconTrain,
                      label: "Destination railhead",
                      value: `${row.destinationRailhead.name}, ${row.destinationRailhead.cityName}`,
                    }
                  : null,
                { icon: IconMapPin, label: "Delivery", value: unloadingLabel },
              ]
                .filter(Boolean)
                .map((stage, index, stages) => {
                  const StageIcon = stage!.icon;
                  return (
                    <div
                      key={stage!.label}
                      className="relative flex gap-3 pb-5 last:pb-0"
                    >
                      {index < stages.length - 1 ? (
                        <span className="absolute left-[15px] top-8 h-[calc(100%-20px)] border-l border-dashed" />
                      ) : null}
                      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-primary">
                        <StageIcon size={15} />
                      </span>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {stage!.label}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {stage!.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Section>

          <Section title="Parties and invoice" icon={IconUser}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Field label="Consignor" value={row.consignorName} />
              <Field label="Consignee" value={row.consigneeName} />
              <Field label="Invoice number" value={row.invoiceNumber} />
              <Field
                label="Invoice amount"
                value={formatPaise(row.invoiceAmount)}
              />
              <Field
                label="Total weight"
                value={
                  row.totalWeight == null
                    ? null
                    : `${row.totalWeight} ${row.weightUnit ?? ""}`
                }
              />
            </dl>
          </Section>

          <Section title="Delivery handover" icon={IconTruckDelivery}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Field label="Receiver" value={row.delivery.receiverName} />
              <Field
                label="Receiver phone"
                value={row.delivery.receiverPhone}
              />
              <Field
                label="Unloading charges"
                value={formatPaise(row.delivery.unloadingCharges)}
              />
              <Field label="Recorded by" value={row.delivery.recordedBy} />
              <Field label="Delivery remarks" value={row.delivery.remark} />
            </dl>
          </Section>

          <Section title="POD acknowledgement" icon={IconFileDescription}>
            {row.acknowledgement ? (
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Field
                  label="POD received"
                  value={formatDateTime(row.acknowledgement.receivedAt)}
                />
                <Field
                  label="Courier"
                  value={row.acknowledgement.courierName}
                />
                <Field
                  label="Docket number"
                  value={row.acknowledgement.courierDocketNo}
                />
                <Field
                  label="Courier charge"
                  value={formatPaise(row.acknowledgement.courierCharge)}
                />
                <Field
                  label="Detention"
                  value={`${row.acknowledgement.detentionDays ?? 0} days · ${formatPaise(row.acknowledgement.detentionAmount)}`}
                />
                <Field
                  label="Damage amount"
                  value={formatPaise(row.acknowledgement.damageAmount)}
                />
                <Field
                  label="Recorded by"
                  value={row.acknowledgement.recordedBy}
                />
                <Field label="Remarks" value={row.acknowledgement.remark} />
              </dl>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                The delivery is complete, but the signed POD has not yet been
                acknowledged.
              </div>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}
