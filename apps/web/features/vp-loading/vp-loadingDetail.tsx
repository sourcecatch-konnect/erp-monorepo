"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBan,
  IconChevronRight,
  IconCircleCheck,
  IconClipboardList,
  IconClock,
  IconEdit,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconRoute,
  IconScale,
  IconTrain,
  IconUsers,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Textarea } from "@skerp/ui/components/textarea";

import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useCan } from "@/features/auth";
import { labourApi } from "@/features/masters/labour/labour.service";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { api } from "@/lib/api";
import { formatPaise } from "@/lib/money";

import {
  useCancelVPWagonLoading,
  useCompleteVPWagonLoading,
  useUpdateVPLoadingAllocation,
  useUpdateVPWagonLoadingLabour,
  useVPLoadingSchedulePreview,
  useVPWagonAllocations,
} from "./hook/useVP-loading";
import type {
  MRRRRowPreview,
  VPLoadingAllocation,
  VPWagonLoadingStatus,
} from "./vp-loading.service";
import { VPScheduleStatusBadge } from "../VP-Schedule/vp-schedule-ui";
import { OneLapTrackerAssignmentPanel } from "./components/OneLapTrackerAssignmentPanel";

const DASH = "-";

type AllocationStatus = "DRAFT" | "LOADED" | "CANCELLED";

type SupervisorOption = {
  id: string;
  name: string;
};

type AllocationGoodsEditRow = {
  grnGoodsId: string;
  goodsName: string;
  loadedQty: string;
  loadingDamageQty: string;
};

function formatDate(value?: string | Date | null) {
  if (!value) return DASH;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return DASH;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return DASH;

  const number = Number(value);
  if (!Number.isFinite(number)) return DASH;

  return number.toLocaleString("en-IN");
}

