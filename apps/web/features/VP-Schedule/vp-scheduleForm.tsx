"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  UseFormReturn,
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
} from "@skerp/types";
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

import {
  useCreateVPSchedule,
  useUpdateVPSchedule,
  useVPScheduleDetail,
} from "./hook/useVPSchedule";
import { vpScheduleLookupKeys } from "./vp-schedule.key";
import { vpScheduleLookups } from "./vp-schedule.lookup";
import { areaApi } from "../masters/area/area.service";

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

const emptyWagonRow = { wagonId: "", count: 1 };

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

  const selectedFromBranch = branches.data?.find(
    (branch) => branch.value === watchedFromBranchId,
  );

  const selectedToBranch = branches.data?.find(
    (branch) => branch.value === watchedToBranchId,
  );

  const sourceCityId = selectedFromBranch?.cityId;
  const destinationCityId = selectedToBranch?.cityId;
  const sourceAreas = useQuery({
    queryKey: ["vp-schedule-source-areas", sourceCityId],
    queryFn: () =>
      areaApi.list({
        page: 0,
        size: 1000,
        cityId: sourceCityId,
      } as any),
    enabled: Boolean(sourceCityId),
  });

  const destinationAreas = useQuery({
    queryKey: ["vp-schedule-destination-areas", destinationCityId],
    queryFn: () =>
      areaApi.list({
        page: 0,
        size: 1000,
        cityId: destinationCityId,
      } as any),
    enabled: Boolean(destinationCityId),
  });
  const sourceAreaOptions = React.useMemo(
    () =>
      sourceAreas.data?.data.map((area) => ({
        label: area.name,
        value: area.id,
      })) ?? [],
    [sourceAreas.data],
  );

  const destinationAreaOptions = React.useMemo(
    () =>
      destinationAreas.data?.data.map((area) => ({
        label: area.name,
        value: area.id,
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
  const watchedWagons = form.watch("wagonCounts") ?? [];
  const wagonOptions = React.useMemo(() => wagons.data ?? [], [wagons.data]);
  const wagonMap = React.useMemo(
    () => new Map(wagonOptions.map((wagon) => [wagon.value, wagon])),
    [wagonOptions],
  );

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
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = () => {
    router.push("/vp-management/vp-schedule");
  };

  if (isEdit && detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-sm text-muted-foreground">Loading VP schedule...</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
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
              label="Source area"
              options={sourceAreaOptions}
              emptyText="No source areas found"
              disabled={!sourceCityId}
              required
            />

            <ComboboxField<CreateVPScheduleFormInput>
              name="destinationAreaId"
              label="Destination area"
              options={destinationAreaOptions}
              emptyText="No destination areas found"
              disabled={!destinationCityId}
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

                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {fields.map((row, index) => {
                    const wagonId = watchedWagons[index]?.wagonId ?? "";
                    const wagon = wagonMap.get(wagonId);
                    const wagonError = form.getFieldState(
                      `wagonCounts.${index}.wagonId`,
                    ).error?.message;
                    const countError = form.getFieldState(
                      `wagonCounts.${index}.count`,
                    ).error?.message;

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
                    {validationIssues.length === 1 ? "issue" : "issues"} before
                    saving
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
                disabled={isSubmitting}
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
    </FormProvider>
  );
}
