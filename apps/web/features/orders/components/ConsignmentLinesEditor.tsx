"use client";

import * as React from "react";
import { useFieldArray, useFormContext, Controller } from "react-hook-form";
import type { CreateOrderFormInput } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { IconTrash, IconPlus, IconInfoCircle } from "@tabler/icons-react";

type FormValues = CreateOrderFormInput;

const UNIT_OPTIONS: ComboboxOption[] = [
  { label: "MT", value: "MT" },
  { label: "Kg", value: "Kg" },
  { label: "Nos", value: "Nos" },
  { label: "Boxes", value: "Boxes" },
  { label: "Bags", value: "Bags" },
  { label: "Pallets", value: "Pallets" },
];

/**
 * Consignment-lines editor for Truck (multi-loading) orders. One row = one LR.
 * Each row pins a truck #, its loading + unloading CustomerLocation, and a goods
 * line. Rows sharing a truck # become one LRGroup at LR generation; loading and
 * unloading points may repeat freely across rows (N loads -> 1 drop, etc.).
 *
 * Goods are stored as a one-element array per line so the shape matches the
 * shared schema (`consignments[].goods[]`); add another row for another invoice.
 */
export default function ConsignmentLinesEditor({
  goodsOptions,
  loadingOptions,
  unloadingOptions,
  consigneeChosen,
}: {
  goodsOptions: ComboboxOption[];
  loadingOptions: ComboboxOption[];
  unloadingOptions: ComboboxOption[];
  consigneeChosen: boolean;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormValues>();

  const { fields, append, remove } = useFieldArray<FormValues, "consignments">({
    control,
    name: "consignments",
  });

  const addRow = React.useCallback(
    () =>
      append({
        truckIndex: 1,
        loadingLocationId: undefined,
        unloadingLocationId: undefined,
        goods: [{ goodsId: "", quantity: 1, unit: "MT", weight: undefined }],
      }),
    [append],
  );

  return (
    <div className="col-span-full space-y-2">
      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
        <p>
          Optional — declare loading/unloading points for multi-pickup loads. Each
          row becomes its own LR (one invoice + e-way bill). Rows on the same truck
          number share one freight when finalised.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-20 text-xs uppercase">Truck #</TableHead>
              <TableHead className="min-w-[180px] text-xs uppercase">Loading point</TableHead>
              <TableHead className="min-w-[180px] text-xs uppercase">Unloading point</TableHead>
              <TableHead className="min-w-[180px] text-xs uppercase">Goods</TableHead>
              <TableHead className="w-24 text-xs uppercase">Qty</TableHead>
              <TableHead className="w-28 text-xs uppercase">Unit</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                  No consignment lines. Add one for a multi-loading-point order.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field, index) => {
                const rowErr = errors.consignments?.[index];
                const goodsErr = rowErr?.goods?.[0];
                return (
                  <TableRow key={field.id} className="align-top">
                    <TableCell>
                      <Controller
                        control={control}
                        name={`consignments.${index}.truckIndex`}
                        render={({ field: f }) => (
                          <Input
                            type="number"
                            min={1}
                            value={(f.value as number | string) ?? 1}
                            onChange={(e) => f.onChange(e.target.value)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`consignments.${index}.loadingLocationId`}
                        render={({ field: f }) => (
                          <Combobox
                            options={loadingOptions}
                            value={typeof f.value === "string" ? f.value : undefined}
                            onChange={f.onChange}
                            placeholder="Pickup location"
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`consignments.${index}.unloadingLocationId`}
                        render={({ field: f }) => (
                          <Combobox
                            options={unloadingOptions}
                            value={typeof f.value === "string" ? f.value : undefined}
                            onChange={f.onChange}
                            placeholder={consigneeChosen ? "Drop location" : "Pick consignee first"}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`consignments.${index}.goods.0.goodsId`}
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
                        <p className="mt-1 text-xs text-red-600">{goodsErr.goodsId.message}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`consignments.${index}.goods.0.quantity`}
                        render={({ field: f }) => (
                          <Input
                            type="number"
                            min={1}
                            value={(f.value as number | string) ?? ""}
                            onChange={(e) => f.onChange(e.target.value)}
                            aria-invalid={Boolean(goodsErr?.quantity)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`consignments.${index}.goods.0.unit`}
                        render={({ field: f }) => (
                          <Combobox
                            options={UNIT_OPTIONS}
                            value={typeof f.value === "string" ? f.value : undefined}
                            onChange={f.onChange}
                            placeholder="Unit"
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        onClick={() => remove(index)}
                        aria-label="Remove consignment line"
                      >
                        <IconTrash size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <IconPlus size={16} className="mr-1" /> Add consignment line
        </Button>
      </div>
    </div>
  );
}