const numberValue = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const optionalNumber = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const paiseToRupeesInput = (value: number | string | null | undefined) => {
  if (value === undefined || value === null || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return String(number / 100);
};

const wagonStatusConfig: Record<
  VPWagonLoadingStatus,
  { label: string; className: string; dotClassName: string }
> = {
  DRAFT: {
    label: "Not started",
    className: "border-border bg-muted/30 text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
  IN_PROGRESS: {
    label: "Loading",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClassName: "bg-amber-500",
  },
  COMPLETED: {
    label: "Ready to finish",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dotClassName: "bg-blue-500",
  },
  VERIFIED: {
    label: "Completed",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dotClassName: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
    dotClassName: "bg-red-500",
  },
};

function WagonStatusBadge({
  status,
}: {
  status?: VPWagonLoadingStatus | null;
}) {
  const config = wagonStatusConfig[status ?? "DRAFT"];

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <span className={`size-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </span>
  );
}

const allocationStatusConfig: Record<
  AllocationStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "border-border bg-muted/30 text-muted-foreground",
  },
  LOADED: {
    label: "Loaded",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

function AllocationStatusBadge({ status }: { status: string }) {
  const config =
    allocationStatusConfig[status as AllocationStatus] ??
    allocationStatusConfig.DRAFT;

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function ScheduleStatusBadge({ status }: { status?: string | null }) {
  const label =
    status === "MRRR_CREATED"
      ? "Ready for loading"
      : status === "LOADING"
        ? "Loading"
        : status === "LOADED"
          ? "Loaded"
          : status === "VERIFIED"
            ? "Verified"
            : status === "FINALISED"
              ? "Finalised"
              : status === "CANCELLED"
                ? "Cancelled"
                : status === "DRAFT"
                  ? "Draft"
                  : (status ?? "Not started");

  return (
    <span className="inline-flex whitespace-nowrap rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm font-medium text-foreground">
        {value ?? <span className="text-muted-foreground/50">{DASH}</span>}
      </dd>
    </div>
  );
}

function Section({
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
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-none">
            {value}
            {sub ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {sub}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ScheduleProgress({ status }: { status?: string | null }) {
  const steps = [
    { key: "MRRR_CREATED", label: "MR/RR ready" },
    { key: "LOADING", label: "Loading" },
    { key: "LOADED", label: "Loaded" },
    { key: "VERIFIED", label: "Completed" },
    { key: "FINALISED", label: "Finalised" },
  ];
  const currentIndex = Math.max(
    steps.findIndex((step) => step.key === status),
    0,
  );

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-5">
        {steps.map((step, index) => {
          const done = currentIndex >= index;
          const active = currentIndex === index;

          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
                  }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"
                    }`}
                >
                  {step.label}
                </p>
                <div
                  className={`mt-1 h-1.5 rounded-full ${done ? "bg-primary" : "bg-muted"
                    }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function userName(
  user?: { firstName?: string; lastName?: string; userName?: string } | null,
) {
  if (!user) return DASH;

  return (
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.userName ||
    DASH
  );
}

function allocationParty(
  allocation: VPLoadingAllocation,
  key: "consignor" | "consignee",
) {
  return allocation.grn.lorryReceipt.group?.[key]?.name ?? DASH;
}

function rowTitle(row: MRRRRowPreview) {
  return row.vpNo || row.rowLabel || `Row ${row.rowNumber}`;
}

export default function VPLoadingDetail({
  scheduleId,
  initialRowId,
}: {
  scheduleId: string;
  initialRowId?: string;
}) {
  const router = useRouter();
  const canCreate = useCan(PERMS.VP_LOADING.CREATE);
  const canUpdate = useCan(PERMS.VP_LOADING.UPDATE);
  const canComplete = useCan(PERMS.VP_LOADING.COMPLETE);
  const canCancel = useCan(PERMS.VP_LOADING.CANCEL);

  const scheduleQuery = useVPLoadingSchedulePreview(scheduleId);
  const updateAllocation = useUpdateVPLoadingAllocation();
  const updateWagonLabour = useUpdateVPWagonLoadingLabour();
  const completeWagon = useCompleteVPWagonLoading();
  const cancelWagon = useCancelVPWagonLoading();

  const [selectedRowId, setSelectedRowId] = React.useState(initialRowId ?? "");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [editingAllocation, setEditingAllocation] =
    React.useState<VPLoadingAllocation | null>(null);
  const [allocationGoods, setAllocationGoods] = React.useState<
    AllocationGoodsEditRow[]
  >([]);
  const [allocationRemarks, setAllocationRemarks] = React.useState("");
  const [labourOpen, setLabourOpen] = React.useState(false);
  const [labourId, setLabourId] = React.useState("");
  const [labourCharge, setLabourCharge] = React.useState("");
  const [loadingSupervisorId, setLoadingSupervisorId] = React.useState("");
  const [wagonRemarks, setWagonRemarks] = React.useState("");

  const laboursQuery = useQuery({
    queryKey: ["vp-loading", "labours"],
    queryFn: () => labourApi.list({ page: 0, size: 1000 }),
  });

  const supervisorsQuery = useQuery({
    queryKey: ["vp-loading", "supervisors"],
    queryFn: async () => {
      const res = await api.get<{ data: SupervisorOption[] }>(
        "/grn/supervisors",
      );
      return res.data.data;
    },
  });

  const schedule = scheduleQuery.data;
  const rows = React.useMemo(
    () => schedule?.mrRr?.rows?.filter((row) => row.vpNo?.trim()) ?? [],
    [schedule],
  );

  React.useEffect(() => {
    if (initialRowId && rows.some((row) => row.id === initialRowId)) {
      setSelectedRowId(initialRowId);
      return;
    }

    if (!selectedRowId && rows[0]?.id) {
      setSelectedRowId(rows[0].id);
      return;
    }

    if (selectedRowId && !rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(rows[0]?.id ?? "");
    }
  }, [initialRowId, rows, selectedRowId]);

  const selectedRow =
    rows.find((row) => row.id === selectedRowId) ?? rows[0] ?? null;
  const selectedLoading = selectedRow?.vpWagonLoading;
  const allocationsQuery = useVPWagonAllocations(selectedLoading?.id);
  const allocations = allocationsQuery.data ?? [];
  const activeAllocations = allocations.filter(
    (allocation) => allocation.status !== "CANCELLED",
  );

  const labourOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (laboursQuery.data?.data ?? []).map((labour) => ({
        value: labour.id,
        label: `${labour.name}${labour.mobileNo ? ` - ${labour.mobileNo}` : ""}`,
      })),
    [laboursQuery.data],
  );

  const supervisorOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (supervisorsQuery.data ?? []).map((supervisor) => ({
        value: supervisor.id,
        label: supervisor.name,
      })),
    [supervisorsQuery.data],
  );

  const loadingCount = rows.filter(
    (row) => row.vpWagonLoading?.status === "IN_PROGRESS",
  ).length;
  const readyCount = rows.filter(
    (row) => row.vpWagonLoading?.status === "COMPLETED",
  ).length;
  const completedCount = rows.filter(
    (row) => row.vpWagonLoading?.status === "VERIFIED",
  ).length;
  const totalLoadedQty = rows.reduce(
    (sum, row) => sum + Number(row.vpWagonLoading?.totalLoadedQty ?? 0),
    0,
  );

  const showWagon = (rowId: string) => {
    setSelectedRowId(rowId);
    router.replace(
      `/vp-management/vp-loading/${encodeURIComponent(
        scheduleId,
      )}?rowId=${encodeURIComponent(rowId)}`,
      { scroll: false },
    );
  };

  const openAllocationEdit = (allocation: VPLoadingAllocation) => {
    setEditingAllocation(allocation);
    setAllocationRemarks(allocation.remarks ?? "");
    setAllocationGoods(
      allocation.goods.map((goods) => ({
        grnGoodsId: goods.grnGoodsId,
        goodsName: goods.grnGoods?.goodsName ?? goods.grnGoodsId,
        loadedQty: String(goods.loadedQty ?? 0),
        loadingDamageQty: String(goods.loadingDamageQty ?? 0),
      })),
    );
  };

  const openLabourEdit = () => {
    if (!selectedLoading) return;

    setLabourId(selectedLoading.labourId ?? "");
    setLabourCharge(paiseToRupeesInput(selectedLoading.labourCharge));
    setLoadingSupervisorId(selectedLoading.loadingSupervisorId ?? "");
    setWagonRemarks(selectedLoading.remarks ?? "");
    setLabourOpen(true);
  };

  const saveAllocationEdit = async () => {
    if (!schedule || !selectedRow || !selectedLoading || !editingAllocation) {
      return;
    }

    for (const [index, goods] of allocationGoods.entries()) {
      const loadedQty = numberValue(goods.loadedQty);
      const damageQty = numberValue(goods.loadingDamageQty);

      if (loadedQty < 0 || damageQty < 0) {
        toast.error(`Goods row ${index + 1}: quantity cannot be negative`);
        return;
      }

      if (damageQty > loadedQty) {
        toast.error(`Goods row ${index + 1}: damage cannot exceed loaded qty`);
        return;
      }
    }

    if (!allocationGoods.some((goods) => numberValue(goods.loadedQty) > 0)) {
      toast.error("At least one goods row must have loaded quantity");
      return;
    }

    try {
      await updateAllocation.mutateAsync({
        allocationId: editingAllocation.id,
        vpWagonLoadingId: selectedLoading.id,
        mrrrRowId: selectedRow.id,
        gateNo: selectedLoading.gateNo ?? editingAllocation.grn.gateNo ?? "",
        grnId: editingAllocation.grnId,
        body: {
          remarks: allocationRemarks.trim() || undefined,
          version: editingAllocation.version,
          goods: allocationGoods.map((goods) => ({
            grnGoodsId: goods.grnGoodsId,
            loadedQty: numberValue(goods.loadedQty),
            loadingDamageQty: numberValue(goods.loadingDamageQty),
          })),
        },
      });

      toast.success("VP loading quantity updated");
      setEditingAllocation(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const saveLabourEdit = async () => {
    if (!schedule || !selectedRow || !selectedLoading) return;

    try {
      await updateWagonLabour.mutateAsync({
        vpWagonLoadingId: selectedLoading.id,
        mrrrRowId: selectedRow.id,
        scheduleId: schedule.id,
        body: {
          labourId: labourId || undefined,
          labourCharge: optionalNumber(labourCharge),
          loadingSupervisorId: loadingSupervisorId || undefined,
          remarks: wagonRemarks.trim() || undefined,
          version: selectedLoading.version,
        },
      });

      toast.success("Wagon labour updated");
      setLabourOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const runWagonAction = async () => {
    if (!schedule || !selectedRow || !selectedLoading) return;

    try {
      await completeWagon.mutateAsync({
        vpWagonLoadingId: selectedLoading.id,
        mrrrRowId: selectedRow.id,
        scheduleId: schedule.id,
        body: { version: selectedLoading.version },
      });
      toast.success("VP wagon loading completed");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = async (reason: string) => {
    if (!schedule || !selectedRow || !selectedLoading) return;

    try {
      await cancelWagon.mutateAsync({
        vpWagonLoadingId: selectedLoading.id,
        mrrrRowId: selectedRow.id,
        scheduleId: schedule.id,
        body: { reason, version: selectedLoading.version },
      });
      toast.success("VP wagon loading cancelled");
      setCancelOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (scheduleQuery.isLoading || !schedule) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="h-96 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const isActionPending =
    completeWagon.isPending ||
    cancelWagon.isPending ||
    updateAllocation.isPending ||
    updateWagonLabour.isPending;
  const canAddLoading =
    canCreate &&
    selectedRow &&
    Number(selectedRow.eligibleGrnCount ?? 0) > 0 &&
    (!selectedLoading ||
      ["DRAFT", "IN_PROGRESS"].includes(selectedLoading.status));

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/20 p-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => router.push("/vp-management/vp-loading")}
          >
            <IconArrowLeft size={16} className="mr-1.5" />
            Back to VP loading
          </Button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {schedule.scheduleNumber}
              </h1>
              <VPScheduleStatusBadge status={schedule.status} />

            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {schedule.scheduleName || "VP loading schedule"}
            </p>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                <IconRoute
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="truncate">
                  {schedule.fromBranch?.name ?? DASH} to{" "}
                  {schedule.toBranch?.name ?? DASH}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                <IconMapPin
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="truncate">
                  {schedule.sourceArea?.name ?? DASH} to{" "}
                  {schedule.destinationArea?.name ?? DASH}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                <IconClock
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="truncate">
                  {formatDate(schedule.scheduleDate)}
                  {schedule.mrRr?.mrRrNumber
                    ? ` / MR/RR ${schedule.mrRr.mrRrNumber}`
                    : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={scheduleQuery.isFetching}
              onClick={() => scheduleQuery.refetch()}
            >
              <IconRefresh size={14} className="mr-1.5" />
              Refresh
            </Button>

            {schedule.status === "VERIFIED" ? (
              <Button asChild size="sm">
                <Link
                  href={`/vp-management/vp-loading/${encodeURIComponent(
                    schedule.id,
                  )}/final-review`}
                >
                  <IconClipboardList size={14} className="mr-1.5" />
                  Final Review
                </Link>
              </Button>
            ) : null}



            {canAddLoading ? (
              <Button asChild size="sm">
                <Link
                  href={`/vp-management/vp-loading/${encodeURIComponent(
                    schedule.id,
                  )}/edit?rowId=${encodeURIComponent(selectedRow.id)}`}
                >
                  <IconPackage size={14} className="mr-1.5" />
                  Add Loading
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        {schedule.railRake ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-medium text-emerald-700">
              Rail Rake Number
            </p>

            <div className="mt-1 flex items-center gap-2">
              <span className="font-semibold text-emerald-800">
                {schedule.railRake.rakeNumber}
              </span>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
              >
                <Link href={`/vp-management/rail-rakes/${schedule.railRake.id}`}>
                  <IconTrain className="mr-1.5" />
                  View Rake
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <ScheduleProgress status={schedule.status} />

      <OneLapTrackerAssignmentPanel
        scheduleId={schedule.id}
        hostRowId={selectedRow?.id ?? ""}
        hostVpNo={selectedRow?.vpNo}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="VP wagons"
          value={formatNumber(rows.length)}
          icon={<IconTrain size={18} />}
        />
        <MetricCard
          label="In loading"
          value={formatNumber(loadingCount)}
          icon={<IconPackage size={18} />}
        />
        <MetricCard
          label="Ready"
          value={formatNumber(readyCount)}
          icon={<IconClipboardList size={18} />}
        />
        <MetricCard
          label="Completed"
          value={formatNumber(completedCount)}
          icon={<IconCircleCheck size={18} />}
        />
        <MetricCard
          label="Loaded qty"
          value={formatNumber(totalLoadedQty)}
          icon={<IconScale size={18} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Section
            title={`Wagon workspace (${rows.length})`}
            icon={<IconTrain size={15} />}
          >
            {rows.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {rows.map((row: MRRRRowPreview) => {
                  const loading = row.vpWagonLoading;
                  const isSelected = row.id === selectedRow?.id;

                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => showWagon(row.id)}
                      className={`group rounded-lg border bg-background p-4 text-left shadow-sm transition hover:border-primary/50 hover:bg-muted/20 ${isSelected
                        ? "border-primary ring-2 ring-primary/15"
                        : "border-border"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {rowTitle(row)}
                            </p>
                            <WagonStatusBadge status={loading?.status} />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {row.wagon?.name || row.wagonTypeLabel || "Wagon"}
                          </p>
                        </div>
                        <IconChevronRight
                          size={18}
                          className={`mt-0.5 shrink-0 text-muted-foreground transition group-hover:text-primary ${isSelected ? "text-primary" : ""
                            }`}
                        />
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="Gate" value={loading?.gateNo ?? DASH} />
                        <Field
                          label="Loaded"
                          value={formatNumber(loading?.totalLoadedQty ?? 0)}
                        />
                        <Field
                          label="Capacity MT"
                          value={formatNumber(row.wagon?.capacityMt)}
                        />
                        <Field
                          label="Eligible GRNs"
                          value={formatNumber(row.eligibleGrnCount ?? 0)}
                        />
                      </dl>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No VP wagons found"
                description="VP rows from the submitted MR/RR will appear here when they are available for loading."
              />
            )}
          </Section>

          <Section
            title={`LR allocations (${activeAllocations.length})`}
            icon={<IconPackage size={15} />}
            action={
              selectedLoading ? (
                <WagonStatusBadge status={selectedLoading.status} />
              ) : null
            }
          >
            {!selectedLoading ? (
              <EmptyState
                title="Loading has not started"
                description="Add the first LR/GRN to this wagon to start tracking loading details."
              />
            ) : allocationsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-44 w-full rounded-lg" />
                <Skeleton className="h-44 w-full rounded-lg" />
              </div>
            ) : allocations.length ? (
              <div className="space-y-4">
                {allocations.map((allocation) => {
                  const splitCount = (allocation.otherWagons?.length ?? 0) + 1;
                  const canEditAllocation =
                    canUpdate &&
                    allocation.status === "LOADED" &&
                    selectedLoading?.status === "IN_PROGRESS";

                  return (
                    <article
                      key={allocation.id}
                      className="rounded-lg border bg-background p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              LR {allocation.grn.lorryReceipt.lrNumber}
                            </p>
                            <AllocationStatusBadge status={allocation.status} />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            GRN {allocation.grn.grnNumber} /{" "}
                            {allocation.loadingNumber}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="rounded-md bg-muted/30 px-3 py-2 text-sm font-semibold tabular-nums">
                            {formatNumber(allocation.loadedQty)}
                          </div>

                          {canEditAllocation ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openAllocationEdit(allocation)}
                            >
                              <IconEdit size={14} className="mr-1.5" />
                              Edit Qty
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Field
                          label="Consignor"
                          value={allocationParty(allocation, "consignor")}
                        />
                        <Field
                          label="Consignee"
                          value={allocationParty(allocation, "consignee")}
                        />
                        <Field
                          label="Gate"
                          value={allocation.grn.gateNo ?? DASH}
                        />
                        <Field
                          label="Created"
                          value={formatDateTime(allocation.createdAt)}
                        />
                      </dl>

                      {allocation.quantitySummary ? (
                        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3 md:grid-cols-4">
                          <Field
                            label="Total received"
                            value={formatNumber(
                              allocation.quantitySummary.totalReceivedQty,
                            )}
                          />
                          <Field
                            label="Loaded here"
                            value={formatNumber(
                              allocation.quantitySummary.loadedInCurrentWagon,
                            )}
                          />
                          <Field
                            label="Other wagons"
                            value={formatNumber(
                              allocation.quantitySummary.loadedInOtherWagons,
                            )}
                          />
                          <Field
                            label="Available"
                            value={formatNumber(
                              allocation.quantitySummary.availableQty,
                            )}
                          />
                        </dl>
                      ) : null}

                      {allocation.otherWagons?.length ? (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                            <IconAlertCircle
                              size={17}
                              className="mt-0.5 shrink-0"
                            />
                            <p>
                              This LR is split across {splitCount} wagons.
                              {allocation.quantitySummary
                                ? ` ${formatNumber(
                                  allocation.quantitySummary
                                    .loadedInCurrentWagon,
                                )} is loaded here and ${formatNumber(
                                  allocation.quantitySummary
                                    .loadedInOtherWagons,
                                )} is loaded in other wagons.`
                                : " Part of this LR is loaded in other wagons."}
                            </p>
                          </div>

                          <div className="overflow-hidden rounded-lg border">
                            <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {selectedRow ? rowTitle(selectedRow) : DASH}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {selectedRow?.wagon?.name ||
                                    selectedRow?.wagonTypeLabel ||
                                    "Wagon"}
                                  {selectedLoading?.gateNo
                                    ? ` / Gate ${selectedLoading.gateNo}`
                                    : ""}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-semibold">
                                  {formatNumber(
                                    allocation.quantitySummary
                                      ?.loadedInCurrentWagon ??
                                    allocation.loadedQty,
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  This wagon
                                </p>
                              </div>
                            </div>

                            {allocation.otherWagons.map((otherWagon) => (
                              <div
                                key={otherWagon.allocationId}
                                className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {otherWagon.vpNo ||
                                      otherWagon.wagonName ||
                                      "Other wagon"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {otherWagon.wagonName ?? DASH}
                                    {" / Gate "}
                                    {otherWagon.gateNo ?? DASH}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between gap-5 sm:justify-end">
                                  <p className="text-sm font-semibold">
                                    {formatNumber(otherWagon.loadedQty)}
                                  </p>
                                  <Link
                                    href={`/vp-management/vp-loading/${encodeURIComponent(
                                      otherWagon.scheduleId,
                                    )}?rowId=${encodeURIComponent(
                                      otherWagon.mrrrRowId,
                                    )}`}
                                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                                  >
                                    View
                                    <IconChevronRight
                                      size={14}
                                      className="ml-1"
                                    />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {allocation.goods?.length ? (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                            Goods
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {allocation.goods.map((goods) => (
                              <span
                                key={goods.id}
                                className="rounded-md bg-muted px-2.5 py-1 text-xs"
                              >
                                {goods.grnGoods?.goodsName ?? goods.grnGoodsId}
                                {" / Qty "}
                                {formatNumber(goods.loadedQty)}
                                {goods.loadingDamageQty
                                  ? ` / ${formatNumber(
                                    goods.loadingDamageQty,
                                  )} damaged`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No LR allocations found"
                description="Loaded LR/GRN records for the selected wagon will appear here."
              />
            )}
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Section
            title="Selected wagon"
            icon={<IconClipboardList size={15} />}
            action={<WagonStatusBadge status={selectedLoading?.status} />}
          >
            {selectedRow ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-lg font-semibold">
                    {rowTitle(selectedRow)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedRow.wagon?.name ||
                      selectedRow.wagonTypeLabel ||
                      "Wagon"}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-4">
                  <Field label="Gate" value={selectedLoading?.gateNo ?? DASH} />
                  <Field
                    label="Loaded qty"
                    value={formatNumber(selectedLoading?.totalLoadedQty ?? 0)}
                  />
                  <Field label="MR/RR no" value={selectedRow.mrRrNo ?? DASH} />
                  <Field
                    label="Eligible GRNs"
                    value={formatNumber(selectedRow.eligibleGrnCount ?? 0)}
                  />
                  <Field
                    label="Capacity MT"
                    value={formatNumber(selectedRow.wagon?.capacityMt)}
                  />
                  <Field
                    label="Capacity CFT"
                    value={formatNumber(selectedRow.wagon?.totalCft)}
                  />
                  <Field
                    label="Started"
                    value={formatDateTime(selectedLoading?.loadingStartedAt)}
                  />
                  <Field
                    label="Finished"
                    value={formatDateTime(
                      selectedLoading?.verifiedAt ??
                      selectedLoading?.loadingCompletedAt,
                    )}
                  />
                </dl>

                <div className="grid gap-3 border-t pt-4">
                  {canComplete &&
                    selectedLoading &&
                    ["IN_PROGRESS", "COMPLETED"].includes(
                      selectedLoading.status,
                    ) ? (
                    <Button
                      type="button"
                      disabled={isActionPending}
                      onClick={runWagonAction}
                    >
                      <IconCircleCheck size={15} className="mr-1.5" />
                      {completeWagon.isPending
                        ? "Finishing..."
                        : "Complete Loading"}
                    </Button>
                  ) : null}

                  {canAddLoading ? (
                    <Button asChild variant="outline">
                      <Link
                        href={`/vp-management/vp-loading/${encodeURIComponent(
                          schedule.id,
                        )}/edit?rowId=${encodeURIComponent(selectedRow.id)}`}
                      >
                        <IconPackage size={15} className="mr-1.5" />
                        Add LR / GRN
                      </Link>
                    </Button>
                  ) : null}

                  {canCancel &&
                    selectedLoading &&
                    !["VERIFIED", "CANCELLED"].includes(
                      selectedLoading.status,
                    ) ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={isActionPending}
                      onClick={() => setCancelOpen(true)}
                    >
                      <IconBan size={15} className="mr-1.5" />
                      Cancel Loading
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Select a wagon"
                description="Choose a VP wagon from the workspace to review loading details."
              />
            )}
          </Section>

          <Section
            title="Team"
            icon={<IconUsers size={15} />}
            action={
              canUpdate && selectedLoading?.status === "IN_PROGRESS" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openLabourEdit}
                >
                  <IconEdit size={14} className="mr-1.5" />
                  Edit Labour
                </Button>
              ) : null
            }
          >
            <dl className="grid gap-4">
              <Field
                label="Labour"
                value={selectedLoading?.labour?.name ?? DASH}
              />
              <Field
                label="Labour charge"
                value={formatPaise(selectedLoading?.labourCharge)}
              />
              <Field
                label="Supervisor"
                value={userName(selectedLoading?.loadingSupervisor)}
              />
              <Field
                label="Active LRs"
                value={formatNumber(activeAllocations.length)}
              />
            </dl>
          </Section>
        </aside>
      </div>

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel VP loading ${selectedRow?.vpNo ?? ""}`}
        description="This will cancel this VP wagon loading. Cancel active allocations first if the server rejects the request."
        confirmLabel="Cancel loading"
        destructive
        isPending={cancelWagon.isPending}
        onConfirm={handleCancel}
      />

      <Dialog
        open={Boolean(editingAllocation)}
        onOpenChange={(open) => {
          if (!open) setEditingAllocation(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit loaded quantity</DialogTitle>
            <DialogDescription>
              Update the already loaded goods for this LR/GRN before completing
              the wagon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium">
                {editingAllocation
                  ? `LR ${editingAllocation.grn.lorryReceipt.lrNumber}`
                  : DASH}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {editingAllocation
                  ? `GRN ${editingAllocation.grn.grnNumber} / ${editingAllocation.loadingNumber}`
                  : DASH}
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                <span>Goods</span>
                <span>Loaded</span>
                <span>Damage</span>
              </div>

              {allocationGoods.map((goods, index) => (
                <div
                  key={goods.grnGoodsId}
                  className="grid grid-cols-[minmax(0,1fr)_110px_110px] items-center gap-3 border-b px-3 py-3 last:border-b-0"
                >
                  <p className="truncate text-sm font-medium">
                    {goods.goodsName}
                  </p>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={goods.loadedQty}
                    onChange={(event) =>
                      setAllocationGoods((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, loadedQty: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={goods.loadingDamageQty}
                    onChange={(event) =>
                      setAllocationGoods((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, loadingDamageQty: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Remarks
              </label>
              <Textarea
                rows={3}
                value={allocationRemarks}
                onChange={(event) => setAllocationRemarks(event.target.value)}
                placeholder="Any loading notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingAllocation(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={updateAllocation.isPending}
              onClick={saveAllocationEdit}
            >
              {updateAllocation.isPending ? "Saving..." : "Save quantity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labourOpen} onOpenChange={setLabourOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit wagon labour</DialogTitle>
            <DialogDescription>
              Labour details apply to the whole wagon and can be changed only
              while loading is in progress.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Labour
              </label>
              <Combobox
                options={labourOptions}
                value={labourId}
                onChange={setLabourId}
                placeholder="Select labour"
                emptyText="No labour found"
                disabled={laboursQuery.isLoading}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Labour Charge
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={labourCharge}
                onChange={(event) => setLabourCharge(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Loading Supervisor
              </label>
              <Combobox
                options={supervisorOptions}
                value={loadingSupervisorId}
                onChange={setLoadingSupervisorId}
                placeholder="Select supervisor"
                emptyText="No supervisors found"
                disabled={supervisorsQuery.isLoading}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Remarks
              </label>
              <Textarea
                rows={3}
                value={wagonRemarks}
                onChange={(event) => setWagonRemarks(event.target.value)}
                placeholder="Any wagon labour notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLabourOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={updateWagonLabour.isPending}
              onClick={saveLabourEdit}
            >
              {updateWagonLabour.isPending ? "Saving..." : "Save labour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
