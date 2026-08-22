"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  UseFormReturn,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";

import { createVPScheduleSchema } from "@skerp/validators";
import type {
  CreateVPScheduleBody,
  CreateVPScheduleFormInput,
  UpdateVPScheduleBody,
  VPScheduleFreightPreview,
} from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { Input } from "@skerp/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  IconAlertTriangle,
  IconCalendarTime,
  IconChevronDown,
  IconCircleCheck,
  IconMapPin,
  IconPlus,
  IconTrain,
  IconTrash,
} from "@tabler/icons-react";

import FormSection from "@/features/masters/_shared/fields/FormSection";
import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import TextField from "@/features/masters/_shared/fields/TextField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  useCreateVPSchedule,
  useUpdateVPSchedule,
  useVPScheduleDetail,
} from "./hook/useVPSchedule";
import { vpScheduleKeys, vpScheduleLookupKeys } from "./vp-schedule.key";
import { vpScheduleLookups } from "./vp-schedule.lookup";
import { branchApi } from "../masters/branch/branch.service";
import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";
import RailwayFreightForm, {
  type RailwayFreightPreset,
} from "../masters/railwayfreightMatrix/railwayfreightForm";
import { vpScheduleApi } from "./vp-schedule.service";

type Props = {
  mode: "create" | "edit";
  scheduleId?: string;
};

type FlatError = { label: string; message: string };

const FIELD_LABELS: Record<string, string> = {
  scheduleDate: "Schedule date",
  scheduleName: "Schedule name",
  fromBranchId: "From branch",
  toBranchId: "To branch",
  sourceAreaId: "Source area",
  destinationAreaId: "Destination area",
  remarks: "Remarks",
  wagonCounts: "Wagon planning",
  wagonId: "Wagon",
  count: "Count",
};
const getRouteLocationLabel = (
  area: { name: string } | null | undefined,
  city: { name: string },
) => (area ? `${area.name}, ${city.name}` : `${city.name} (all areas)`);
const emptyWagonRow = { wagonId: "", count: 1 };

const FREIGHT_MATCH_LABELS = {
  EXACT_AREAS: "Exact area rate",
  SOURCE_AREA: "Source-area fallback",
  DESTINATION_AREA: "Destination-area fallback",
  CITY_ROUTE: "City-route fallback",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const humanLabel = (path: string[]) => {
  const parts: string[] = [];

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    if (!segment || /^\d+$/.test(segment)) continue;

    const next = path[index + 1];
    if (next && /^\d+$/.test(next)) {
      parts.push(`Wagon row ${Number(next) + 1}`);
      continue;
    }

    parts.push(FIELD_LABELS[segment] ?? segment);
  }

  return parts.join(" - ");
};

const collectErrors = (node: unknown, path: string[] = []): FlatError[] => {
  if (!isRecord(node)) return [];

  const message = node.message;
  if (typeof message === "string" && message.length > 0) {
    return [{ label: humanLabel(path), message }];
  }

  const issues: FlatError[] = [];
  for (const key of Object.keys(node)) {
    if (key === "ref" || key === "type" || key === "message") continue;
    issues.push(...collectErrors(node[key], [...path, key]));
  }

  return issues;
};

