"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@/lib/money";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconClipboardList,
  IconPackage,
  IconRoute,
  IconScale,
  IconTrain,
  IconUsers,
} from "@tabler/icons-react";

import { PERMS, type CreateVPLoadingAllocationBody } from "@skerp/types";
import { createVPLoadingAllocationSchema } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import FormSection from "@/features/masters/_shared/fields/FormSection";
import { FieldLabel } from "@/features/lorry-receipts/components/moneyField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { labourApi } from "@/features/masters/labour/labour.service";
import { api } from "@/lib/api";

import {
  useCreateVPLoadingAllocation,
  useEligibleVPLoadingGRNs,
  useVPLoadingGates,
  useVPLoadingPreview,
  useVPLoadingSchedulePreview,
  useVPLoadingSchedules,
} from "./hook/useVP-loading";
import type { MRRRRowPreview, VPLoadingPreviewGoods } from "./vp-loading.service";

type Props = {
  mode: "create" | "edit";
};

type VPLoadingFormValues = {
  scheduleDate: string;
  scheduleId: string;
  mrrrRowId: string;
  gateNo: string;
  grnId: string;
  labourId?: string;
  labourCharge?: number | string;
  loadingSupervisorId?: string;
  remarks?: string;
  wagonVersion?: number;
  goods: Array<{
    grnGoodsId: string;
    goodsName: string;
    availableQty: number;
    receivedQty: number;
    alreadyAllocatedQty: number;
    quantityUnitLabel: string;
    loadedQty: number | string;
    loadingDamageQty: number | string;
  }>;
};

type SupervisorOption = {
  id: string;
  name: string;
  email?: string;
};

const DASH = "-";

const numberValue = (value: unknown) => {
  const number =
    typeof value === "number" ? value : Number(String(value ?? "").trim() || 0);

  return Number.isFinite(number) ? number : 0;
};

const optionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  return numberValue(value);
};

const formatNumber = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) return DASH;

  return number.toLocaleString("en-IN");
};

const unitLabel = (row: VPLoadingPreviewGoods) =>
  row.quantityUnit?.symbol || row.quantityUnit?.code || row.quantityUnit?.name || "Qty";

const getParamId = (value: string | string[] | undefined) =>
  decodeURIComponent(Array.isArray(value) ? value[0] ?? "" : value ?? "");

const canAcceptLoading = (status?: string | null) =>
  !status || ["DRAFT", "IN_PROGRESS"].includes(status);

