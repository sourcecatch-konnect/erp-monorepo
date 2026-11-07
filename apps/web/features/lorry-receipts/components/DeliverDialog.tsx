"use client";

import * as React from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { deliverLRSchema } from "@skerp/validators/lorry-receipt/delivery";
import type { DeliverLRFormInput, LRDelivery } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { IconInfoCircle, IconPaperclip, IconX } from "@tabler/icons-react";

import { lrKeys } from "../lorry-receipt.keys";
import { lorryReceiptApi } from "../lorry-receipt.service";
import { MoneyField, FieldLabel } from "./moneyField";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Loads the challans the LR travelled on, for their station report dates. */
  lrId: string;
  lrNumber: string;
  isMarketVehicle: boolean;
  /** "deliver" creates the record; "edit" updates an existing one. */
  mode: "deliver" | "edit";
  initial?: LRDelivery | null;
  isPending: boolean;
  /** POD photo files are only collected in "deliver" mode — the parent
   *  uploads them against the created delivery record. */
  onConfirm: (values: DeliverLRFormInput, podFiles: File[]) => void;
};

const toLocalInputValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

const toRupeesInput = (paise?: number | null) =>
  paise != null ? (paise / 100).toString() : "";

const toDate = (value: string | Date | undefined) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const buildDefaults = (initial?: LRDelivery | null): DeliverLRFormInput => {
  const deliveredAt = initial
    ? toLocalInputValue(new Date(initial.deliveredAt))
    : toLocalInputValue(new Date());
  return {
    deliveredAt,
    // Most trucks are unloaded the day they report, so a new delivery starts
    // from the delivery time. An existing record without one stays empty:
    // saving an unrelated edit must not invent a reporting time.
    reportedAt: initial
      ? initial.reportedAt
        ? toLocalInputValue(new Date(initial.reportedAt))
        : ""
      : deliveredAt,
    unloadingAt: initial?.unloadingAt
      ? toLocalInputValue(new Date(initial.unloadingAt))
      : "",
    receiverName: initial?.receiverName ?? "",
    receiverPhone: initial?.receiverPhone ?? "",
    unloadingCharges: toRupeesInput(initial?.unloadingCharges),
    remark: initial?.remark ?? "",
  };
};

/**
 * Mark an LR delivered at the destination branch (or edit the record later).
 * Captures the legacy fields plus receiver identity and on-the-spot POD
 * photos. See docs/LR_DELIVERY_ACK_PLAN.md §3.
 */
