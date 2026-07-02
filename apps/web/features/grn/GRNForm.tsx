"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconClipboardCheck,
  IconCurrencyRupee,
  IconNotes,
  IconPackage,
  IconReceipt,
  IconTrain,
} from "@tabler/icons-react";

import type { CreateGRNBody, CreateGRNFormInput, GRNDamagesBy } from "@skerp/types";
import { createGRNSchema } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import FormSection from "@/features/masters/_shared/fields/FormSection";
import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "@/features/masters/_shared/master-api";
import { lorryReceiptApi } from "@/features/lorry-receipts/lorry-receipt.service";

import { formatMoney } from "@/lib/format";

import { useCreateGRN, useGRNLRPreview } from "./hook/useGrn";
import { formatDate, formatGRNMoney } from "./grn-ui";
import { DatePicker } from "@skerp/ui/components/datepicker";

type Props = {
  mode: "create";
};

type GRNFormValues = CreateGRNFormInput;

type FlatError = {
  label: string;
  message: string;
};

const FIELD_LABELS: Record<string, string> = {

  lorryReceiptId: "LR",
  gateNo: "Gate No",
  inDateTime: "In date/time",
  outDateTime: "Out date/time",
  goods: "Goods",
  receivedQty: "Received quantity",
  damageQty: "Damage quantity",
  shortageQty: "Shortage quantity",
};

const DAMAGE_OPTIONS: { label: string; value: GRNDamagesBy }[] = [
  { label: "None", value: "NONE" },
  { label: "Transporter", value: "TRANSPORTER" },
  { label: "Labour", value: "LABOUR" },
  { label: "Railway", value: "RAILWAY" },
  { label: "Customer", value: "CUSTOMER" },
  { label: "Unknown", value: "UNKNOWN" },
];

