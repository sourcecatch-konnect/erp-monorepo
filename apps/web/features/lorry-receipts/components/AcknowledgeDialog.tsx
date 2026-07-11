"use client";

import * as React from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { acknowledgeLRSchema } from "@skerp/validators/lorry-receipt/delivery";
import type {
  AcknowledgeLRFormInput,
  LRAcknowledgement,
  LRGoods,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { IconPaperclip, IconX } from "@tabler/icons-react";

import { MoneyField, FieldLabel } from "./moneyField";
import { toValidDate } from "@/lib/date";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lrNumber: string;
  goods: LRGoods[];
  /** "acknowledge" creates the record; "edit" updates it. */
  mode: "acknowledge" | "edit";
  initial?: LRAcknowledgement | null;
  isPending: boolean;
  /** Scan files only collected in "acknowledge" mode; parent uploads them. */
  onConfirm: (values: AcknowledgeLRFormInput, scanFiles: File[]) => void;
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

const buildDefaults = (
  goods: LRGoods[],
  initial?: LRAcknowledgement | null,
): AcknowledgeLRFormInput => {
  const itemByGoods = new Map(
    (initial?.items ?? []).map((item) => [item.lrGoodsId, item]),
  );
  return {
    receivedAt: initial
      ? toLocalInputValue(new Date(initial.receivedAt))
      : toLocalInputValue(new Date()),
    courierName: initial?.courierName ?? "",
    courierDocketNo: initial?.courierDocketNo ?? "",
    courierCharge: toRupeesInput(initial?.courierCharge),
    detentionDays:
      initial?.detentionDays != null ? String(initial.detentionDays) : "",
    detentionAmount: toRupeesInput(initial?.detentionAmount),
    damageAmount: toRupeesInput(initial?.damageAmount),
    remark: initial?.remark ?? "",
    items: goods.map((g) => {
      const item = itemByGoods.get(g.id);
      return {
        lrGoodsId: g.id,
        receivedQty:
          item?.receivedQty != null
            ? String(item.receivedQty)
            : String(g.quantity),
        damagedQty: item?.damagedQty != null ? String(item.damagedQty) : "",
      };
    }),
  };
};

/**
 * POD return: the signed LR paper is back at the booking branch. Captures the
 * legacy acknowledgement data — courier, detention, damage, per-item received
 * and damaged quantities — plus scanned copies.
 */
export default function AcknowledgeDialog({
  open,
  onOpenChange,
  lrNumber,
  goods,
  mode,
  initial,
  isPending,
  onConfirm,
}: Props) {
  const [scanFiles, setScanFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<AcknowledgeLRFormInput>({
    resolver: zodResolver(acknowledgeLRSchema, undefined, { raw: true }),
    defaultValues: buildDefaults(goods, initial),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(goods, initial));
    setScanFiles([]);
  }, [open, goods, initial, form]);

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-screen w-full overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>
            {mode === "acknowledge"
              ? `Acknowledge POD for LR ${lrNumber}`
              : `Edit acknowledgement of LR ${lrNumber}`}
          </SheetTitle>
          <SheetDescription>
            Record the signed POD paper returning to the booking branch:
            courier, detention, damage and received quantities.
          </SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <form
            id="acknowledge-lr-form"
            onSubmit={form.handleSubmit((values) =>
              onConfirm(values, scanFiles),
            )}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            <section className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <div>
                <FieldLabel required>POD received at</FieldLabel>
                <Controller
                  name="receivedAt"
                  control={form.control}
                  render={({ field }) => (
                    <DateTimePicker
                      selected={toValidDate(field.value)}
                      onSelect={field.onChange}
                      placeholder="Select POD receipt date and time"
                      clearable={false}
                    />
                  )}
                />
                {errors.receivedAt?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.receivedAt.message)}
                  </p>
                ) : null}
              </div>
              <div>
                <FieldLabel>Courier name</FieldLabel>
                <Input {...form.register("courierName")} className="h-9" />
              </div>
              <div>
                <FieldLabel>Courier docket no.</FieldLabel>
                <Input {...form.register("courierDocketNo")} className="h-9" />
              </div>
              <MoneyField<AcknowledgeLRFormInput>
                name="courierCharge"
                label="Courier charge"
              />
            </section>

            <section className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Detention days</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  {...form.register("detentionDays")}
                  className="h-9"
                />
                {errors.detentionDays?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.detentionDays.message)}
                  </p>
                ) : null}
              </div>
              <MoneyField<AcknowledgeLRFormInput>
                name="detentionAmount"
                label="Detention amount"
              />
              <MoneyField<AcknowledgeLRFormInput>
                name="damageAmount"
                label="Damage amount"
              />
            </section>

            {goods.length > 0 && (
              <section className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Received quantities
                </p>
                <div className="space-y-2">
                  {goods.map((g, idx) => (
                    <div
                      key={g.id}
                      className="grid items-end gap-3 sm:grid-cols-3"
                    >
                      <input
                        type="hidden"
                        {...form.register(`items.${idx}.lrGoodsId`)}
                      />
                      <div>
                        <p className="text-sm font-medium">{g.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Booked qty {g.quantity}
                          {g.unit ? ` ${g.unit}` : ""}
                        </p>
                      </div>
                      <div>
                        <FieldLabel>Received qty</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          {...form.register(`items.${idx}.receivedQty`)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <FieldLabel>Damaged qty</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          {...form.register(`items.${idx}.damagedQty`)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div>
              <FieldLabel>Remark</FieldLabel>
              <Textarea {...form.register("remark")} rows={2} />
            </div>

            {mode === "acknowledge" && (
              <div>
                <FieldLabel>POD scans</FieldLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setScanFiles((prev) => [
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
                  <IconPaperclip size={14} className="mr-1" /> Add scan
                </Button>
                {scanFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {scanFiles.map((file, idx) => (
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
                            setScanFiles((prev) =>
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

        <SheetFooter className="shrink-0 border-t bg-background sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="acknowledge-lr-form" disabled={isPending}>
            {isPending
              ? "Saving…"
              : mode === "acknowledge"
                ? "Acknowledge POD"
                : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
