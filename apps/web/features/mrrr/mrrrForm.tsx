"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  type Resolver,
  type SubmitHandler,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconClipboardList,
  IconFileInvoice,
  IconNotes,
  IconTrain,
} from "@tabler/icons-react";

import type {
  CreateMRRRBody,
  MRRRFormValues,
  UpdateMRRRRowsBody,
  UpdateMRRRBody,
} from "@skerp/types";
import { createMRRRSchema, updateMRRRSchema } from "@skerp/validators";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import FormSection from "@/features/masters/_shared/fields/FormSection";
import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import {
  useCreateMRRR,
  useMRRRDetail,
  useMRRRPreview,
  useMRRRVPSchedules,
  useUpdateMRRR,
  useUpdateMRRRRows,
} from "./hook/useMrrr";

import { formatFreight } from "./mrrr-ui";
import { DatePicker } from "@skerp/ui/components/datepicker";

type Props = {
  mode: "create" | "edit";
  mrrrId?: string;
};

type MRRRFormRow = {
  id?: string;
  vpScheduleWagonCountId?: string;
  wagonId?: string;
  wagonTypeLabel?: string;
  rowNumber?: number;
  rowLabel?: string;
  sequenceNo?: string;
  vpNo?: string;
  mrRrNo?: string;
  sealNo?: string;
};

type MRRRFormInput = MRRRFormValues & {
  mrRrNumber?: string | null;
  scheduleDate?: string;
  rows: MRRRFormRow[];
};

type FlatError = {
  label: string;
  message: string;
};

const FIELD_LABELS: Record<string, string> = {
  vpScheduleId: "VP Schedule",
  rakeType: "Rake Type",
  mrRrNumber: "MR/RR number",
  remarks: "Remarks",
  rows: "MR/RR rows",
  wagonId: "Wagon",
  vpScheduleWagonCountId: "Wagon row",
  rowLabel: "MR/RR row",
  sequenceNo: "Sequence No",
  vpNo: "VP No",
  mrRrNo: "MR/RR No",
  sealNo: "Seal No",
};