const CHECK_FIELDS = [
  { name: "lrCopyChecked", label: "LR Copy", remark: "lrCopyRemark" },
  { name: "invoiceChecked", label: "Invoice", remark: "invoiceRemark" },
  { name: "kataReceiptChecked", label: "Kata Receipt", remark: "kataReceiptRemark" },
  { name: "wayBillChecked", label: "Way Bill", remark: "wayBillRemark" },
  { name: "sealNoChecked", label: "Seal No", remark: "sealNoRemark" },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const humanLabel = (path: string[]) => {
  const parts: string[] = [];

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];

    if (!segment || /^\d+$/.test(segment)) continue;

    const next = path[index + 1];

    if (next && /^\d+$/.test(next)) {
      parts.push(`Goods row ${Number(next) + 1}`);
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


const watchedMoney = (value: unknown): number => {
  const amount = value === "" || value === undefined ? undefined : Number(value);

  return amount !== undefined && Number.isFinite(amount) ? amount : 0;
};

export function GRNForm({ mode }: Props) {
  const router = useRouter();
  const createMutation = useCreateGRN();

  const form = useForm<GRNFormValues>({
    resolver: zodResolver(createGRNSchema) as any,
    mode: "onTouched",
    defaultValues: {
      lorryReceiptId: "",

      gateNo: "",
       inDateTime: new Date().toISOString().slice(0, 10),
      outDateTime: "",
      labourId: "",
      labourCharge: "",
      unloadingSupervisorId: "",
      damagesBy: "NONE",
      lrCopyChecked: false,
      invoiceChecked: false,
      kataReceiptChecked: false,
      wayBillChecked: false,
      sealNoChecked: false,
      lrCopyRemark: "",
      invoiceRemark: "",
      kataReceiptRemark: "",
      wayBillRemark: "",
      sealNoRemark: "",
      totalFreight: "",
      balanceFreight: "",
      freightPerMt: "",
      detentionDays: 0,
      detentionRate: "",
      advanceAmount: "",
      damageAmount: "",
      tdsAmount: "",
      hamaliAmount: "",
      printingStationaryAmount: "",
      remarks: "",
      goods: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "goods",
  });

  const watchedLorryReceiptId = form.watch("lorryReceiptId");
  const watchedGoods = form.watch("goods") ?? [];
  const watchedValues = form.watch();

 const lrQuery = useQuery({
  queryKey: ["grn-lookups", "finalised-lrs"],
  queryFn: () =>
    lorryReceiptApi.list({
      page: 0,
      size: 100,
      filter: { status: "FINALISED" },
    } satisfies ListQuery),
});
console.log(lrQuery.data?.data,"LRs at GRN")
const lrOptions =
  lrQuery.data?.data.map((lr) => ({
    value: lr.id,
    label: lr.lrNumber ?? "",
  })) ?? [];
  const previewQuery = useGRNLRPreview(watchedLorryReceiptId || "");

  React.useEffect(() => {
    const preview = previewQuery.data;

    if (!preview || !watchedLorryReceiptId) return;

    replace(
      preview.goods.map((item) => ({
        lrGoodsId: item.lrGoodsId,
        goodsName: item.goodsName,
        description: item.description ?? "",
        totalQty: item.totalQty,
        receivedQty: item.totalQty,
        damageQty: 0,
        shortageQty: 0,
        unit: item.unit ?? "",
        weight: item.weight == null ? "" : String(item.weight),
        remarks: "",
      })),
    );

    form.setValue(
      "totalFreight",
      preview.lorryReceipt.invoiceAmount == null
        ? ""
        : String(preview.lorryReceipt.invoiceAmount),
      { shouldDirty: false, shouldValidate: false },
    );
    form.setValue(
      "balanceFreight",
      preview.lorryReceipt.invoiceAmount == null
        ? ""
        : String(preview.lorryReceipt.invoiceAmount),
      { shouldDirty: false, shouldValidate: false },
    );
  }, [form, previewQuery.data, replace, watchedLorryReceiptId]);

 



  const totals = React.useMemo(() => {
    return watchedGoods.reduce(
      (acc, row) => {
        acc.totalQty += Number(row.totalQty || 0);
        acc.receivedQty += Number(row.receivedQty || 0);
        acc.damageQty += Number(row.damageQty || 0);
        acc.shortageQty += Number(row.shortageQty || 0);
        acc.weight += Number(row.weight || 0);

        return acc;
      },
      {
        totalQty: 0,
        receivedQty: 0,
        damageQty: 0,
        shortageQty: 0,
        weight: 0,
      },
    );
  }, [watchedGoods]);
React.useEffect(() => {
  const totalFreight = watchedMoney(watchedValues.totalFreight);
  const advanceAmount = watchedMoney(watchedValues.advanceAmount);

  const balanceFreight = Math.max(totalFreight - advanceAmount, 0);

  form.setValue("balanceFreight", String(balanceFreight), {
    shouldDirty: true,
    shouldValidate: true,
  });
}, [form, watchedValues.totalFreight, watchedValues.advanceAmount]);
const moneyPreview = React.useMemo(() => {
  const balanceFreight = watchedMoney(watchedValues.balanceFreight);
  const detentionDays = Number(watchedValues.detentionDays || 0);
  const detentionRate = watchedMoney(watchedValues.detentionRate);

  const detentionAmount = detentionRate;
  const gross = balanceFreight + detentionAmount;

  const net =
    gross -
    watchedMoney(watchedValues.damageAmount) -
    watchedMoney(watchedValues.tdsAmount) +
    watchedMoney(watchedValues.hamaliAmount) +
    watchedMoney(watchedValues.printingStationaryAmount);

  return { detentionAmount, gross, net };
}, [watchedValues]);

  const validationIssues = React.useMemo(
    () => collectErrors(form.formState.errors),
    [form.formState.errors],
  );
  const showValidationSummary =
    form.formState.submitCount > 0 && validationIssues.length > 0;

  const onSubmit = async (values: GRNFormValues) => {
    try {
      const parsed = createGRNSchema.parse(values) as CreateGRNBody;
      const created = await createMutation.mutateAsync(parsed);

      toast.success("GRN created");
      router.push(`/vp-management/grn?created=${encodeURIComponent(created.id)}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
const toSafeNumber = (value: unknown) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const recalculateShortage = (
  index: number,
  nextValues?: {
    totalQty?: unknown;
    receivedQty?: unknown;
    damageQty?: unknown;
  },
) => {
  const row = form.getValues(`goods.${index}`);

  const totalQty = toSafeNumber(nextValues?.totalQty ?? row.totalQty);
  const receivedQty = toSafeNumber(nextValues?.receivedQty ?? row.receivedQty);
  const damageQty = toSafeNumber(nextValues?.damageQty ?? row.damageQty);

  const shortageQty = Math.max(totalQty - receivedQty, 0);

  form.setValue(`goods.${index}.shortageQty`, shortageQty, {
    shouldDirty: true,
    shouldValidate: true,
  });
};
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto w-full max-w-6xl space-y-5 p-4 pb-20"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "create" ? "Create GRN" : "GRN"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Receive rail-head goods against a finalised LR.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/vp-management/grn")}
          >
            Back
          </Button>
        </div>

        <FormSection icon={<IconTrain size={16} />} title="LR Detail" columns={3}>
   

          <ComboboxField<GRNFormValues>
            name="lorryReceiptId"
            label="LR Number"
            options={lrOptions}
            emptyText="No finalised LRs found"
            required
          />

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Gate No</label>
            <Input placeholder="Gate number" {...form.register("gateNo")} />
          </div>

          <div className="grid gap-1.5">
           
            <Controller
  control={form.control}
  name="inDateTime"
  render={({ field }) => (
    <DatePicker
      label="In Date"
      selected={field.value ? new Date(field.value) : undefined}
      onSelect={(d) =>
        field.onChange(d ? d.toISOString().slice(0, 10) : "")
      }
    />
  )}
/>
          </div>

          <div className="grid gap-1.5">
           
           <Controller
  control={form.control}
  name="outDateTime"
  render={({ field }) => (
    <DatePicker
      label="Out Date"
      selected={field.value ? new Date(field.value) : undefined}
      onSelect={(d) =>
        field.onChange(d ? d.toISOString().slice(0, 10) : "")
      }
    />
  )}
/>
          </div>

          <SelectField<GRNFormValues>
            name="damagesBy"
            label="Damages By"
            options={DAMAGE_OPTIONS}
          />
        </FormSection>

        <FormSection icon={<IconReceipt size={16} />} title="LR Preview" columns={1}>
          {!watchedLorryReceiptId ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Select a finalised LR to load consignor, consignee, e-way bill, and goods lines.
            </div>
          ) : previewQuery.isLoading ? (
            <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
              Loading LR preview...
            </div>
          ) : previewQuery.data ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">LR Number</p>
                <p className="text-sm font-medium">
                  {previewQuery.data.lorryReceipt.lrNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Group</p>
                <p className="text-sm font-medium">
                  {previewQuery.data.group?.groupNumber ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consignor</p>
                <p className="text-sm font-medium">
                  {(previewQuery.data.group?.consignor as any)?.name ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consignee</p>
                <p className="text-sm font-medium">
                  {(previewQuery.data.group?.consignee as any)?.name ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Origin</p>
                <p className="text-sm font-medium">
                  {(previewQuery.data.group?.originBranch as any)?.name ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Destination</p>
                <p className="text-sm font-medium">
                  {(previewQuery.data.group?.destinationBranch as any)?.name ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoice</p>
                <p className="text-sm font-medium">
                  {previewQuery.data.lorryReceipt.invoiceNumber ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoice Amount</p>
                <p className="text-sm font-medium">
                  {formatMoney(previewQuery.data.lorryReceipt.invoiceAmount)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              LR preview is not available for this selection.
            </div>
          )}
        </FormSection>

        <FormSection icon={<IconPackage size={16} />} title="Goods Receiving" columns={1}>
          <div className="overflow-x-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Goods</TableHead>
                  <TableHead className="w-28">Total</TableHead>
                  <TableHead className="w-28">Received</TableHead>
                  <TableHead className="w-28">Damage</TableHead>
                  <TableHead className="w-28">Shortage</TableHead>
                  <TableHead className="w-28">Weight</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length ? (
                  fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell className="min-w-56 align-top">
                        <Input
                          placeholder="Goods name"
                          {...form.register(`goods.${index}.goodsName`)}
                        />
                        <input type="hidden" {...form.register(`goods.${index}.lrGoodsId`)} />
                        <input type="hidden" {...form.register(`goods.${index}.unit`)} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
  type="number"
  min={0}
  {...form.register(`goods.${index}.totalQty`, {
    onChange: (event) => {
      recalculateShortage(index, {
        totalQty: event.target.value,
      });
    },
  })}
/>
                      </TableCell>
                      <TableCell className="align-top">
                       <Input
  type="number"
  min={0}
  {...form.register(`goods.${index}.receivedQty`, {
    onChange: (event) => {
      recalculateShortage(index, {
        receivedQty: event.target.value,
      });
    },
  })}
/>
                      </TableCell>
                      <TableCell className="align-top">
                       <Input
  type="number"
  min={0}
  {...form.register(`goods.${index}.damageQty`, {
    onChange: (event) => {
      recalculateShortage(index, {
        damageQty: event.target.value,
      });
    },
  })}
/>
                      </TableCell>
                      <TableCell className="align-top">
                       <Input
  type="number"
  min={0}
  readOnly
  className="bg-muted/50"
  {...form.register(`goods.${index}.shortageQty`)}
/>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
                          {...form.register(`goods.${index}.weight`)}
                        />
                      </TableCell>
                      <TableCell className="min-w-52 align-top">
                        <Input
                          placeholder="Row remarks"
                          {...form.register(`goods.${index}.remarks`)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Select LR to prepare goods receiving rows.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

         
        </FormSection>

        <FormSection icon={<IconCurrencyRupee size={16} />} title="Freight & Charges" columns={3}>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Total Freight</label>
            <Input type="number" min={0} step="0.01" {...form.register("totalFreight")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Balance Freight</label>
           <Input
  type="number"
  min={0}
  step="0.01"
  readOnly
  className="bg-muted/50"
  {...form.register("balanceFreight")}
/>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Freight / MT</label>
            <Input type="number" min={0} step="0.01" {...form.register("freightPerMt")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Detention Days</label>
            <Input type="number" min={0} {...form.register("detentionDays")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Detention Rate</label>
            <Input type="number" min={0} step="0.01" {...form.register("detentionRate")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Advance</label>
            <Input type="number" min={0} step="0.01" {...form.register("advanceAmount")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Damages</label>
            <Input type="number" min={0} step="0.01" {...form.register("damageAmount")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">TDS</label>
            <Input type="number" min={0} step="0.01" {...form.register("tdsAmount")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hamali</label>
            <Input type="number" min={0} step="0.01" {...form.register("hamaliAmount")} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Printing & Stationary</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              {...form.register("printingStationaryAmount")}
            />
          </div>
          <div className="rounded-md border bg-background p-3 md:col-span-2">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Detention</p>
                <p className="font-medium">{formatGRNMoney(moneyPreview.detentionAmount * 100)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross</p>
                <p className="font-medium">{formatGRNMoney(moneyPreview.gross * 100)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-medium">{formatGRNMoney(moneyPreview.net * 100)}</p>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={<IconClipboardCheck size={16} />} title="Document Checks" columns={1}>
          <div className="grid gap-3 md:grid-cols-2">
            {CHECK_FIELDS.map((item) => (
              <div key={item.name} className="rounded-md border bg-background p-3">
                <Controller
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={Boolean(field.value)}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                      {item.label}
                    </label>
                  )}
                />
                <Input
                  className="mt-2"
                  placeholder={`${item.label} remark`}
                  {...form.register(item.remark)}
                />
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection icon={<IconNotes size={16} />} title="Remarks" columns={1}>
          <TextAreaField<GRNFormValues>
            name="remarks"
            label="Remarks"
            placeholder="Any unloading notes"
            rows={4}
            maxLength={500}
          />
        </FormSection>

        <div className="sticky bottom-0 z-20 border-t border-border/70 bg-background/85 py-3 backdrop-blur-md">
          {showValidationSummary ? (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <IconAlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-destructive"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    Please fix {validationIssues.length} issue
                    {validationIssues.length === 1 ? "" : "s"} before saving
                  </p>
                  {validationIssues.map((issue, index) => (
                    <p
                      key={`${issue.label}-${index}`}
                      className="text-xs text-destructive/90"
                    >
                      <span className="font-medium">{issue.label}:</span>{" "}
                      {issue.message}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {fields.length
                ? `${fields.length} goods row${fields.length === 1 ? "" : "s"} ready`
                : "Select LR to prepare GRN"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/vp-management/grn")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create GRN"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
