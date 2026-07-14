"use client";

import * as React from "react";
import { useFieldArray, useFormContext, Controller } from "react-hook-form";
import { motion, AnimatePresence } from "motion/react";
import type { CreateOrderFormInput } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { IconTrash, IconPlus, IconArrowRight } from "@tabler/icons-react";

import { useUnitOfMeasureOptions } from "@/features/masters/unitOfMeasure/useUnitOfMeasureOptions";

type FormValues = CreateOrderFormInput;

const emptyGoods = () => ({
  goodsId: "",
  quantity: 1,
});

const lineMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
  transition: { duration: 0.22, ease: "easeOut" as const },
};

/**
 * Consignment-lines editor for Truck (multi-loading) orders. One line = one LR.
 * Each line pins a truck #, its loading + unloading CustomerLocation, and one
 * or more goods rows (every invoice carried between that pair). Lines sharing a
 * truck # become one LRGroup at LR generation.
 *
 * The schema enforces that a loading -> unloading pair can't repeat within the
 * same truck — carry several invoices on one line via the goods rows instead of
 * cloning the line.
 */
export default function ConsignmentLinesEditor({
  goodsOptions,
  loadingOptions,
  unloadingOptions,
  consigneeChosen,
  truckCount,
}: {
  goodsOptions: ComboboxOption[];
  loadingOptions: ComboboxOption[];
  unloadingOptions: ComboboxOption[];
  consigneeChosen: boolean;
  /** Booked truck quantity — bounds the per-line truck selector to 1..N. */
  truckCount: number;
}) {
  const {
    control,
    trigger,
    getValues,
    formState: { isSubmitted },
  } = useFormContext<FormValues>();

  const { fields, append, remove } = useFieldArray<FormValues, "consignments">({
    control,
    name: "consignments",
  });
  const units = useUnitOfMeasureOptions();

  // After a save attempt, removing a line must re-run the resolver — otherwise
  // the stale error for the removed line lingers in formState.errors.
  const removeLine = React.useCallback(
    (index: number) => {
      remove(index);
      if (isSubmitted) void trigger("consignments");
    },
    [remove, trigger, isSubmitted],
  );

  const addLine = React.useCallback(
    () =>
      append({
        truckIndex: 1,
        loadingLocationId: undefined,
        unloadingLocationId: undefined,
        totalWeight: undefined,
        totalWeightUnit: "MT",
        goods: [],
      }),
    [append],
  );

  React.useEffect(() => {
    const current = getValues("consignments") ?? [];

    if (current.length === 0) {
      append({
        truckIndex: 1,
        loadingLocationId: undefined,
        unloadingLocationId: undefined,
        totalWeight: undefined,
        totalWeightUnit: "MT",
        goods: [],
      });
    }
  }, [append, getValues]);
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {fields.map((field, index) => (
          <motion.div key={field.id} layout {...lineMotion}>
            <ConsignmentLineCard
              index={index}
              goodsOptions={goodsOptions}
              loadingOptions={loadingOptions}
              unloadingOptions={unloadingOptions}
              unitOptions={units.options}
              consigneeChosen={consigneeChosen}
              truckCount={truckCount}
              onRemove={() => removeLine(index)}
              canRemove={fields.length > 1}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addLine}
        className="gap-1.5"
      >
        <IconPlus size={16} /> Add consignment line
      </Button>
    </div>
  );
}

/**
 * One consignment line: an LR badge + truck #, the loading -> unloading pair,
 * and a nested goods field array. Its own component so the goods
 * `useFieldArray` hook is called at the top level of a render (not in a map).
 */
function ConsignmentLineCard({
  index,
  goodsOptions,
  loadingOptions,
  unloadingOptions,
  unitOptions,
  consigneeChosen,
  truckCount,
  onRemove,
  canRemove,
}: {
  index: number;
  goodsOptions: ComboboxOption[];
  loadingOptions: ComboboxOption[];
  unloadingOptions: ComboboxOption[];
  unitOptions: ComboboxOption[];
  consigneeChosen: boolean;
  truckCount: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const {
    control,
    trigger,
    formState: { errors, isSubmitted },
  } = useFormContext<FormValues>();

  const { fields, append, remove } = useFieldArray<
    FormValues,
    `consignments.${number}.goods`
  >({
    control,
    name: `consignments.${index}.goods`,
  });

  const removeGoods = (gIndex: number) => {
    remove(gIndex);
    if (isSubmitted) void trigger(`consignments.${index}.goods`);
  };

  const lineErr = errors.consignments?.[index];

  // Truck selector is bounded by the booked quantity (at least 1), so a line can
  // never be pinned to a truck that won't exist at LR generation.
  const truckChoices = React.useMemo(
    () => Array.from({ length: Math.max(1, truckCount) }, (_, i) => i + 1),
    [truckCount],
  );

  // Selecting a location should run the cross-line duplicate check immediately
  // (Combobox fires no native blur), so we touch the field on change.
  const touchOnChange =
    (f: { onChange: (v: string) => void; onBlur: () => void }) =>
    (val: string) => {
      f.onChange(val);
      f.onBlur();
    };

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Header: LR badge + truck #, remove */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            LR {index + 1}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Truck #</span>
            <Controller
              control={control}
              name={`consignments.${index}.truckIndex`}
              render={({ field: f }) => (
                <Select
                  value={String(f.value ?? 1)}
                  onValueChange={(v) => f.onChange(v)}
                >
                  <SelectTrigger className="h-8 w-[4.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {truckChoices.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove consignment line"
        >
          <IconTrash size={16} />
        </Button>
      </div>

      {/* Loading -> Unloading */}
      <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Loading point <span className="text-red-600">*</span>
          </label>
          <Controller
            control={control}
            name={`consignments.${index}.loadingLocationId`}
            render={({ field: f }) => (
              <Combobox
                options={loadingOptions}
                value={typeof f.value === "string" ? f.value : undefined}
                onChange={touchOnChange(f)}
                placeholder="Pickup location"
                invalid={Boolean(lineErr?.loadingLocationId)}
              />
            )}
          />
          {lineErr?.loadingLocationId?.message ? (
            <p className="mt-1.5 text-xs text-red-600">
              {lineErr.loadingLocationId.message}
            </p>
          ) : null}
        </div>

        <div className="hidden pb-2.5 text-muted-foreground md:block">
          <IconArrowRight size={18} />
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Unloading point <span className="text-red-600">*</span>
          </label>
          <Controller
            control={control}
            name={`consignments.${index}.unloadingLocationId`}
            render={({ field: f }) => (
              <Combobox
                options={unloadingOptions}
                value={typeof f.value === "string" ? f.value : undefined}
                onChange={touchOnChange(f)}
                placeholder={
                  consigneeChosen ? "Drop location" : "Pick consignee first"
                }
                invalid={Boolean(lineErr?.unloadingLocationId)}
              />
            )}
          />
          {lineErr?.unloadingLocationId?.message ? (
            <p className="mt-1.5 text-xs text-red-600">
              {lineErr.unloadingLocationId.message}
            </p>
          ) : null}
        </div>
      </div>

    

      {/* Goods */}
      <div className="mt-4 rounded-md bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Goods
          </p>
        </div>

        {/* Column header (desktop) */}
     <div className="flex items-center gap-2 px-1 pb-1.5 text-[11px] uppercase text-muted-foreground">
  <span className="min-w-0 flex-1">Item</span>
  <span className="w-24 shrink-0">Qty</span>
  <span className="w-8 shrink-0" />
</div>

        <div className="space-y-2 sm:space-y-1">
          {fields.length === 0 ? (
            <div className="rounded-md border border-dashed bg-background px-3 py-4 text-center text-xs text-muted-foreground">
              No goods added yet.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {fields.map((goodsField, gIndex) => {
                const goodsErr = lineErr?.goods?.[gIndex];
                return (
                 <motion.div
  key={goodsField.id}
  layout
  {...lineMotion}
  className="flex items-start gap-2"
>
  <div className="min-w-0 flex-1">
    <Controller
      control={control}
      name={`consignments.${index}.goods.${gIndex}.goodsId`}
      render={({ field: f }) => (
        <Combobox
          options={goodsOptions}
          value={typeof f.value === "string" ? f.value : undefined}
          onChange={f.onChange}
          placeholder="Select goods"
          invalid={Boolean(goodsErr?.goodsId)}
        />
      )}
    />
    {goodsErr?.goodsId?.message ? (
      <p className="mt-1 text-xs text-red-600">
        {goodsErr.goodsId.message}
      </p>
    ) : null}
  </div>

  <div className="w-24 shrink-0">
    <Controller
      control={control}
      name={`consignments.${index}.goods.${gIndex}.quantity`}
      render={({ field: f }) => (
        <Input
          type="number"
          min={1}
          placeholder="Qty"
          value={(f.value as number | string) ?? ""}
          onChange={(e) => f.onChange(e.target.value)}
          aria-invalid={Boolean(goodsErr?.quantity)}
        />
      )}
    />
  </div>

  <Button
    type="button"
    size="icon-sm"
    variant="ghost"
    className="shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
    onClick={() => removeGoods(gIndex)}
    aria-label="Remove goods row"
  >
    <IconTrash size={16} />
  </Button>
</motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <button
          type="button"
          onClick={() => append(emptyGoods())}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          <IconPlus size={14} /> Add goods
        </button>
      </div>
<div className="mt-3 grid gap-1.5">
  <div className="flex items-center justify-start gap-3">
    <label className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
      Total weight
    </label>

    <div className="w-40 shrink-0">
      <Controller
        control={control}
        name={`consignments.${index}.totalWeight`}
        render={({ field: f }) => (
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Weight"
            value={(f.value as number | string) ?? ""}
            onChange={(e) => f.onChange(e.target.value)}
            aria-invalid={Boolean(lineErr?.totalWeight)}
          />
        )}
      />
    </div>

    <div className="w-28 shrink-0">
      <Controller
        control={control}
        name={`consignments.${index}.totalWeightUnit`}
        render={({ field: f }) => (
          <Combobox
            options={unitOptions}
            value={typeof f.value === "string" ? f.value : undefined}
            onChange={f.onChange}
            placeholder="Unit"
            emptyText="No units found"
            invalid={Boolean(lineErr?.totalWeightUnit)}
          />
        )}
      />
    </div>
  </div>

  {lineErr?.totalWeight?.message ? (
    <p className="ml-28 text-xs text-red-600">{lineErr.totalWeight.message}</p>
  ) : null}

  {lineErr?.totalWeightUnit?.message ? (
    <p className="ml-28 text-xs text-red-600">
      {lineErr.totalWeightUnit.message}
    </p>
  ) : null}
</div>
    </div>
  );
}
