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
import { IconTrash, IconPlus } from "@tabler/icons-react";

type FormValues = CreateOrderFormInput;

const UNIT_OPTIONS: ComboboxOption[] = [
  { label: "MT", value: "MT" },
  { label: "Kg", value: "Kg" },
  { label: "Nos", value: "Nos" },
  { label: "Boxes", value: "Boxes" },
  { label: "Bags", value: "Bags" },
  { label: "Pallets", value: "Pallets" },
];

export default function ItemLinesEditor({
  goodsOptions,
}: {
  goodsOptions: ComboboxOption[];
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormValues>();

  const { fields, append, remove } = useFieldArray<FormValues, "items">({
    control,
    name: "items",
  });

  const addRow = React.useCallback(
    () => append({ goodsId: "", quantity: 1, unit: "MT", weight: undefined }),
    [append]
  );

  React.useEffect(() => {
    if (fields.length === 0) addRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsError = errors.items?.message;

  return (
    <div className="col-span-full space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[220px] text-xs uppercase">Goods</TableHead>
              <TableHead className="w-28 text-xs uppercase">Qty</TableHead>
              <TableHead className="w-32 text-xs uppercase">Unit</TableHead>
              <TableHead className="w-32 text-xs uppercase">Weight</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const rowErr = errors.items?.[index];
              const isLast = index === fields.length - 1;
              return (
                <TableRow key={field.id} className="align-top">
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.goodsId`}
                      render={({ field: f }) => (
                        <Combobox
                          options={goodsOptions}
                          value={typeof f.value === "string" ? f.value : undefined}
                          onChange={f.onChange}
                          placeholder="Select goods"
                          invalid={Boolean(rowErr?.goodsId)}
                        />
                      )}
                    />
                    {rowErr?.goodsId?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {rowErr.goodsId.message}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <Input
                          type="number"
                          min={1}
                          value={(f.value as number | string) ?? ""}
                          onChange={(e) => f.onChange(e.target.value)}
                          aria-invalid={Boolean(rowErr?.quantity)}
                        />
                      )}
                    />
                    {rowErr?.quantity?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {rowErr.quantity.message}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.unit`}
                      render={({ field: f }) => (
                        <Combobox
                          options={UNIT_OPTIONS}
                          value={typeof f.value === "string" ? f.value : undefined}
                          onChange={f.onChange}
                          placeholder="Unit"
                          invalid={Boolean(rowErr?.unit)}
                        />
                      )}
                    />
                    {rowErr?.unit?.message ? (
                      <p className="mt-1 text-xs text-red-600">
                        {rowErr.unit.message}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Controller
                      control={control}
                      name={`items.${index}.weight`}
                      render={({ field: f }) => (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="optional"
                          value={(f.value as number | string) ?? ""}
                          onChange={(e) => f.onChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && isLast) {
                              e.preventDefault();
                              addRow();
                            }
                          }}
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
                      onClick={() => (fields.length > 1 ? remove(index) : null)}
                      disabled={fields.length === 1}
                      aria-label="Remove item"
                    >
                      <IconTrash size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        {typeof itemsError === "string" ? (
          <p className="text-xs text-red-600">{itemsError}</p>
        ) : (
          <span />
        )}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <IconPlus size={16} className="mr-1" /> Add item
        </Button>
      </div>
    </div>
  );
}