const selectedDate = (value: unknown) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export function VPScheduleForm({ mode, scheduleId }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const canCreateRailwayFreight = useCan(PERMS.MASTERS.RAILWAY_FREIGHT.CREATE);
  const [freightPreset, setFreightPreset] =
    React.useState<RailwayFreightPreset | null>(null);
  const [freightSaveError, setFreightSaveError] = React.useState("");

  const createMutation = useCreateVPSchedule();
  const updateMutation = useUpdateVPSchedule();
  const detailQuery = useVPScheduleDetail(scheduleId ?? "");

  const branches = useQuery({
    queryKey: vpScheduleLookupKeys.branches,
    queryFn: vpScheduleLookups.branches,
  });

  const isResettingEditFormRef = React.useRef(false);
  const previousFromBranchIdRef = React.useRef("");
  const previousToBranchIdRef = React.useRef("");

  const form: UseFormReturn<
    CreateVPScheduleFormInput,
    unknown,
    CreateVPScheduleBody
  > = useForm<CreateVPScheduleFormInput, unknown, CreateVPScheduleBody>({
    resolver: zodResolver(createVPScheduleSchema),
    mode: "onTouched",
    defaultValues: {
      scheduleDate: "",
      scheduleName: "",
      fromBranchId: "",
      toBranchId: "",
      sourceAreaId: "",
      destinationAreaId: "",
      remarks: "",
      wagonCounts: [emptyWagonRow],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "wagonCounts",
  });

  React.useEffect(() => {
    const schedule = detailQuery.data;
    if (!isEdit || !schedule) return;

    isResettingEditFormRef.current = true;

    previousFromBranchIdRef.current = schedule.fromBranchId ?? "";
    previousToBranchIdRef.current = schedule.toBranchId ?? "";

    form.reset({
      scheduleDate: schedule.scheduleDate ?? "",
      scheduleName: schedule.scheduleName ?? "",
      fromBranchId: schedule.fromBranchId ?? "",
      toBranchId: schedule.toBranchId ?? "",
      sourceAreaId: schedule.sourceAreaId ?? "",
      destinationAreaId: schedule.destinationAreaId ?? "",
      remarks: schedule.remarks ?? "",
      wagonCounts: schedule.wagonCounts?.length
        ? schedule.wagonCounts.map((wagonCount) => ({
            id: wagonCount.id,
            wagonId: wagonCount.wagonId,
            count: wagonCount.count,
          }))
        : [emptyWagonRow],
    });

    queueMicrotask(() => {
      isResettingEditFormRef.current = false;
    });
  }, [detailQuery.data, form, isEdit]);

  const watchedScheduleDate = form.watch("scheduleDate");
  const watchedSourceAreaId = form.watch("sourceAreaId");
  const watchedDestinationAreaId = form.watch("destinationAreaId");
  const watchedFromBranchId = form.watch("fromBranchId");
  const watchedToBranchId = form.watch("toBranchId");

  const sourceAreas = useQuery({
    queryKey: ["vp-schedule-source-railheads", watchedFromBranchId],
    queryFn: () => branchApi.railheads(watchedFromBranchId),
    enabled: Boolean(watchedFromBranchId),
  });

  const destinationAreas = useQuery({
    queryKey: ["vp-schedule-destination-railheads", watchedToBranchId],
    queryFn: () => branchApi.railheads(watchedToBranchId),
    enabled: Boolean(watchedToBranchId),
  });
  const sourceAreaOptions = React.useMemo(
    () =>
      sourceAreas.data?.map((mapping) => ({
        label: `${mapping.area.name} (${mapping.area.city.name})`,
        value: mapping.area.id,
      })) ?? [],
    [sourceAreas.data],
  );

  const destinationAreaOptions = React.useMemo(
    () =>
      destinationAreas.data?.map((mapping) => ({
        label: `${mapping.area.name} (${mapping.area.city.name})`,
        value: mapping.area.id,
      })) ?? [],
    [destinationAreas.data],
  );

  const wagons = useQuery({
    queryKey: vpScheduleLookupKeys.wagons,
    queryFn: vpScheduleLookups.wagons,
  });

  React.useEffect(() => {
    if (isResettingEditFormRef.current) {
      previousFromBranchIdRef.current = watchedFromBranchId;
      return;
    }

    if (!previousFromBranchIdRef.current) {
      previousFromBranchIdRef.current = watchedFromBranchId;
      return;
    }

    if (previousFromBranchIdRef.current !== watchedFromBranchId) {
      form.setValue("sourceAreaId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    previousFromBranchIdRef.current = watchedFromBranchId;
  }, [watchedFromBranchId, form]);

  React.useEffect(() => {
    if (isResettingEditFormRef.current) {
      previousToBranchIdRef.current = watchedToBranchId;
      return;
    }

    if (!previousToBranchIdRef.current) {
      previousToBranchIdRef.current = watchedToBranchId;
      return;
    }

    if (previousToBranchIdRef.current !== watchedToBranchId) {
      form.setValue("destinationAreaId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    previousToBranchIdRef.current = watchedToBranchId;
  }, [watchedToBranchId, form]);

  const formatScheduleDate = (value?: string) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAreaName = (area?: string) => {
    const areaName = area?.split(",")[0] ?? "";

    return areaName
      .replace(/[^a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  };
  const selectedSourceAreaLabel = React.useMemo(() => {
    return (
      sourceAreaOptions.find((area) => area.value === watchedSourceAreaId)
        ?.label ?? ""
    );
  }, [sourceAreaOptions, watchedSourceAreaId]);

  const selectedDestinationAreaLabel = React.useMemo(() => {
    return (
      destinationAreaOptions.find(
        (area) => area.value === watchedDestinationAreaId,
      )?.label ?? ""
    );
  }, [destinationAreaOptions, watchedDestinationAreaId]);
  React.useEffect(() => {
    if (isEdit) return;

    const formattedDate = formatScheduleDate(watchedScheduleDate);

    if (
      !watchedSourceAreaId ||
      !watchedDestinationAreaId ||
      !selectedSourceAreaLabel ||
      !selectedDestinationAreaLabel ||
      !formattedDate
    ) {
      return;
    }
    const sourceCode = formatAreaName(selectedSourceAreaLabel);
    const destinationCode = formatAreaName(selectedDestinationAreaLabel);

    if (!sourceCode || !destinationCode) {
      return;
    }

    const scheduleName = `${sourceCode}-${destinationCode} / ${formattedDate}`;

    if (form.getValues("scheduleName") === scheduleName) {
      return;
    }

    form.setValue("scheduleName", scheduleName, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [
    isEdit,
    form,
    watchedScheduleDate,
    watchedSourceAreaId,
    watchedDestinationAreaId,
    selectedSourceAreaLabel,
    selectedDestinationAreaLabel,
  ]);
  const watchedWagons =
    useWatch({
      control: form.control,
      name: "wagonCounts",
    }) ?? [];
  const wagonOptions = React.useMemo(() => wagons.data ?? [], [wagons.data]);
  const previewWagonCounts = watchedWagons
    .filter((row) => Boolean(row?.wagonId) && Number(row?.count) > 0)
    .map((row) => ({
      wagonId: row.wagonId,
      count: Number(row.count),
    }));
  const previewSignature = previewWagonCounts
    .map((row) => `${row.wagonId}:${row.count}`)
    .join("|");
  // Debounce the query key so typing a wagon count doesn't fire a new
  // freight-preview request (and its server-side freight-matrix lookup) on
  // every keystroke — only once typing has paused.
  const debouncedPreviewSignature = useDebouncedValue(previewSignature, 500);
  const freightPreviewEnabled = Boolean(
    watchedSourceAreaId &&
    watchedDestinationAreaId &&
    previewWagonCounts.length > 0,
  );
  const freightPreview = useQuery({
    queryKey: vpScheduleKeys.freightPreview(
      watchedSourceAreaId,
      watchedDestinationAreaId,
      debouncedPreviewSignature,
    ),
    queryFn: () =>
      vpScheduleApi.freightPreview({
        sourceAreaId: watchedSourceAreaId,
        destinationAreaId: watchedDestinationAreaId,
        wagonCounts: previewWagonCounts,
      }),
    enabled: freightPreviewEnabled,
    retry: false,
  });
  const missingFreight =
    freightPreview.data?.wagons.filter((wagon) => wagon.status === "MISSING") ??
    [];

  React.useEffect(() => {
    setFreightSaveError("");
  }, [watchedSourceAreaId, watchedDestinationAreaId, previewSignature]);

  const openFreightDialog = (
    wagon: VPScheduleFreightPreview["wagons"][number],
  ) => {
    const preview = freightPreview.data;
    if (!preview) return;

    setFreightPreset({
      wagonId: wagon.wagonId,
      wagonName: wagon.wagonName,
      sourceCityId: preview.sourceArea.city.id,
      sourceCityName: preview.sourceArea.city.name,
      sourceAreaId: preview.sourceArea.id,
      sourceAreaName: preview.sourceArea.name,
      destinationCityId: preview.destinationArea.city.id,
      destinationCityName: preview.destinationArea.city.name,
      destinationAreaId: preview.destinationArea.id,
      destinationAreaName: preview.destinationArea.name,
    });
  };

  const handleUseAlternativeWagon = (
    missingWagonId: string,
    alternativeWagonId: string,
  ) => {
    const rowIndex = watchedWagons.findIndex(
      (row) => row.wagonId === missingWagonId,
    );
    if (rowIndex < 0) return;

    form.setValue(`wagonCounts.${rowIndex}.wagonId`, alternativeWagonId, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const totalWagons = watchedWagons.reduce(
    (sum, row) => sum + (Number(row?.count) || 0),
    0,
  );

  const { errors, submitCount } = form.formState;
  const validationIssues = React.useMemo(() => collectErrors(errors), [errors]);
  const showValidationSummary = submitCount > 0 && validationIssues.length > 0;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateVPScheduleBody) => {
    try {
      if (isEdit && scheduleId) {
        await updateMutation.mutateAsync({
          id: scheduleId,
          body: values as UpdateVPScheduleBody,
        });

        toast.success("VP schedule updated");

        router.push(
          `/vp-management/vp-schedule/${encodeURIComponent(
            detailQuery.data?.scheduleNumber ?? scheduleId,
          )}`,
        );

        return;
      }

      const created = await createMutation.mutateAsync(values);

      toast.success("VP schedule created");

      router.push(
        `/vp-management/vp-schedule/${encodeURIComponent(created.scheduleNumber)}`,
      );
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.toLowerCase().includes("railway freight")) {
        setFreightSaveError(message);
      }
      toast.error(message);
    }
  };

  const handleCancel = () => {
    router.push("/vp-management/vp-schedule");
  };

  const freightBlocksSave =
    freightPreviewEnabled &&
    (freightPreview.isLoading ||
      freightPreview.isFetching ||
      freightPreview.isError ||
      missingFreight.length > 0);

  if (isEdit && detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-sm text-muted-foreground">Loading VP schedule...</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="relative mx-auto w-full max-w-4xl space-y-5 pb-20"
        >
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {isEdit ? "Edit VP Schedule" : "Create VP Schedule"}
            </h1>

            <p className="mt-1 text-xs text-muted-foreground">
              {isEdit
                ? "Update route, schedule date, and wagon planning details."
                : "Plan a railway VP schedule with branch route, areas, and wagon capacity."}
            </p>
          </div>

          <div className="grid gap-4">
            <FormSection
              icon={<IconCalendarTime size={16} />}
              title="Schedule Details"
              columns={2}
            >
              <Controller
                control={form.control}
                name="scheduleDate"
                render={({ field, fieldState }) => (
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Schedule date <span className="text-red-600">*</span>
                    </label>

                    <DatePicker
                      selected={selectedDate(field.value)}
                      onSelect={(date) =>
                        field.onChange(date ? date.toISOString() : "")
                      }
                      placeholder="Select schedule date"
                    />

                    {fieldState.error?.message ? (
                      <p className="text-xs text-red-600">
                        {fieldState.error.message}
                      </p>
                    ) : null}
                  </div>
                )}
              />

              <TextField<CreateVPScheduleFormInput>
                name="scheduleName"
                label="Schedule name"
                placeholder="Auto-generated from route and schedule date"
                required
                disabled
              />
            </FormSection>

            <FormSection
              icon={<IconMapPin size={16} />}
              title="Route Details"
              columns={2}
            >
              <ComboboxField<CreateVPScheduleFormInput>
                name="fromBranchId"
                label="From branch"
                options={branches.data ?? []}
                emptyText="No branches found"
                required
              />

              <ComboboxField<CreateVPScheduleFormInput>
                name="toBranchId"
                label="To branch"
                options={branches.data ?? []}
                emptyText="No branches found"
                required
              />

              <ComboboxField<CreateVPScheduleFormInput>
                name="sourceAreaId"
                label="Source railhead"
                options={sourceAreaOptions}
                emptyText="No source areas found"
                disabled={!watchedFromBranchId}
                required
              />

              <ComboboxField<CreateVPScheduleFormInput>
                name="destinationAreaId"
                label="Destination railhead"
                options={destinationAreaOptions}
                emptyText="No destination areas found"
                disabled={!watchedToBranchId}
                required
              />
            </FormSection>

            <FormSection
              icon={<IconTrain size={16} />}
              title="Wagon Planning"
              columns={1}
            >
              <div className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wagon</TableHead>
                      <TableHead className="w-32">Count</TableHead>
                      <TableHead className="w-52">Railway freight</TableHead>

                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {fields.map((row, index) => {
                      const wagonError = form.getFieldState(
                        `wagonCounts.${index}.wagonId`,
                      ).error?.message;
                      const countError = form.getFieldState(
                        `wagonCounts.${index}.count`,
                      ).error?.message;
                      const selectedWagonId = watchedWagons[index]?.wagonId;
                      const freightRow = freightPreview.data?.wagons.find(
                        (wagon) => wagon.wagonId === selectedWagonId,
                      );

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="min-w-64 align-top">
                            <Controller
                              control={form.control}
                              name={`wagonCounts.${index}.wagonId`}
                              render={({ field }) => (
                                <Combobox
                                  options={wagonOptions}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Select wagon"
                                  emptyText="No wagons found"
                                  disabled={wagons.isLoading}
                                  invalid={Boolean(wagonError)}
                                />
                              )}
                            />
                            {wagonError ? (
                              <p className="mt-1 text-xs text-red-600">
                                {wagonError}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              aria-invalid={Boolean(countError)}
                              {...form.register(`wagonCounts.${index}.count`, {
                                valueAsNumber: true,
                              })}
                            />
                            {countError ? (
                              <p className="mt-1 text-xs text-red-600">
                                {countError}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-top">
                            {!selectedWagonId || !freightPreviewEnabled ? (
                              <span className="text-xs text-muted-foreground">
                                Select route and wagon
                              </span>
                            ) : freightPreview.isLoading ||
                              freightPreview.isFetching ? (
                              <span className="text-xs text-muted-foreground">
                                Checking freight...
                              </span>
                            ) : freightRow?.status === "AVAILABLE" ? (
                              <div className="space-y-0.5">
                                <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                                  <IconCircleCheck
                                    size={14}
                                    className="text-primary"
                                  />
                                  {formatPaise(freightRow.freightAmount)} /
                                  wagon
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {freightRow.matchType
                                    ? FREIGHT_MATCH_LABELS[freightRow.matchType]
                                    : "Available"}
                                </p>
                              </div>
                            ) : freightRow?.status === "MISSING" ? (
                              <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                                <IconAlertTriangle size={14} /> Missing
                              </p>
                            ) : freightPreview.isError ? (
                              <span className="text-xs text-destructive">
                                Could not check freight
                              </span>
                            ) : null}
                          </TableCell>

                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              disabled={fields.length === 1}
                              onClick={() => remove(index)}
                              aria-label="Remove wagon"
                            >
                              <IconTrash size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {typeof errors.wagonCounts?.message === "string" ? (
                  <p className="text-xs text-red-600">
                    {errors.wagonCounts.message}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Total wagons:{" "}
                      <span className="font-semibold text-foreground">
                        {totalWagons}
                      </span>
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => append(emptyWagonRow)}
                  >
                    <IconPlus size={14} />
                    Add wagon
                  </Button>
                </div>

                {freightPreviewEnabled ? (
                  <div className="overflow-hidden rounded-lg border bg-background">
                    {freightPreview.isLoading || freightPreview.isFetching ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                        Checking Railway Freight...
                      </div>
                    ) : freightPreview.isError ? (
                      <div className="bg-destructive/5 px-3 py-3">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                          <IconAlertTriangle size={15} />
                          Railway Freight could not be checked
                        </p>

                        <p className="mt-1 text-xs text-destructive/90">
                          {getErrorMessage(freightPreview.error)}
                        </p>
                      </div>
                    ) : missingFreight.length > 0 ? (
                      <div>
                        {/* One common header */}
                        <div className="border-b bg-destructive/5 px-3 py-2.5">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                            <IconAlertTriangle size={15} />
                            Freight setup required
                          </p>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {freightPreview.data?.sourceArea.name}
                            <span className="mx-1.5">→</span>
                            {freightPreview.data?.destinationArea.name}
                            <span className="mx-1.5">•</span>
                            {missingFreight.length} wagon
                            {missingFreight.length === 1 ? "" : "s"} missing
                          </p>
                        </div>

                        <div className="space-y-2 p-3">
                          {missingFreight.map((wagon) => {
                            const selectedElsewhere = new Set(
                              watchedWagons
                                .filter((row) => row.wagonId !== wagon.wagonId)
                                .map((row) => row.wagonId),
                            );

                            const alternatives = wagon.alternativeWagons.filter(
                              (alternative) =>
                                !selectedElsewhere.has(alternative.wagonId),
                            );

                            return (
                              <div
                                key={wagon.wagonId}
                                className="overflow-hidden rounded-md border"
                              >
                                {/* Missing wagon header */}
                                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground">
                                      {wagon.wagonName}
                                    </p>

                                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                      Missing
                                    </span>
                                  </div>

                                  {canCreateRailwayFreight ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2.5 text-xs"
                                      onClick={() => openFreightDialog(wagon)}
                                    >
                                      Add freight
                                    </Button>
                                  ) : null}
                                </div>

                                <div className="grid gap-3 border-t bg-muted/10 p-3 md:grid-cols-2">
                                  {/* Alternative wagons */}
                                  <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-foreground">
                                      Available replacement wagons
                                    </p>

                                    {alternatives.length > 0 ? (
                                      <ul className="space-y-1">
                                        {alternatives.map((alternative) => (
                                          <li
                                            key={alternative.wagonId}
                                            className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5"
                                          >
                                            <div className="min-w-0">
                                              <p className="truncate text-xs font-medium text-foreground">
                                                {alternative.wagonName}
                                                <span className="ml-1.5 font-normal text-muted-foreground">
                                                  {formatPaise(
                                                    alternative.freightAmount,
                                                  )}{" "}
                                                  / wagon
                                                </span>
                                              </p>

                                              <p className="text-[11px] text-muted-foreground">
                                                {
                                                  FREIGHT_MATCH_LABELS[
                                                    alternative.matchType
                                                  ]
                                                }
                                              </p>
                                            </div>

                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-7 shrink-0 px-2 text-xs"
                                              onClick={() =>
                                                handleUseAlternativeWagon(
                                                  wagon.wagonId,
                                                  alternative.wagonId,
                                                )
                                              }
                                            >
                                              Use
                                            </Button>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        No other available wagon for this route.
                                      </p>
                                    )}
                                  </div>

                                  {/* Other routes */}
                                  <div>
                                    {wagon.configuredRoutes.length > 0 ? (
                                      <details className="group overflow-hidden rounded-md bg-background">
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
                                          <p className="text-xs font-medium text-foreground">
                                            Configured on other routes
                                            <span className="ml-1 text-muted-foreground">
                                              ({wagon.configuredRoutes.length})
                                            </span>
                                          </p>

                                          <IconChevronDown
                                            size={14}
                                            className="text-muted-foreground transition-transform group-open:rotate-180"
                                          />
                                        </summary>

                                        <ul className="max-h-40 divide-y overflow-y-auto border-t">
                                          {wagon.configuredRoutes.map(
                                            (route) => {
                                              const sourceLabel =
                                                getRouteLocationLabel(
                                                  route.sourceArea,
                                                  route.sourceCity,
                                                );

                                              const destinationLabel =
                                                getRouteLocationLabel(
                                                  route.destinationArea,
                                                  route.destinationCity,
                                                );

                                              return (
                                                <li
                                                  key={route.freightMatrixId}
                                                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2"
                                                >
                                                  <p
                                                    className="truncate text-xs text-foreground"
                                                    title={`${sourceLabel} → ${destinationLabel}`}
                                                  >
                                                    {sourceLabel}
                                                    <span className="mx-1 text-muted-foreground">
                                                      →
                                                    </span>
                                                    {destinationLabel}
                                                  </p>

                                                  <p className="whitespace-nowrap text-xs font-semibold text-foreground">
                                                    {formatPaise(
                                                      route.freightAmount,
                                                    )}
                                                  </p>
                                                </li>
                                              );
                                            },
                                          )}
                                        </ul>
                                      </details>
                                    ) : (
                                      <div className="rounded-md bg-background px-2.5 py-2">
                                        <p className="text-xs font-medium text-foreground">
                                          Configured on other routes
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                          No other routes found.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {!canCreateRailwayFreight ? (
                            <p className="text-xs text-destructive">
                              You do not have permission to add Railway Freight.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : freightPreview.data ? (
                      /* Compact success state */
                      <div className="px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <IconCircleCheck
                              size={16}
                              className="text-primary"
                            />
                            Railway Freight ready
                          </p>

                          <p className="text-sm font-semibold text-foreground">
                            Total:{" "}
                            {formatPaise(
                              freightPreview.data.wagons.reduce(
                                (total, wagon) =>
                                  total + Number(wagon.totalFreight ?? 0),
                                0,
                              ),
                            )}
                          </p>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {freightPreview.data.wagons.map((wagon) => (
                            <span
                              key={wagon.wagonId}
                              className="rounded-md bg-primary/5 px-2 py-1 text-xs text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">
                                {wagon.wagonName}
                              </span>
                              : {wagon.count} ×{" "}
                              {formatPaise(wagon.freightAmount)} ={" "}
                              {formatPaise(wagon.totalFreight)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {freightSaveError && missingFreight.length === 0 ? (
                      <p className="border-t px-3 py-2 text-xs text-destructive">
                        {freightSaveError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </FormSection>

            <FormSection
              icon={<IconTrain size={16} />}
              title="Remarks"
              columns={1}
            >
              <TextAreaField<CreateVPScheduleFormInput>
                name="remarks"
                label="Remarks"
                placeholder="Any railway schedule notes"
                rows={4}
                maxLength={250}
              />
            </FormSection>
          </div>

          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="sticky bottom-0 z-20 border-t border-border/70 bg-background/80 py-3 backdrop-blur-md"
          >
            {showValidationSummary ? (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <IconAlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0 text-destructive"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      Please fix {validationIssues.length}{" "}
                      {validationIssues.length === 1 ? "issue" : "issues"}{" "}
                      before saving
                    </p>
                    <ul className="space-y-0.5">
                      {validationIssues.map((issue, index) => (
                        <li
                          key={`${issue.label}-${index}`}
                          className="text-xs text-destructive/90"
                        >
                          <span className="font-medium">{issue.label}:</span>{" "}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {totalWagons > 0
                  ? `${totalWagons} wagon${totalWagons === 1 ? "" : "s"} planned`
                  : "Add wagon planning to continue"}
              </p>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || freightBlocksSave}
                  className="min-w-32"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEdit
                      ? "Save Changes"
                      : "Save Schedule"}
                </Button>
              </div>
            </div>
          </motion.div>
        </form>

        <RailwayFreightForm
          open={Boolean(freightPreset)}
          onOpenChange={(open) => {
            if (!open) setFreightPreset(null);
          }}
          preset={freightPreset}
          onSaved={async () => {
            await freightPreview.refetch();
          }}
        />
      </>
    </FormProvider>
  );
}