export default function DeliverDialog({
  open,
  onOpenChange,
  lrId,
  lrNumber,
  isMarketVehicle,
  mode,
  initial,
  isPending,
  onConfirm,
}: Props) {
  const [podFiles, setPodFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<DeliverLRFormInput>({
    resolver: zodResolver(deliverLRSchema, undefined, { raw: true }),
    defaultValues: buildDefaults(initial),
  });

  // Road-only LRs have none; the section then stays hidden.
  const challans = useQuery({
    queryKey: lrKeys.deliveryChallans(lrId),
    queryFn: () => lorryReceiptApi.deliveryChallans(lrId),
    enabled: open && Boolean(lrId),
    // Saving bumps each challan's version; a cached copy would be refused.
    staleTime: 0,
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(initial));
    setPodFiles([]);
  }, [open, initial, form]);

  // Declared after the reset so a cached list is not wiped by it on reopen.
  React.useEffect(() => {
    if (!open || !challans.data) return;
    form.setValue(
      "challanReportDates",
      challans.data.map((challan) => ({
        challanId: challan.id,
        version: challan.version,
        reportDate: challan.reportDate ? new Date(challan.reportDate) : null,
      })),
    );
  }, [open, challans.data, form]);

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "deliver"
              ? `Mark LR ${lrNumber} delivered`
              : `Edit delivery of LR ${lrNumber}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "deliver"
              ? "Record when and to whom the goods were handed over."
              : "Correct the delivery details. The delivered status is not affected."}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            id="deliver-lr-form"
            onSubmit={form.handleSubmit((values) =>
              onConfirm(values, podFiles),
            )}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Truck reported at</FieldLabel>
                <Controller
                  name="reportedAt"
                  control={form.control}
                  render={({ field }) => (
                    <DateTimePicker
                      selected={toDate(field.value)}
                      onSelect={field.onChange}
                      placeholder="When the truck reached"
                    />
                  )}
                />
                {errors.reportedAt?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.reportedAt.message)}
                  </p>
                ) : null}
              </div>

              <div>
                <FieldLabel required>Delivered at</FieldLabel>
                <Controller
                  name="deliveredAt"
                  control={form.control}
                  render={({ field }) => (
                    <DateTimePicker
                      selected={toDate(field.value)}
                      onSelect={(date) => {
                        field.onChange(date);
                        // Keep following the delivery time until the operator
                        // sets a separate reporting time. Only while marking
                        // delivered: an edit must not move a saved reporting
                        // time just because the delivery time was corrected.
                        if (
                          mode === "deliver" &&
                          !form.getFieldState("reportedAt").isDirty
                        ) {
                          form.setValue("reportedAt", date);
                        }
                      }}
                      placeholder="Select delivery date and time"
                      clearable={false}
                    />
                  )}
                />
                {errors.deliveredAt?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.deliveredAt.message)}
                  </p>
                ) : null}
              </div>

              <div>
                <FieldLabel>Unloading completed at</FieldLabel>
                <Controller
                  name="unloadingAt"
                  control={form.control}
                  render={({ field }) => (
                    <DateTimePicker
                      selected={toDate(field.value)}
                      onSelect={field.onChange}
                      placeholder="Select unloading completion"
                    />
                  )}
                />
                {errors.unloadingAt?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.unloadingAt.message)}
                  </p>
                ) : null}
              </div>
            </div>

            {challans.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : challans.data?.length ? (
              <section className="space-y-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Station report date</p>
                  <p className="text-xs text-muted-foreground">
                    The day the broker&apos;s truck reached the station for each
                    delivery challan. Detention counts from this date.
                  </p>
                </div>
                {challans.data.map((challan, index) => (
                  <div
                    key={challan.id}
                    className="grid items-center gap-2 sm:grid-cols-[1fr_16rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {challan.challanNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {challan.status}
                      </p>
                    </div>
                    <Controller
                      name={`challanReportDates.${index}.reportDate`}
                      control={form.control}
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value ?? undefined}
                          onSelect={(date) => field.onChange(date ?? null)}
                          placeholder="Not entered"
                        />
                      )}
                    />
                  </div>
                ))}
              </section>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Receiver name</FieldLabel>
                <Input
                  {...form.register("receiverName")}
                  placeholder="Who took the goods"
                  className="h-9"
                />
              </div>
              <div>
                <FieldLabel>Receiver phone</FieldLabel>
                <Input
                  {...form.register("receiverPhone")}
                  inputMode="tel"
                  className="h-9"
                />
              </div>
            </div>

            {isMarketVehicle ? (
              <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <div className="flex gap-2 text-amber-900">
                  <IconInfoCircle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      Market vehicle settlement
                    </p>
                    <p className="text-xs leading-5 text-amber-800">
                      Record the unloading amount paid on the road for this
                      market vehicle. Own-fleet deliveries do not ask for this
                      charge.
                    </p>
                  </div>
                </div>
                <MoneyField<DeliverLRFormInput>
                  name="unloadingCharges"
                  label="Unloading charge paid"
                />
              </section>
            ) : null}

            <div>
              <FieldLabel>Remark</FieldLabel>
              <Textarea {...form.register("remark")} rows={2} />
            </div>

            {mode === "deliver" && (
              <div>
                <FieldLabel>POD photos (signed LR / stacked goods)</FieldLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setPodFiles((prev) => [
                      ...prev,
                      ...Array.from(e.target.files ?? []),
                    ]);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconPaperclip size={14} className="mr-1" /> Add photo
                </Button>
                {podFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {podFiles.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between rounded-sm bg-muted px-2 py-1 text-xs"
                      >
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setPodFiles((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <IconX size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </form>
        </FormProvider>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="deliver-lr-form" disabled={isPending}>
            {isPending
              ? "Saving…"
              : mode === "deliver"
                ? "Mark delivered"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
