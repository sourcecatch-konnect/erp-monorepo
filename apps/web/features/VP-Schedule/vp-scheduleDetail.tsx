// apps/web/features/vp-schedule/components/VPScheduleDetail.tsx

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
  IconInfoCircle,
  IconMapPin,
  IconPackage,
  IconTrain,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";

import ReasonDialog from "@/components/feedback/ReasonDialog";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { useCancelVPSchedule, useConfirmVPSchedule, useVPScheduleDetail } from "./hook/useVPSchedule";
import { formatVPScheduleDate, formatVPScheduleDateTime, VPScheduleStatusBadge } from "./vp-schedule-ui";
import { formatPaise } from "@/lib/money";


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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium leading-none">
        {value}
        {sub ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </p>
    </div>
  );
}

const formatFreight = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "â€”";

  const amount = Number(value);

  if (Number.isNaN(amount)) return "-";

  return formatPaise(amount);
};


export default function VPScheduleDetail({
  scheduleId,
}: {
  scheduleId: string;
}) {
  const router = useRouter();

  const [cancelOpen, setCancelOpen] = React.useState(false);

  const scheduleQuery = useVPScheduleDetail(scheduleId);
  const confirm = useConfirmVPSchedule();
  const cancel = useCancelVPSchedule();

  const schedule = scheduleQuery.data;
  console.log(schedule,"Detail schedule")
  if (scheduleQuery.isLoading || !schedule) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4">
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

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
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

const sourceArea = schedule.sourceArea?.name ?? "—";
const destinationArea = schedule.destinationArea?.name ?? "—";

const sourceCity = schedule.sourceArea?.city?.name ?? "—";
const destinationCity = schedule.destinationArea?.city?.name ?? "—";

  const fromBranch =
    schedule.fromBranch?.name || schedule.fromBranch?.branchCode || "—";

  const toBranch = schedule.toBranch?.name || schedule.toBranch?.branchCode || "—";

  const createdBy = schedule.createdBy
    ? `${schedule.createdBy.firstName ?? ""} ${
        schedule.createdBy.lastName ?? ""
      }`.trim()
    : "—";

  const isDraft = schedule.status === "DRAFT";
  const isPlanned = schedule.status === "PLANNED";
  const isCancelled = schedule.status === "CANCELLED";

  const canEdit = isDraft;
  const canConfirm = isDraft;
  const canCancel = isDraft || isPlanned;

const wagonCounts = schedule.wagonCounts ?? [];
const totalFreight = wagonCounts.reduce((sum: number, wagon: any) => {
  return sum + Number(wagon.totalFreight ?? 0);
}, 0);
  const handleConfirm = () => {
    confirm.mutate(
      {
        id: schedule.id,
        body: {},
      },
      {
        onSuccess: () => {
          toast.success("VP schedule opened");
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
        id: schedule.id,
        body: { reason },
      },
      {
        onSuccess: () => {
          toast.success("VP schedule cancelled");
          setCancelOpen(false);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => router.push("/operations/vp-schedule")}
      >
        <IconArrowLeft size={16} className="mr-1" />
        Back to VP schedules
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {schedule.scheduleNumber}
            </h1>

           <VPScheduleStatusBadge status={schedule.status} />
          </div>

          <p className="text-sm text-muted-foreground">
            {schedule.scheduleName}
          </p>

          <p className="text-xs text-muted-foreground">
           {formatVPScheduleDateTime(schedule.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/operations/vp-schedule/${schedule.id}/edit`)
              }
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

          {canConfirm ? (
            <Button
              size="sm"
              disabled={confirm.isPending}
              onClick={handleConfirm}
            >
              <IconCircleCheck size={14} className="mr-1.5" />
              {confirm.isPending ? "Opening..." : "Mark Open"}
            </Button>
          ) : null}
        </div>
      </div>

    {isCancelled ? (
  <div className="flex items-start gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
    <IconBan size={16} className="mt-0.5 shrink-0" />
    <div>
      <strong className="font-medium text-foreground">Cancelled: </strong>
      This VP schedule has been cancelled.
    </div>
  </div>
) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <CardSection title="Schedule Overview" icon={<IconTrain size={14} />}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Schedule no" value={schedule.scheduleNumber} />
              <Field label="Schedule date" value={formatVPScheduleDate(schedule.scheduleDate)} />
              <Field label="Status" value={<VPScheduleStatusBadge status={schedule.status} />} />
              <Field label="From branch" value={fromBranch} />
              <Field label="To branch" value={toBranch} />
              <Field label="Created by" value={createdBy} />
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
          <IconArrowRight size={14} className="text-muted-foreground" />
          <span>{destinationCity}</span>
        </span>
      }
    />
  </dl>
</CardSection>
<CardSection
  title="Wagon Details"
  icon={<IconPackage size={14} />}
  action={
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">
          Total Wagons
        </span>
        <span className="text-sm font-semibold text-foreground">
          {schedule.totalWagonCount ?? 0}
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
  {wagonCounts.length ? (
    <div className="grid gap-3">
      {wagonCounts.map((wagon: any) => (
        <div
          key={wagon.id}
          className="rounded-xl border bg-background p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <p className="text-sm font-semibold text-foreground">
              {wagon.wagon?.name ?? wagon.wagonName ?? "—"}
            </p>

            <p className="text-xs text-muted-foreground">
              Wagon Count:{" "}
              <span className="font-medium text-foreground">
                {wagon.count ?? wagon.quantity ?? "—"}
              </span>
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-8">
            <div>
              <p className="text-xs text-muted-foreground">Height</p>
              <p className="font-medium">
                {wagon.wagon?.height != null ? wagon.wagon.height : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Width</p>
              <p className="font-medium">
                {wagon.wagon?.width != null ? wagon.wagon.width : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="font-medium">
                {wagon.wagon?.weight != null ? wagon.wagon.weight : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Capacity MT</p>
              <p className="font-medium">
                {wagon.capacityMt ?? wagon.wagon?.capacityMt ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Capacity CFT</p>
              <p className="font-medium">
                {wagon.capacityCft ?? wagon.wagon?.totalCft ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Total MT</p>
              <p className="font-medium">{wagon.totalMt ?? "—"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Total CFT</p>
              <p className="font-medium">
                {wagon.totalCft != null
                  ? Number(wagon.totalCft).toLocaleString("en-IN")
                  : "—"}
              </p>
            </div>
            <div>
  <p className="text-xs text-muted-foreground">Freight Amount</p>
  <p className="font-medium">
    {formatFreight(wagon.freightAmount)}
  </p>
</div>
            
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      No wagon rows added.
    </div>
  )}
</CardSection>

          <CardSection title="Remarks" icon={<IconInfoCircle size={14} />}>
            {schedule.remarks ? (
              <p className="text-sm leading-6 text-foreground">
                {schedule.remarks}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No remarks added.</p>
            )}
          </CardSection>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Wagons" value={schedule.totalWagonCount ?? 0} />
            <StatCard
              label="Capacity"
              value={schedule.totalCapacityMt ?? 0}
              sub="MT"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <StatCard
              label="Capacity CFT"
              value={(schedule.totalCapacityCft ?? 0).toLocaleString("en-IN")}
              sub="CFT"
            />
          </div>

          <CardSection title="Timeline" icon={<IconCalendar size={14} />}>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="mt-1 size-2 rounded-full bg-muted-foreground" />
                <div>
                  <p className="font-medium">Created</p>
                  <p className="text-xs text-muted-foreground">
                    {formatVPScheduleDateTime(schedule.createdAt)}
                  </p>
                </div>
              </div>

              {schedule.updatedAt ? (
                <div className="flex gap-3">
                  <div className="mt-1 size-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">Last updated</p>
                    <p className="text-xs text-muted-foreground">
                      {formatVPScheduleDateTime(schedule.updatedAt)}
                    </p>
                  </div>
                </div>
              ) : null}

              {isPlanned ? (
                <div className="flex gap-3">
                  <div className="mt-1 size-2 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium">Open</p>
                    <p className="text-xs text-muted-foreground">
                      Schedule is open for the next railway process.
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
                      Schedule is no longer active.
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
        title={`Cancel schedule ${schedule.scheduleNumber}`}
        description="This will cancel the VP schedule and it cannot continue in the railway process."
        confirmLabel="Cancel schedule"
        destructive
        isPending={cancel.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
