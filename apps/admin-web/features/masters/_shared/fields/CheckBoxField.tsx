"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Label } from "@skerp/ui/components/lable";

type CheckboxFieldProps<T extends FieldValues> = {
  control?: Control<T, unknown, any>;
  name: Path<T>;
  label: string;
  disabled?: boolean;
};

export default function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
}: CheckboxFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const inputId = String(name);

        return (
          <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
            <Checkbox
              id={inputId}
              checked={Boolean(field.value)}
              disabled={disabled}
              onCheckedChange={(value) => field.onChange(Boolean(value))}
            />

            <Label htmlFor={inputId} className="cursor-pointer">
              {label}
            </Label>
          </div>
        );
      }}
    />
  );
}