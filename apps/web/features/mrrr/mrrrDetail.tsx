"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBan,
  IconCalendar,
  IconCircleCheck,
  IconEdit,
  IconFileDescription,
  IconInfoCircle,
  IconMapPin,
  IconPackage,
  IconTrain,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";

import ReasonDialog from "@/components/feedback/ReasonDialog";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatFreight, MRRRStatusBadge } from "./mrrr-ui";

import { useCancelMRRR, useMRRRDetail, useSubmitMRRR } from "./hook/useMrrr";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value || <span className="text-muted-foreground/50">—</span>}
      </dd>
    </div>
  );
}

function CardSection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          {icon}
          {title}
        </h2>

        {action}
      </div>

      {children}
    </section>
  );
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function MRRRDetail({ mrrrId }: { mrrrId: string }) {
  const router = useRouter();

  const [cancelOpen, setCancelOpen] = React.useState(false);

  const mrrrQuery = useMRRRDetail(mrrrId);
  const submit = useSubmitMRRR();
  const cancel = useCancelMRRR();

  const mrrr = mrrrQuery.data;

  if (mrrrQuery.isLoading || !mrrr) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <Skeleton className="h-5 w-40" />

        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>

          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-60 w-full rounded-lg" />
            <Skeleton className="h-36 w-full rounded-lg" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-52 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const vpSchedule = mrrr.vpSchedule;

  const rows = mrrr.rows ?? [];

  const status = mrrr.status ?? "DRAFT";

  const isDraft = status === "DRAFT";
  const isSubmitted = status === "SUBMITTED";
  const isCancelled = status === "CANCELLED";

  const canEdit = isDraft;
  const canSubmit = isDraft;
  const canCancel = isDraft || isSubmitted;

  const sourceArea = vpSchedule?.sourceArea?.name ?? "—";
  const destinationArea = vpSchedule?.destinationArea?.name ?? "—";

  const sourceCity = vpSchedule?.sourceArea?.city?.name ?? "—";

  const destinationCity = vpSchedule?.destinationArea?.city?.name ?? "—";

  const fromBranch =
    vpSchedule?.fromBranch?.name || vpSchedule?.fromBranch?.branchCode || "—";

  const toBranch =
    vpSchedule?.toBranch?.name || vpSchedule?.toBranch?.branchCode || "—";

  const createdBy = mrrr.createdBy
    ? `${mrrr.createdBy.firstName ?? ""} ${
        mrrr.createdBy.lastName ?? ""
      }`.trim()
    : "—";

  const totalRows = rows.length;

  const totalFreight = rows.reduce((sum: number, row) => {
    const freight =
      row.vpScheduleWagonCount?.freightAmount ?? row.freightAmount ?? 0;

    return sum + Number(freight);
  }, 0);

  const handleSubmit = () => {
    submit.mutate(
      {
        id: mrrr.id,
        body: {},
      },
      {
        onSuccess: () => {
          toast.success("MR/RR submitted");
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  };

  const handleCancel = (reason: string) => {
    cancel.mutate(
      {
        id: mrrr.id,
        body: { reason },
      },
      {
        onSuccess: () => {
          toast.success("MR/RR cancelled");
          setCancelOpen(false);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => router.push("/vp-management/mrrr")}
      >
        <IconArrowLeft size={16} className="mr-1" />
        Back to MR/RR
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {mrrr.mrRrNumber ?? "MR/RR"}
            </h1>

            <MRRRStatusBadge status={status} />
          </div>

          <p className="text-sm text-muted-foreground">
            {vpSchedule?.scheduleNumber
              ? `Created from VP Schedule ${vpSchedule.scheduleNumber}`
              : "Railway MR/RR document"}
          </p>

          <p className="text-xs text-muted-foreground">
            Created on {formatDateTime(mrrr.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/vp-management/mrrr/${mrrr.id}/edit`)}
            >
              <IconEdit size={14} className="mr-1.5" />
              Edit
            </Button>
          ) : null}

          {canCancel ? (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setCancelOpen(true)}
            >
              <IconBan size={14} className="mr-1.5" />
              Cancel
            </Button>
          ) : null}

          {canSubmit ? (
            <Button
              size="sm"
              disabled={submit.isPending}
              onClick={handleSubmit}
            >
              <IconCircleCheck size={14} className="mr-1.5" />
              {submit.isPending ? "Submitting..." : "Submit MR/RR"}
            </Button>
          ) : null}
        </div>
      </div>

      {isCancelled ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <IconBan size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong className="font-medium text-foreground">Cancelled: </strong>
            This MR/RR has been cancelled and cannot continue in the railway
            process.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <CardSection
            title="MR/RR Overview"
            icon={<IconFileDescription size={14} />}
          >
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label="MR/RR no"
                value={mrrr.mrRrNumber ?? "Not generated yet"}
              />

              <Field label="MR/RR date" value={formatDate(mrrr.createdAt)} />

              <Field label="Rake type" value={mrrr.rakeType ?? "—"} />

              <Field
                label="Status"
                value={<MRRRStatusBadge status={status} />}
              />

              <Field label="From branch" value={fromBranch} />
              <Field label="To branch" value={toBranch} />
              <Field label="Created by" value={createdBy} />
              <Field
                label="Last updated"
                value={formatDateTime(mrrr.updatedAt)}
              />
            </dl>
          </CardSection>

          <CardSection title="VP Schedule" icon={<IconTrain size={14} />}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label="Schedule no"
                value={vpSchedule?.scheduleNumber ?? "—"}
              />

              <Field
                label="Schedule name"
                value={vpSchedule?.scheduleName ?? "—"}
              />

              <Field
                label="Schedule date"
                value={formatDate(vpSchedule?.scheduleDate)}
              />

              <Field
                label="Total wagons"
                value={vpSchedule?.totalWagonCount ?? "—"}
              />

              <Field
                label="Total MT"
                value={vpSchedule?.totalCapacityMt ?? "—"}
              />

              <Field
                label="Total CFT"
                value={
                  vpSchedule?.totalCapacityCft != null
                    ? Number(vpSchedule.totalCapacityCft).toLocaleString(
                        "en-IN",
                      )
                    : "—"
                }
              />
            </dl>
          </CardSection>

          <CardSection title="Route Details" icon={<IconMapPin size={14} />}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Source area" value={sourceArea} />
              <Field label="Destination area" value={destinationArea} />

              <Field
                label="Route"
                value={
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span>{sourceCity}</span>
                    <IconArrowRight
                      size={14}
                      className="text-muted-foreground"
                    />
                    <span>{destinationCity}</span>
                  </span>
                }
              />
            </dl>
          </CardSection>

          <CardSection
            title="MR/RR Rows"
            icon={<IconPackage size={14} />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 shadow-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Rows
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {totalRows}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 shadow-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total Freight
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatFreight(totalFreight)}
                  </span>
                </div>
              </div>
            }
          >
            {rows.length ? (
              <div className="overflow-hidden rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                          Wagon
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                          MR/RR NO
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                          Sequence No
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                          VP No
                        </th>

                        <th className="px-3 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                          Freight
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row, index: number) => {
                        const wagonName =
                          row.wagon?.name ?? row.wagonTypeLabel ?? "—";

                        return (
                          <tr
                            key={row.id ?? index}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-3 py-2">
                              {row.rowLabel ?? row.rowNumber ?? index + 1}
                            </td>

                            <td className="px-3 py-2 font-medium">
                              {wagonName}
                            </td>
                            <td className="px-3 py-2">{row.mrRrNo || "—"}</td>
                            <td className="px-3 py-2">
                              {row.sequenceNo || "—"}
                            </td>

                            <td className="px-3 py-2">{row.vpNo || "—"}</td>

                            <td className="px-3 py-2 text-right font-medium">
                              {formatFreight(
                                row.vpScheduleWagonCount?.freightAmount ??
                                  row.freightAmount,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No MR/RR rows added.
              </div>
            )}
          </CardSection>

          <CardSection title="Remarks" icon={<IconInfoCircle size={14} />}>
            {mrrr.remarks ? (
              <p className="text-sm leading-6 text-foreground">
                {mrrr.remarks}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No remarks added.</p>
            )}
          </CardSection>
        </div>

        <div className="space-y-4">
          <CardSection title="Timeline" icon={<IconCalendar size={14} />}>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="mt-1 size-2 rounded-full bg-muted-foreground" />
                <div>
                  <p className="font-medium">Created</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(mrrr.createdAt)}
                  </p>
                </div>
              </div>

              {mrrr.updatedAt ? (
                <div className="flex gap-3">
                  <div className="mt-1 size-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">Last updated</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(mrrr.updatedAt)}
                    </p>
                  </div>
                </div>
              ) : null}

              {isSubmitted ? (
                <div className="flex gap-3">
                  <div className="mt-1 size-2 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium">Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      MR/RR has been submitted for the railway process.
                    </p>
                  </div>
                </div>
              ) : null}

              {isCancelled ? (
                <div className="flex gap-3">
                  <div className="mt-1 size-2 rounded-full bg-red-500" />
                  <div>
                    <p className="font-medium">Cancelled</p>
                    <p className="text-xs text-muted-foreground">
                      MR/RR is no longer active.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </CardSection>
        </div>
      </div>

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel MR/RR ${mrrr.mrRrNumber ?? ""}`}
        description="This will cancel the MR/RR and it cannot continue in the railway process."
        confirmLabel="Cancel MR/RR"
        destructive
        isPending={cancel.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
