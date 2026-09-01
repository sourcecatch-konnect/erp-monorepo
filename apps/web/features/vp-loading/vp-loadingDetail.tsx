"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@skerp/ui/components/switch";
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
    label: "Loaded",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dotClassName: "bg-blue-500",
  },
  VERIFIED: {
    label: "Loaded - locked",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dotClassName: "bg-blue-500",
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

function allocationParty(
  allocation: VPLoadingAllocation,
  key: "consignor" | "consignee",
) {
  return allocation.grn.lorryReceipt.group?.[key]?.name ?? DASH;
}

function allocationWeightMt(allocation: VPLoadingAllocation) {
  const weight = allocationWeightMtValue(allocation);
  return weight > 0 ? formatNumber(weight) : DASH;
}

function allocationWeightMtValue(allocation: VPLoadingAllocation) {
  const measuredRows = allocation.goods.filter(
    (goods) =>
      goods.loadedWeightMt !== null && goods.loadedWeightMt !== undefined,
  );
  return measuredRows.length
    ? measuredRows.reduce(
      (total, goods) => total + Number(goods.loadedWeightMt ?? 0),
      0,
    )
    : Number(allocation.grn.totalWeightMt ?? 0);
}

function allocationGoodsNames(allocation: VPLoadingAllocation) {
  const names = [
    ...new Set(
      allocation.goods.map(
        (goods) => goods.grnGoods?.goodsName ?? goods.grnGoodsId,
      ),
    ),
  ];
  return names.length ? names.join(", ") : DASH;
}

function deliveryAt(allocation: VPLoadingAllocation) {
  const location = allocation.grn.lorryReceipt.unloadingLocation;
  if (!location) return DASH;

  return [location.name, location.city?.name].filter(Boolean).join(", ");
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
  const hasMarkLoadedPermission = useCan(PERMS.VP_LOADING.MARK_LOADED);
  const hasCompletePermission = useCan(PERMS.VP_LOADING.COMPLETE);
  const canMarkLoaded = hasMarkLoadedPermission || hasCompletePermission;
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
    queryKey: ["vp-loading", "supervisors", scheduleId],
    queryFn: async () => {
      const res = await api.get<{ data: SupervisorOption[] }>(
        "/vp-loading/supervisors",
        { params: { vpScheduleId: scheduleId } },
      );
      return res.data.data;
    },
    enabled: Boolean(scheduleId),
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
        label: `${labour.name}`,
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
  const totalLoadedQty = rows.reduce(
    (sum, row) => sum + Number(row.vpWagonLoading?.totalLoadedQty ?? 0),
    0,
  );

  const selectedLoadedQty = activeAllocations.reduce(
    (sum, allocation) => sum + Number(allocation.loadedQty ?? 0),
    0,
  );
  const selectedLoadedWeightMt = activeAllocations.reduce(
    (sum, allocation) => sum + allocationWeightMtValue(allocation),
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

  const setWagonLoaded = async (loaded: boolean) => {
    if (!schedule || !selectedRow || !selectedLoading) return;

    try {
      await completeWagon.mutateAsync({
        vpWagonLoadingId: selectedLoading.id,
        mrrrRowId: selectedRow.id,
        scheduleId: schedule.id,
        body: { loaded, version: selectedLoading.version },
      });
      toast.success(
        loaded
          ? "Wagon marked loaded and removed from loading selection"
          : "Wagon reopened and available for loading again",
      );
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
            {/* Schedule Number + Status */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {schedule.scheduleNumber}
              </h1>

              <VPScheduleStatusBadge status={schedule.status} />
            </div>

            {/* Schedule Name */}
            <p className="mt-1 text-sm text-muted-foreground">
              {schedule.scheduleName || "VP loading schedule"}
            </p>

            {/* Details */}
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              {/* Branch */}
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

              {/* Date */}
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

              {/* Location - Full Width */}
              <div className="mt-3 flex items-start gap-3 border-t pt-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconMapPin size={16} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Location
                  </p>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                    <span>{schedule.sourceArea?.name ?? DASH}</span>

                    <IconChevronRight
                      size={15}
                      className="shrink-0 text-muted-foreground"
                    />

                    <span>{schedule.destinationArea?.name ?? DASH}</span>
                  </div>
                </div>
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

            {["LOADED", "VERIFIED"].includes(schedule.status) &&
              schedule.mrRr?.status === "SUBMITTED" &&
              rows.length > 0 &&
              rows.every(
                (row) =>
                  Boolean(row.vpNo?.trim()) &&
                  Boolean(row.vpWagonLoading) &&
                  ["COMPLETED", "VERIFIED"].includes(
                    row.vpWagonLoading?.status ?? "",
                  ),
              ) ? (
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
                <Link
                  href={`/vp-management/rail-rakes/${schedule.railRake.id}`}
                >
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Marked loaded"
          value={formatNumber(readyCount)}
          icon={<IconCircleCheck size={18} />}
        />

        <MetricCard
          label="Loaded qty"
          value={formatNumber(totalLoadedQty)}
          icon={<IconScale size={18} />}
        />
      </div>

      <div className="space-y-4">
        <Section
          title={`1. Choose wagon (${rows.length})`}
          icon={<IconTrain size={15} />}
        >
          {rows.length ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {rows.map((row: MRRRRowPreview) => {
                const loading = row.vpWagonLoading;
                const isSelected = row.id === selectedRow?.id;

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => showWagon(row.id)}
                    className={`group min-w-0 rounded-md border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-muted/20 ${isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">
                        {rowTitle(row)}
                      </p>
                      <IconChevronRight
                        size={15}
                        className={`shrink-0 text-muted-foreground transition group-hover:text-primary ${isSelected ? "text-primary" : ""
                          }`}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <WagonStatusBadge status={loading?.status} />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {formatNumber(loading?.activeLrCount ?? 0)} LRs · Qty{" "}
                        {formatNumber(loading?.totalLoadedQty ?? 0)}
                      </span>
                    </div>
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
          title={`2. Selected wagon: ${selectedRow ? rowTitle(selectedRow) : "Select wagon"}`}
          icon={<IconPackage size={15} />}
        >
          {selectedRow ? (
            <div className="mb-4 overflow-hidden rounded-lg border bg-background">
              <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">
                      {rowTitle(selectedRow)}
                    </p>
                    <WagonStatusBadge status={selectedLoading?.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedRow.wagon?.name ||
                      selectedRow.wagonTypeLabel ||
                      "Wagon"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canAddLoading ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/vp-management/vp-loading/${encodeURIComponent(
                          schedule.id,
                        )}/edit?rowId=${encodeURIComponent(selectedRow.id)}`}
                      >
                        <IconPackage size={14} className="mr-1.5" />
                        Add LR / GRN
                      </Link>
                    </Button>
                  ) : null}

                  {canUpdate &&
                    schedule.status !== "FINALISED" &&
                    ["IN_PROGRESS", "COMPLETED"].includes(
                      selectedLoading?.status ?? "",
                    ) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openLabourEdit}
                    >
                      <IconUsers size={14} className="mr-1.5" />
                      Edit team
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
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={isActionPending}
                      onClick={() => setCancelOpen(true)}
                    >
                      <IconBan size={14} className="mr-1.5" />
                      Cancel loading
                    </Button>
                  ) : null}
                </div>
              </div>

              <dl className="grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                <Field label="MR/RR No." value={selectedRow.mrRrNo ?? DASH} />
                <Field label="Gate" value={selectedLoading?.gateNo ?? DASH} />
                <Field
                  label="Attached LRs"
                  value={formatNumber(activeAllocations.length)}
                />
                <Field
                  label="Loaded qty"
                  value={formatNumber(selectedLoadedQty)}
                />
                <Field
                  label="Weight MT"
                  value={formatNumber(selectedLoadedWeightMt)}
                />
                <Field
                  label="Capacity MT"
                  value={formatNumber(selectedRow.wagon?.capacityMt)}
                />
                <Field
                  label="Supervisor"
                  value={selectedLoading?.loadingSupervisor?.name || DASH}
                />
                <Field
                  label="Labour"
                  value={selectedLoading?.labour?.name ?? DASH}
                />
                <Field
                  label="Labour charge"
                  value={formatPaise(selectedLoading?.labourCharge)}
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

              {selectedLoading &&
                ["IN_PROGRESS", "COMPLETED", "VERIFIED"].includes(
                  selectedLoading.status,
                ) ? (
                <div className="flex items-center justify-between gap-4 border-t bg-muted/10 px-4 py-3">
                  <div className="min-w-0">
                    <label
                      htmlFor="selected-wagon-loaded"
                      className="text-sm font-medium"
                    >
                      Mark as loaded
                    </label>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Mark this wagon when loading is complete. Turn it off to reopen
                      the wagon for loading.
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {["COMPLETED", "VERIFIED"].includes(selectedLoading.status)
                        ? "Loaded"
                        : "In loading"}
                    </span>

                    <Switch
                      id="selected-wagon-loaded"
                      checked={["COMPLETED", "VERIFIED"].includes(
                        selectedLoading.status,
                      )}
                      disabled={
                        selectedLoading.status === "VERIFIED" ||
                        schedule.status === "FINALISED" ||
                        !canMarkLoaded ||
                        isActionPending
                      }
                      onCheckedChange={(checked) => {
                        void setWagonLoaded(checked);
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

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
              {activeAllocations.length ? (
                <div className="overflow-hidden rounded-lg border bg-background">
                  <div className="overflow-x-auto">
                    <table className="min-w-[1800px] w-full text-left text-xs">
                      <thead className="bg-muted/30 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium">
                            S.No.
                          </th>
                          <th className="px-3 py-2 font-medium">
                            VP No. / MR-RR No.
                          </th>
                          <th className="px-1 py-2 font-medium">Consignor</th>
                          <th className="px-1 py-2 font-medium">LR No.</th>
                          <th className="px-3 py-2 font-medium">LR Date</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Loaded Qty
                          </th>
                          <th className="px-3 py-2 font-medium">Goods</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Weight MT
                          </th>
                          <th className="px-3 py-2 font-medium">Invoice</th>
                          <th className="px-3 py-2 font-medium">Consignee</th>
                          <th className="px-3 py-2 font-medium">Delivery At</th>
                          <th className="px-3 py-2 font-medium">Destination</th>
                          <th className="px-3 py-2 font-medium">Supervisor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {activeAllocations.map((allocation, index) => {
                          const lr = allocation.grn.lorryReceipt;
                          return (
                            <tr key={`summary-${allocation.id}`}>
                              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                                {index + 1}
                              </td>
                              <td className="px-3 py-3">
                                <span className="block font-semibold">
                                  {selectedRow?.vpNo || DASH}
                                </span>
                                <span className="text-muted-foreground">
                                  {selectedRow?.mrRrNo || DASH}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {allocationParty(allocation, "consignor")}
                              </td>
                              <td className="px-3 py-3 font-medium">
                                {lr.lrNumber}
                              </td>
                              <td className="px-3 py-3">
                                {formatDate(lr.createdAt)}
                              </td>
                              <td className="px-3 py-3 text-right font-medium tabular-nums">
                                {formatNumber(allocation.loadedQty)}
                              </td>
                              <td className="max-w-60 px-3 py-3">
                                {allocationGoodsNames(allocation)}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                {allocationWeightMt(allocation)}
                              </td>
                              <td className="px-3 py-3">
                                <span className="block font-medium">
                                  {lr.invoiceNumber || DASH}
                                </span>
                                {lr.invoiceAmount ? (
                                  <span className="text-muted-foreground">
                                    {formatPaise(lr.invoiceAmount)}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                {allocationParty(allocation, "consignee")}
                              </td>
                              <td className="px-3 py-3">
                                {deliveryAt(allocation)}
                              </td>
                              <td className="px-3 py-3">
                                {lr.group?.destinationBranch?.name || DASH}
                              </td>
                              <td className="px-3 py-3">
                                {selectedLoading?.loadingSupervisor?.name ||
                                  DASH}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeAllocations.length ? (
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <div>
                    <p className="text-sm font-semibold">
                      LR edit and split details
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use these cards to edit quantity or review an LR split
                      across wagons.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {activeAllocations.length} active
                  </span>
                </div>
              ) : null}

              {allocations.map((allocation) => {
                const splitCount = (allocation.otherWagons?.length ?? 0) + 1;
                const canEditAllocation =
                  canUpdate &&
                  schedule.status !== "FINALISED" &&
                  allocation.status === "LOADED" &&
                  ["IN_PROGRESS", "COMPLETED"].includes(
                    selectedLoading?.status ?? "",
                  );

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
                        {/* Section Header */}
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Goods Details</p>
                            <p className="text-xs text-muted-foreground">
                              Loaded and damaged quantities
                            </p>
                          </div>

                          <span className="text-xs font-medium text-muted-foreground">
                            {allocation.goods.length}{" "}
                            {allocation.goods.length === 1 ? "Item" : "Items"}
                          </span>
                        </div>

                        {/* Goods Table */}
                        <div className="overflow-hidden rounded-lg border bg-background">
                          {/* Header */}
                          <div className="grid grid-cols-[minmax(0,1fr)_100px_100px] items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Goods
                            </p>

                            <p className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Loaded Qty
                            </p>

                            <p className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Damaged
                            </p>
                          </div>

                          {/* Goods Rows */}
                          <div>
                            {allocation.goods.map((goods) => {
                              const damagedQty = Number(goods.loadingDamageQty ?? 0);

                              return (
                                <div
                                  key={goods.id}
                                  className="grid grid-cols-[minmax(0,1fr)_100px_100px] items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/20"
                                >
                                  {/* Goods Name */}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {goods.grnGoods?.goodsName ?? goods.grnGoodsId}
                                    </p>
                                  </div>

                                  {/* Loaded */}
                                  <p className="text-right text-sm font-semibold tabular-nums">
                                    {formatNumber(goods.loadedQty)}
                                  </p>

                                  {/* Damaged */}
                                  <div className="text-right">
                                    {damagedQty > 0 ? (
                                      <span className="inline-flex rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                        {formatNumber(damagedQty)}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