const getLocalDateInputValue = () => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-3">
      <div className="flex items-start gap-2">
        {icon ? (
          <span className="mt-0.5 text-muted-foreground">{icon}</span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">
            {label}
          </p>
          <div className="mt-1 truncate text-sm font-semibold">
            {value ?? DASH}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStep({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${
        done
          ? "bg-emerald-500/10 text-emerald-700"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          done ? "bg-emerald-500" : "bg-muted-foreground/40"
        }`}
      />
      {label}
    </span>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 border-b py-2 last:border-b-0">
      <dt className="text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </dt>

      <dd className="min-w-0 whitespace-normal break-words text-sm font-medium leading-5 text-foreground">
        {value ?? DASH}
      </dd>
    </div>
  );
}

function SummaryPanel({
  title,
  children,
  description,
}: {
  title: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function VPLoadingForm({ mode }: Props) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const scheduleIdFromRoute = mode === "edit" ? getParamId(params?.id) : "";
  const rowIdFromRoute = searchParams.get("rowId") ?? "";
  const canCreate = useCan(PERMS.VP_LOADING.CREATE);

  const form = useForm<VPLoadingFormValues>({
    defaultValues: {
      scheduleDate: getLocalDateInputValue(),
      scheduleId: scheduleIdFromRoute,
      mrrrRowId: "",
      gateNo: "",
      grnId: "",
      labourId: "",
      labourCharge: "",
      loadingSupervisorId: "",
      remarks: "",
      goods: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "goods",
  });

  const scheduleDate = useWatch({ control: form.control, name: "scheduleDate" });
  const scheduleId = useWatch({ control: form.control, name: "scheduleId" });
  const mrrrRowId = useWatch({ control: form.control, name: "mrrrRowId" });
  const gateNo = useWatch({ control: form.control, name: "gateNo" });
  const grnId = useWatch({ control: form.control, name: "grnId" });
  const watchedGoods = useWatch({ control: form.control, name: "goods" }) ?? [];

  const schedulesQuery = useVPLoadingSchedules(scheduleDate);
  const schedulePreview = useVPLoadingSchedulePreview(scheduleId);
  const gatesQuery = useVPLoadingGates(mrrrRowId);
  const grnsQuery = useEligibleVPLoadingGRNs(mrrrRowId, gateNo);
  const loadingPreview = useVPLoadingPreview(mrrrRowId, grnId);
  const createAllocation = useCreateVPLoadingAllocation();

  const laboursQuery = useQuery({
    queryKey: ["vp-loading", "labours"],
    queryFn: () => labourApi.list({ page: 0, size: 1000 }),
  });

  const supervisorsQuery = useQuery({
    queryKey: ["vp-loading", "supervisors"],
    queryFn: async () => {
      const res = await api.get<{ data: SupervisorOption[] }>("/grn/supervisors");
      return res.data.data;
    },
  });

  React.useEffect(() => {
    if (scheduleIdFromRoute) return;

    form.setValue("scheduleId", "");
    form.setValue("mrrrRowId", "");
    form.setValue("gateNo", "");
    form.setValue("grnId", "");
    replace([]);
  }, [form, replace, scheduleDate, scheduleIdFromRoute]);

  React.useEffect(() => {
    if (scheduleIdFromRoute) {
      form.setValue("scheduleId", scheduleIdFromRoute);
    }
  }, [form, scheduleIdFromRoute]);

  React.useEffect(() => {
    if (!scheduleIdFromRoute || !schedulePreview.data?.scheduleDate) return;

    form.setValue(
      "scheduleDate",
      new Date(schedulePreview.data.scheduleDate).toISOString().slice(0, 10),
    );
  }, [form, scheduleIdFromRoute, schedulePreview.data?.scheduleDate]);

  React.useEffect(() => {
    if (
      rowIdFromRoute &&
      schedulePreview.data?.mrRr?.rows?.some(
        (row) =>
          row.id === rowIdFromRoute &&
          row.vpNo?.trim() &&
          canAcceptLoading(row.vpWagonLoading?.status),
      )
    ) {
      form.setValue("mrrrRowId", rowIdFromRoute, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, rowIdFromRoute, schedulePreview.data]);

  React.useEffect(() => {
    if (scheduleIdFromRoute && scheduleId === scheduleIdFromRoute) {
      return;
    }

    form.setValue("mrrrRowId", "");
    form.setValue("gateNo", "");
    form.setValue("grnId", "");
    replace([]);
  }, [form, replace, scheduleId, scheduleIdFromRoute]);

  React.useEffect(() => {
    form.setValue("gateNo", "");
    form.setValue("grnId", "");
    replace([]);
  }, [form, replace, mrrrRowId]);

  React.useEffect(() => {
    form.setValue("grnId", "");
    replace([]);
  }, [form, replace, gateNo]);

  React.useEffect(() => {
    const preview = loadingPreview.data;
    if (!preview) {
      replace([]);
      return;
    }

    form.setValue("wagonVersion", preview.vpWagonLoading?.version);
    replace(
      preview.goods.map((row) => ({
        grnGoodsId: row.grnGoodsId,
        goodsName: row.goodsName,
        availableQty: numberValue(row.availableQty),
        receivedQty: numberValue(row.receivedQty),
        alreadyAllocatedQty: numberValue(row.alreadyAllocatedQty),
        quantityUnitLabel: unitLabel(row),
        loadedQty: numberValue(row.suggestedLoadQty),
        loadingDamageQty: 0,
      })),
    );
  }, [form, loadingPreview.data, replace]);

  const scheduleOptions = React.useMemo<ComboboxOption[]>(

    () =>

      (schedulesQuery.data ?? [])

        .filter((schedule) =>

          (schedule.loadingRows ?? []).some((row) =>

            canAcceptLoading(row.vpWagonLoading?.status),

          ),

        )

        .map((schedule) => ({

          value: schedule.id,

          label: `${schedule.scheduleName}`,

        })),

    [schedulesQuery.data],

  ); 

  const rowOptions = React.useMemo<ComboboxOption[]>(() => {
    const rows = schedulePreview.data?.mrRr?.rows ?? [];

    return rows
      .filter(
        (row) =>
          row.vpNo?.trim() &&
          canAcceptLoading(row.vpWagonLoading?.status),
      )
      .map((row: MRRRRowPreview, index) => ({
        value: row.id,
        label: `${row.vpNo ?? `VP row ${index + 1}`} - ${
          row.wagon?.name ?? row.wagonTypeLabel ?? "Wagon"
        }`,
      }));
  }, [schedulePreview.data]);

  const gateOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (gatesQuery.data ?? []).map((gate) => ({
        value: gate.gateNo,
        label: `${gate.gateNo} - ${gate.eligibleGrnCount} GRN, ${gate.totalAvailableQty} qty`,
      })),
    [gatesQuery.data],
  );

  const grnOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (grnsQuery.data ?? []).map((grn) => ({
        value: grn.grnId,
        label: `${grn.grnNumber}- ${grn.availableQty} qty`,
      })),
    [grnsQuery.data],
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

  const selectedRow = React.useMemo(
    () => schedulePreview.data?.mrRr?.rows?.find((row) => row.id === mrrrRowId),
    [mrrrRowId, schedulePreview.data],
  );
  const existingWagonLoading = selectedRow?.vpWagonLoading ?? null;
  const isExistingWagonLoading = Boolean(existingWagonLoading);
  const selectedGrn = React.useMemo(
    () => grnsQuery.data?.find((grn) => grn.grnId === grnId),
    [grnId, grnsQuery.data],
  );

  React.useEffect(() => {
    form.setValue("labourId", "");
    form.setValue("labourCharge", "");
    form.setValue("loadingSupervisorId", "");
  }, [form, mrrrRowId]);

  const totalLoadedQty = watchedGoods.reduce(
    (sum, row) => sum + numberValue(row?.loadedQty),
    0,
  );
  const totalDamageQty = watchedGoods.reduce(
    (sum, row) => sum + numberValue(row?.loadingDamageQty),
    0,
  );

  const validateGoods = (goods: VPLoadingFormValues["goods"]) => {
    if (!goods.length) {
      toast.error("Select GRN to load goods");
      return false;
    }

    for (const [index, row] of goods.entries()) {
      const loadedQty = numberValue(row.loadedQty);
      const damageQty = numberValue(row.loadingDamageQty);

      if (loadedQty > row.availableQty) {
        toast.error(`Row ${index + 1}: loaded quantity exceeds available quantity`);
        return false;
      }

      if (damageQty > loadedQty) {
        toast.error(`Row ${index + 1}: damage quantity cannot exceed loaded quantity`);
        return false;
      }
    }

    if (!goods.some((row) => numberValue(row.loadedQty) > 0)) {
      toast.error("At least one goods row must have loaded quantity");
      return false;
    }

    return true;
  };

  const onSubmit = async (values: VPLoadingFormValues) => {
    if (!canCreate) {
      toast.error("You do not have permission to create VP loading");
      return;
    }

    if (!values.mrrrRowId || !values.grnId || !values.gateNo) {
      toast.error("Select schedule, wagon row, gate and GRN first");
      return;
    }

    if (!validateGoods(values.goods)) return;

    const body: CreateVPLoadingAllocationBody = {
      grnId: values.grnId,
      labourId: isExistingWagonLoading ? undefined : values.labourId || undefined,
      labourCharge: isExistingWagonLoading
        ? undefined
        : optionalNumber(values.labourCharge),
      loadingSupervisorId: isExistingWagonLoading
        ? undefined
        : values.loadingSupervisorId || undefined,
      remarks: values.remarks?.trim() || undefined,
      wagonVersion: values.wagonVersion,
      goods: values.goods.map((row) => ({
        grnGoodsId: row.grnGoodsId,
        loadedQty: numberValue(row.loadedQty),
        loadingDamageQty: numberValue(row.loadingDamageQty),
      })),
    };

    const parsed = createVPLoadingAllocationSchema.safeParse(body);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check loading details");
      return;
    }

    try {
      const result = await createAllocation.mutateAsync({
        mrrrRowId: values.mrrrRowId,
        gateNo: values.gateNo,
        grnId: values.grnId,
        body: parsed.data,
      });

      toast.success(`VP loading ${result.allocation.loadingNumber} created`);
      router.push("/vp-management/vp-loading");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const isSaving = createAllocation.isPending;
  const canSubmit =
    canCreate &&
    Boolean(scheduleId && mrrrRowId && gateNo && grnId) &&
    fields.length > 0 &&
    !isSaving;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-24"
      >
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => router.push("/vp-management/vp-loading")}
            >
              <IconArrowLeft size={15} className="mr-1.5" />
              Back
            </Button>

            <span className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
              VP Loading
            </span>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                Create VP Loading
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a loading-ready schedule, pick the VP wagon, then add an LR/GRN with goods quantity.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <IconRoute size={15} className="text-muted-foreground" />
                  {schedulePreview.data
                    ? `${schedulePreview.data.fromBranch?.name ?? DASH} to ${
                        schedulePreview.data.toBranch?.name ?? DASH
                      }`
                    : "Select schedule"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <IconTrain size={15} className="text-muted-foreground" />
                  {selectedRow?.wagon?.name ?? selectedRow?.wagonTypeLabel ?? "Select VP wagon"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InfoTile
                label="Loaded"
                value={formatNumber(totalLoadedQty)}
                icon={<IconScale size={15} />}
              />
              <InfoTile
                label="Damage"
                value={formatNumber(totalDamageQty)}
                icon={<IconAlertTriangle size={15} />}
              />
            </div>
          </div>
        </div>

        {!canCreate ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <IconAlertTriangle size={17} className="mt-0.5 shrink-0" />
            You can view this loading workspace, but creating a new VP loading allocation needs create permission.
          </div>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <FormSection
              icon={<IconRoute size={16} />}
              title="Loading Selection"
              description="Choose the schedule, VP wagon, gate and LR/GRN."
              columns={2}
            >
              <div className="grid gap-1.5">
                <FieldLabel>VP Schedule Date</FieldLabel>
                <Input
                  type="date"
                  value={scheduleDate}
                  disabled={Boolean(scheduleIdFromRoute)}
                  onChange={(event) =>
                    form.setValue("scheduleDate", event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <FieldLabel>Schedule</FieldLabel>
                <Combobox
                  options={scheduleOptions}
                  value={scheduleId}
                  onChange={(value) => form.setValue("scheduleId", value)}
                  placeholder="Select loading-ready schedule"
                  emptyText="No loading-ready schedules found"
                  disabled={Boolean(scheduleIdFromRoute) || schedulesQuery.isLoading}
                />
              </div>

              <div className="grid gap-1.5">
                <FieldLabel>VP No</FieldLabel>
                <Combobox
                  options={rowOptions}
                  value={mrrrRowId}
                  onChange={(value) => form.setValue("mrrrRowId", value)}
                  placeholder="Select VP No"
                  emptyText="No VP rows found"
                  disabled={!scheduleId || schedulePreview.isLoading}
                />
              </div>

              <div className="grid gap-1.5">
                <FieldLabel>Gate No</FieldLabel>
                <Combobox
                  options={gateOptions}
                  value={gateNo}
                  onChange={(value) => form.setValue("gateNo", value)}
                  placeholder="Select GRN gate"
                  emptyText="No eligible gate found"
                  disabled={!mrrrRowId || gatesQuery.isLoading}
                />
              </div>

              <div className="md:col-span-2 grid gap-1.5">
                <FieldLabel>LR Number / GRN</FieldLabel>
                <Combobox
                  options={grnOptions}
                  value={grnId}
                  onChange={(value) => form.setValue("grnId", value)}
                  placeholder="Select LR / GRN"
                  emptyText="No eligible LR / GRN found for gate"
                  disabled={!gateNo || grnsQuery.isLoading}
                />
              </div>
            </FormSection>

            <FormSection icon={<IconPackage size={16} />} title="Goods Loading" columns={1}>
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Goods quantity</p>
                    <p className="text-xs text-muted-foreground">
                      Enter loaded and damage quantity for every GRN goods row.
                    </p>
                  </div>
                  <span className="rounded-md bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {fields.length} item{fields.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Goods</TableHead>
                        <TableHead className="w-26 text-right">Received</TableHead>
                        <TableHead className="w-26 text-right">Available</TableHead>
                        <TableHead className="w-30">Loaded Qty</TableHead>
                        <TableHead className="w-30">Damage Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPreview.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                            Loading GRN goods...
                          </TableCell>
                        </TableRow>
                      ) : fields.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center">
                            <div className="mx-auto max-w-sm">
                              <p className="text-sm font-medium text-foreground">
                                No goods selected
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Select a gate and LR/GRN to preview goods rows here.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        fields.map((field, index) => {
                          const row = watchedGoods[index];
                          const loadedQty = numberValue(row?.loadedQty);
                          const damageQty = numberValue(row?.loadingDamageQty);
                          const hasError =
                            loadedQty > field.availableQty || damageQty > loadedQty;

                          return (
                            <TableRow key={field.id}>
                              <TableCell className="min-w-50">
                                <div className="font-medium">{field.goodsName}</div>
                                <div className="text-xs text-muted-foreground">
                                  Already loaded: {formatNumber(field.alreadyAllocatedQty)} {field.quantityUnitLabel}
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(field.receivedQty)} {field.quantityUnitLabel}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatNumber(field.availableQty)} {field.quantityUnitLabel}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={field.availableQty}
                                  step={1}
                                  className="h-9"
                                  aria-invalid={hasError}
                                  {...form.register(`goods.${index}.loadedQty` as const)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={loadedQty}
                                  step={1}
                                  className="h-9"
                                  aria-invalid={hasError}
                                  {...form.register(`goods.${index}.loadingDamageQty` as const)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={<IconUsers size={16} />}
              title={isExistingWagonLoading ? "Wagon Labour" : "Labour & Notes"}
              columns={3}
            >
              {isExistingWagonLoading ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800">
                    <IconCircleCheck size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        Labour charge is already locked for this wagon.
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">
                        Add another LR/GRN only. Labour, labour charge, and supervisor stay from the first loading.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="md:col-span-2 xl:col-span-3">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-semibold">
                        First LR for this wagon
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add labour details once here. Later LRs for this wagon will reuse this same wagon-level labour charge.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <FieldLabel>Labour</FieldLabel>
                    <Combobox
                      options={labourOptions}
                      value={form.watch("labourId") ?? ""}
                      onChange={(value) => form.setValue("labourId", value)}
                      placeholder="Select labour"
                      emptyText="No labour found"
                      disabled={laboursQuery.isLoading}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <FieldLabel>Labour Charge</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      {...form.register("labourCharge")}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <FieldLabel>Loading Supervisor</FieldLabel>
                    <Combobox
                      options={supervisorOptions}
                      value={form.watch("loadingSupervisorId") ?? ""}
                      onChange={(value) => form.setValue("loadingSupervisorId", value)}
                      placeholder="Select supervisor"
                      emptyText="No supervisors found"
                      disabled={supervisorsQuery.isLoading}
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>Remarks</FieldLabel>
                <Textarea
                  rows={3}
                  placeholder="Any loading notes"
                  {...form.register("remarks")}
                />
              </div>
            </FormSection>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4">
            <SummaryPanel
              title="Read-only summary"
              description="Selected schedule, wagon and LR."
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                <SummaryStep label="Schedule" done={Boolean(scheduleId)} />
                <SummaryStep label="VP" done={Boolean(mrrrRowId)} />
                <SummaryStep label="Gate" done={Boolean(gateNo)} />
                <SummaryStep label="LR" done={Boolean(grnId)} />
                <SummaryStep
                  label="Goods"
                  done={fields.length > 0 && totalLoadedQty > 0}
                />
              </div>

              <dl>
                <SummaryRow
                  label="Schedule"
                  value={schedulePreview.data?.scheduleNumber ?? DASH}
                />
                <SummaryRow
                  label="Route"
                  value={
                    schedulePreview.data ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="truncate">
                          {schedulePreview.data.fromBranch?.name ?? DASH}
                        </span>
                        <IconArrowRight
                          size={13}
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">
                          {schedulePreview.data.toBranch?.name ?? DASH}
                        </span>
                      </span>
                    ) : (
                      DASH
                    )
                  }
                />
                <SummaryRow
                  label="Area"
                  value={
                    schedulePreview.data
                      ? `${schedulePreview.data.sourceArea?.name ?? DASH} to ${
                          schedulePreview.data.destinationArea?.name ?? DASH
                        }`
                      : DASH
                  }
                />
                <SummaryRow
                  label="MR/RR"
                  value={schedulePreview.data?.mrRr?.mrRrNumber ?? DASH}
                />
                <SummaryRow
                  label="VP/Wagon"
                  value={
                    selectedRow
                      ? `${selectedRow.vpNo ?? selectedRow.rowLabel ?? DASH} / ${
                          selectedRow.wagon?.name ??
                          selectedRow.wagonTypeLabel ??
                          DASH
                        }`
                      : DASH
                  }
                />
                <SummaryRow label="Gate" value={gateNo || DASH} />
                <SummaryRow
                  label="LR/GRN"
                  value={
                    selectedGrn
                      ? `${selectedGrn.grnNumber}`
                      : DASH
                  }
                />
                <SummaryRow
                  label="Consignor"
                  value={
                    loadingPreview.data?.grn?.lorryReceipt?.group?.consignor
                      ?.name ?? DASH
                  }
                />
                <SummaryRow
                  label="Consignee"
                  value={
                    loadingPreview.data?.grn?.lorryReceipt?.group?.consignee
                      ?.name ?? DASH
                  }
                />
              </dl>
            </SummaryPanel>

            <SummaryPanel title="Quantity">
              <dl>
                <SummaryRow
                  label="Loaded"
                  value={formatNumber(totalLoadedQty)}
                />
                <SummaryRow
                  label="Damage"
                  value={formatNumber(totalDamageQty)}
                />
                <SummaryRow
                  label="Wagon qty"
                  value={formatNumber(
                    loadingPreview.data?.currentTotals?.loadedQty ?? 0,
                  )}
                />
              </dl>
            </SummaryPanel>

            <SummaryPanel
              title="Wagon labour"
              description="Saved once per wagon."
            >
              <div>
                {isExistingWagonLoading ? (
                  <dl>
                    <SummaryRow
                      label="Labour"
                      value={existingWagonLoading?.labour?.name ?? DASH}
                    />
                    <SummaryRow
                      label="Charge"
                      value={formatPaise(existingWagonLoading?.labourCharge)}
                    />
                    <SummaryRow
                      label="Supervisor"
                      value={
                        existingWagonLoading?.loadingSupervisor
                          ? `${existingWagonLoading.loadingSupervisor.firstName ?? ""} ${
                              existingWagonLoading.loadingSupervisor.lastName ?? ""
                            }`.trim() ||
                            existingWagonLoading.loadingSupervisor.userName ||
                            DASH
                          : DASH
                      }
                    />
                  </dl>
                ) : (
                  <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Labour details entered on the left will become the wagon-level labour record after the first LR is added.
                  </div>
                )}
              </div>
            </SummaryPanel>
          </aside>
        </div>

        <div className="sticky bottom-0 z-20 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                  canSubmit
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <IconClipboardList size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {canSubmit ? "Ready to add loading" : "Complete loading details"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {totalLoadedQty > 0
                    ? `${formatNumber(totalLoadedQty)} quantity ready to load`
                    : "Select LR / GRN goods to continue"}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/vp-management/vp-loading")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit} className="min-w-40">
                {isSaving ? "Adding..." : "Add GRN to Wagon"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