const RAKE_TYPE_OPTIONS = [
  { label: "Indent", value: "INDENT" },
  { label: "Lease", value: "LEASE" },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const humanLabel = (path: string[]) => {
  const parts: string[] = [];

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];

    if (!segment || /^\d+$/.test(segment)) continue;

    const next = path[index + 1];

    if (next && /^\d+$/.test(next)) {
      parts.push(`MR/RR row ${Number(next) + 1}`);
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
    return [
      {
        label: humanLabel(path),
        message,
      },
    ];
  }

  const issues: FlatError[] = [];

  for (const key of Object.keys(node)) {
    if (key === "ref" || key === "type" || key === "message") continue;
    issues.push(...collectErrors(node[key], [...path, key]));
  }

  return issues;
};
const selectedDate = (value?: string | null) => {
  if (!value) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return undefined;

  return date;
};
export function MRRRForm({ mode, mrrrId }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const createMutation = useCreateMRRR();
  const updateMutation = useUpdateMRRR();
  const updateRowsMutation = useUpdateMRRRRows();

  const detailQuery = useMRRRDetail(mrrrId ?? "");

  const form = useForm<MRRRFormInput>({
    resolver: zodResolver(
      isEdit ? updateMRRRSchema : createMRRRSchema,
    ) as unknown as Resolver<MRRRFormInput>,
    mode: "onTouched",
    defaultValues: {
      scheduleDate: "",
      vpScheduleId: "",
      rakeType: undefined,
      mrRrNumber: "",
      remarks: "",
      rows: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  const watchedVPScheduleId = form.watch("vpScheduleId");
  const watchedRows = form.watch("rows") ?? [];
  const watchedMrRrNumber = form.watch("mrRrNumber");
  const watchedScheduleDate = form.watch("scheduleDate");
  const vpSchedules = useMRRRVPSchedules({
    page: 0,
    size: 20,
    scheduleDate: watchedScheduleDate || undefined,
  });

  const previewQuery = useMRRRPreview(
    watchedVPScheduleId,
    !isEdit && Boolean(watchedVPScheduleId),
  );

  React.useEffect(() => {
    const mrrr = detailQuery.data;

    if (!isEdit || !mrrr) return;

    form.reset({
      scheduleDate: mrrr.vpSchedule?.scheduleDate
        ? new Date(mrrr.vpSchedule.scheduleDate).toISOString()
        : "",
      vpScheduleId: mrrr.vpScheduleId ?? "",
      rakeType:
        mrrr.rakeType === "INDENT" || mrrr.rakeType === "LEASE"
          ? mrrr.rakeType
          : undefined,
      mrRrNumber: mrrr.mrRrNumber ?? "",
      remarks: mrrr.remarks ?? "",
      rows:
        mrrr.rows?.map((row) => ({
          id: row.id,
          vpScheduleWagonCountId: row.vpScheduleWagonCountId,
          wagonId: row.wagonId,
          wagonTypeLabel: row.wagonTypeLabel,
          rowNumber: row.rowNumber,
          rowLabel: row.rowLabel,
          sequenceNo: row.sequenceNo ?? "",
          vpNo: row.vpNo ?? "",
          mrRrNo: row.mrRrNo ?? "",
          sealNo: row.sealNo ?? "",
        })) ?? [],
    });
    if (mrrr.rakeType === "INDENT" || mrrr.rakeType === "LEASE") {
      form.setValue("rakeType", mrrr.rakeType, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false,
      });
    }

    form.clearErrors("rakeType");
  }, [detailQuery.data, form, isEdit]);

  React.useEffect(() => {
    if (isEdit) return;

    const preview = previewQuery.data;

    if (!watchedVPScheduleId || !preview) return;

    replace(
      preview.rows.map((row) => ({
        vpScheduleWagonCountId: row.vpScheduleWagonCountId,
        wagonId: row.wagonId,
        wagonTypeLabel: row.wagonTypeLabel,
        rowNumber: row.rowNumber,
        rowLabel: row.rowLabel,
        sequenceNo: "",
        vpNo: "",
        mrRrNo: "",
        sealNo: "",
      })),
    );
  }, [isEdit, previewQuery.data, replace, watchedVPScheduleId]);

  const totalRows = watchedRows.length;

  const mrrrDetail = detailQuery.data;
  const preview = previewQuery.data;

  const previewSchedule = isEdit ? mrrrDetail?.vpSchedule : preview?.vpSchedule;

  const previewWagonCounts = previewSchedule?.wagonCounts ?? [];
  const previewTotalFreight = previewWagonCounts.reduce(
    (sum: number, wagon) => sum + Number(wagon.totalFreight ?? 0),
    0,
  );
  const { errors, submitCount } = form.formState;
  const validationIssues = React.useMemo(() => collectErrors(errors), [errors]);
  const showValidationSummary = submitCount > 0 && validationIssues.length > 0;
  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    updateRowsMutation.isPending;
  const vpScheduleOptions =
    vpSchedules.data?.data?.map((schedule) => ({
      label: schedule.scheduleName ?? schedule.scheduleNumber ?? schedule.id,
      value: schedule.id,
    })) ?? [];

  const buildRowsBody = (rows: MRRRFormRow[]): UpdateMRRRRowsBody => ({
    rows: rows
      .filter((row): row is MRRRFormRow & { id: string } => Boolean(row.id))
      .map((row) => ({
        id: row.id,
        sequenceNo: row.sequenceNo,
        vpNo: row.vpNo,
        mrRrNo: row.mrRrNo,
        sealNo: row.sealNo,
      })),
  });

  const onSubmit: SubmitHandler<MRRRFormInput> = async (values) => {
    try {
      if (isEdit && mrrrId) {
        const body: UpdateMRRRBody = {
          rakeType:
            values.rakeType === "INDENT" || values.rakeType === "LEASE"
              ? values.rakeType
              : undefined,
          remarks: values.remarks,
        };

        await updateMutation.mutateAsync({
          id: mrrrId,
          body,
        });

        if (values.rows.some((row) => row.id)) {
          await updateRowsMutation.mutateAsync({
            id: mrrrId,
            body: buildRowsBody(values.rows),
          });
        }

        toast.success("MR/RR updated");
        router.push(`/vp-management/mrrr/${encodeURIComponent(mrrrId)}`);
        return;
      }

      const body: CreateMRRRBody = {
        vpScheduleId: values.vpScheduleId,
        rakeType:
          values.rakeType === "INDENT" || values.rakeType === "LEASE"
            ? values.rakeType
            : undefined,
        remarks: values.remarks,
        rows: values.rows.map((row, index) => ({
          rowNumber: row.rowNumber ?? index + 1,
          sequenceNo: row.sequenceNo,
          vpNo: row.vpNo,
          mrRrNo: row.mrRrNo,
          sealNo: row.sealNo,
        })),
      };

      const created = await createMutation.mutateAsync(body);

      toast.success("MR/RR created");
      router.push(`/vp-management/mrrr/${encodeURIComponent(created.id)}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = () => {
    router.push("/vp-management/mrrr");
  };

  if (isEdit && detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-sm text-muted-foreground">Loading MR/RR...</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="relative mx-auto w-full max-w-5xl space-y-5 pb-20"
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {isEdit ? "Edit MR/RR" : "Create MR/RR"}
          </h1>

          <p className="mt-1 text-xs text-muted-foreground">
            {isEdit
              ? "Update MR/RR details and remarks."
              : "Create MR/RR from a planned VP schedule."}
          </p>
        </div>

        <div className="grid gap-4">
          <FormSection
            icon={<IconFileInvoice size={16} />}
            title="MR/RR Details"
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
                    onSelect={(date) => {
                      const value = date ? date.toISOString() : "";

                      field.onChange(value);

                      form.setValue("vpScheduleId", "");
                      replace([]);
                    }}
                    placeholder="Select schedule date"
                    disabled={isEdit}
                  />

                  {fieldState.error?.message ? (
                    <p className="text-xs text-red-600">
                      {fieldState.error.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <ComboboxField<MRRRFormInput>
              name="vpScheduleId"
              label="VP Schedule"
              options={vpScheduleOptions}
              emptyText="No VP schedules found"
              disabled={isEdit}
              required
            />

            <SelectField<MRRRFormInput>
              name="rakeType"
              label="Rake Type"
              options={RAKE_TYPE_OPTIONS}
              placeholder="Select rake type"
            />

            {isEdit && watchedMrRrNumber ? (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  MR/RR number
                </label>
                <Input value={watchedMrRrNumber} disabled />
              </div>
            ) : null}
          </FormSection>

          <FormSection
            icon={<IconTrain size={16} />}
            title="VP Schedule Preview"
            columns={1}
          >
            {!watchedVPScheduleId ? (
              <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                Select VP Schedule to load MR/RR preview rows.
              </div>
            ) : previewQuery.isLoading ? (
              <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                Loading VP Schedule preview...
              </div>
            ) : previewSchedule ? (
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Schedule No
                      </p>
                      <p className="text-sm font-medium">
                        {previewSchedule.scheduleNumber ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Schedule Date
                      </p>
                      <p className="text-sm font-medium">
                        {previewSchedule.scheduleDate
                          ? new Date(
                              previewSchedule.scheduleDate,
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        From Branch
                      </p>
                      <p className="text-sm font-medium">
                        {previewSchedule.fromBranch?.name ??
                          previewSchedule.fromBranch?.branchCode ??
                          "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">To Branch</p>
                      <p className="text-sm font-medium">
                        {previewSchedule.toBranch?.name ??
                          previewSchedule.toBranch?.branchCode ??
                          "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Wagons
                      </p>
                      <p className="text-sm font-medium">
                        {previewSchedule.totalWagonCount ??
                          previewQuery.data?.rows?.length ??
                          0}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Total MT</p>
                      <p className="text-sm font-medium">
                        {previewSchedule.totalCapacityMt ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Total CFT</p>
                      <p className="text-sm font-medium">
                        {previewSchedule.totalCapacityCft != null
                          ? Number(
                              previewSchedule.totalCapacityCft,
                            ).toLocaleString("en-IN")
                          : "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Freight
                      </p>
                      <p className="text-sm font-medium">
                        {formatFreight(previewTotalFreight)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Route</p>
                    <p className="text-sm font-medium">
                      {previewSchedule.sourceArea?.name ?? "—"} →{" "}
                      {previewSchedule.destinationArea?.name ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {previewWagonCounts.map((wagon) => (
                    <div
                      key={wagon.id}
                      className="rounded-xl border bg-background p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3 border-b pb-3">
                        <p className="text-sm font-semibold text-foreground">
                          {wagon.wagon?.name ?? "—"}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Wagon Count:{" "}
                          <span className="font-medium text-foreground">
                            {wagon.count ?? "—"}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Capacity MT
                          </p>
                          <p className="font-medium">
                            {wagon.capacityMt ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Capacity CFT
                          </p>
                          <p className="font-medium">
                            {wagon.capacityCft ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Total MT
                          </p>
                          <p className="font-medium">{wagon.totalMt ?? "—"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Total CFT
                          </p>
                          <p className="font-medium">
                            {wagon.totalCft != null
                              ? Number(wagon.totalCft).toLocaleString("en-IN")
                              : "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Freight / Wagon
                          </p>
                          <p className="font-medium">
                            {formatFreight(wagon.freightAmount)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Total Freight
                          </p>
                          <p className="font-medium">
                            {formatFreight(wagon.totalFreight)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Preview not available for selected VP Schedule.
              </div>
            )}
          </FormSection>
          <FormSection
            icon={<IconClipboardList size={16} />}
            title="MR/RR Rows"
            columns={1}
          >
            <div className="space-y-3">
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wagon</TableHead>
                      <TableHead className="w-32">Sequence No</TableHead>
                      <TableHead className="w-36">VP No</TableHead>
                      <TableHead className="w-36">MR/RR No</TableHead>
                      <TableHead>Seal No</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {fields.length ? (
                      fields.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell className="align-top">
                            <div className="text-sm font-medium">
                              {watchedRows[index]?.rowLabel ||
                                watchedRows[index]?.wagonTypeLabel ||
                                "-"}
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            <Input
                              placeholder="Sequence"
                              {...form.register(`rows.${index}.sequenceNo`)}
                            />
                          </TableCell>

                          <TableCell className="align-top">
                            <Input
                              placeholder="VP no"
                              {...form.register(`rows.${index}.vpNo`)}
                            />
                          </TableCell>

                          <TableCell className="align-top">
                            <Input
                              placeholder="MR/RR no"
                              {...form.register(`rows.${index}.mrRrNo`)}
                            />
                          </TableCell>

                          <TableCell className="align-top">
                            <textarea
                              className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Seal no"
                              {...form.register(`rows.${index}.sealNo`)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          Select VP Schedule to generate rows.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {typeof errors.rows?.message === "string" ? (
                <p className="text-xs text-red-600">{errors.rows.message}</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Rows:{" "}
                    <span className="font-semibold text-foreground">
                      {totalRows}
                    </span>
                  </span>

                  <span>
                    Total wagons:{" "}
                    <span className="font-semibold text-foreground">
                      {totalRows}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={<IconNotes size={16} />}
            title="Remarks"
            columns={1}
          >
            <TextAreaField<MRRRFormInput>
              name="remarks"
              label="Remarks"
              placeholder="Any MR/RR notes"
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
              {totalRows > 0
                ? `${totalRows} MR/RR row${totalRows === 1 ? "" : "s"} prepared`
                : "Select VP Schedule to prepare MR/RR"}
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
                    : "Create MR/RR"}
              </Button>
            </div>
          </div>
        </motion.div>
      </form>
    </FormProvider>
  );
}
