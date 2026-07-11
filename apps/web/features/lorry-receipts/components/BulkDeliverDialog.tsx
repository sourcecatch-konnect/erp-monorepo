"use client";

import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deliverGroupSchema } from "@skerp/validators/lorry-receipt/delivery";
import type { DeliverGroupFormInput } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";

import { MoneyField, FieldLabel } from "./moneyField";

type PendingLr = {
  id: string;
  lrNumber: string;
  unloadingLocation?: { name: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupNumber: string;
  /** FINALISED (not-yet-delivered) LRs of the group. */
  lrs: PendingLr[];
  isPending: boolean;
  onConfirm: (values: DeliverGroupFormInput) => void;
};

const toLocalInputValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

const buildDefaults = (lrs: PendingLr[]): DeliverGroupFormInput => ({
  deliveredAt: toLocalInputValue(new Date()),
  reportedAt: "",
  receiverName: "",
  receiverPhone: "",
  unloadingCharges: "",
  remark: "",
  lrs: lrs.map((lr) => ({ lrId: lr.id, unloadingCharges: "", remark: "" })),
});

/**
 * One dialog per truck: when everything unloads at one point, mark every
 * pending LR delivered with shared details, with optional per-LR overrides.
 */
export default function BulkDeliverDialog({
  open,
  onOpenChange,
  groupNumber,
  lrs,
  isPending,
  onConfirm,
}: Props) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const form = useForm<DeliverGroupFormInput>({
    resolver: zodResolver(deliverGroupSchema, undefined, { raw: true }),
    defaultValues: buildDefaults(lrs),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(lrs));
    setSelected(new Set(lrs.map((lr) => lr.id)));
  }, [open, lrs, form]);

  const errors = form.formState.errors;

  const submit = (values: DeliverGroupFormInput) => {
    const rows = values.lrs.filter((row) => selected.has(row.lrId));
    if (rows.length === 0) return;
    onConfirm({ ...values, lrs: rows });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-screen w-full overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Deliver group {groupNumber}</SheetTitle>
          <SheetDescription>
            Shared delivery details apply to every selected LR; unloading
            charges and remark can be overridden per LR.
          </SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <form
            id="bulk-deliver-form"
            onSubmit={form.handleSubmit(submit)}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            <section className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <div>
                <FieldLabel required>Delivered at</FieldLabel>
                <Input
                  type="datetime-local"
                  {...form.register("deliveredAt")}
                  className="h-9"
                />
                {errors.deliveredAt?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.deliveredAt.message)}
                  </p>
                ) : null}
              </div>
              <div>
                <FieldLabel>Truck reported at</FieldLabel>
                <Input
                  type="datetime-local"
                  {...form.register("reportedAt")}
                  className="h-9"
                />
              </div>
              <div>
                <FieldLabel>Receiver name</FieldLabel>
                <Input {...form.register("receiverName")} className="h-9" />
              </div>
              <div>
                <FieldLabel>Receiver phone</FieldLabel>
                <Input
                  {...form.register("receiverPhone")}
                  inputMode="tel"
                  className="h-9"
                />
              </div>
              <MoneyField<DeliverGroupFormInput>
                name="unloadingCharges"
                label="Unloading charges (shared)"
              />
              <div>
                <FieldLabel>Remark (shared)</FieldLabel>
                <Textarea {...form.register("remark")} rows={1} />
              </div>
            </section>

            <div className="space-y-2">
              {lrs.map((lr, idx) => {
                const checked = selected.has(lr.id);
                return (
                  <section
                    key={lr.id}
                    className="rounded-lg border bg-background p-3"
                  >
                    <input
                      type="hidden"
                      {...form.register(`lrs.${idx}.lrId`)}
                    />
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (value) next.add(lr.id);
                            else next.delete(lr.id);
                            return next;
                          })
                        }
                        aria-label={`Include ${lr.lrNumber}`}
                      />
                      <div>
                        <p className="text-sm font-semibold">{lr.lrNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {lr.unloadingLocation?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                    {checked && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MoneyField<DeliverGroupFormInput>
                          name={`lrs.${idx}.unloadingCharges`}
                          label="Unloading charges (override)"
                        />
                        <div>
                          <FieldLabel>Remark (override)</FieldLabel>
                          <Input
                            {...form.register(`lrs.${idx}.remark`)}
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
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
          <Button
            type="submit"
            form="bulk-deliver-form"
            disabled={isPending || selected.size === 0}
          >
            {isPending
              ? "Delivering…"
              : `Mark ${selected.size} LR${selected.size === 1 ? "" : "s"} delivered`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
