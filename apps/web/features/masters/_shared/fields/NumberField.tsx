"use client";

import {
  Controller,
  type FieldValues,
  type Path,
  type Control,
} from "react-hook-form";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";

type NumberFieldProps<T extends FieldValues> = {
  control: Control<T, unknown, FieldValues>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
};

export default function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  min,
  max,
  step = 1,
}: NumberFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const inputId = String(name);

        return (
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>
              {label}
              {required ? <span className="text-red-500">*</span> : null}
            </Label>

            <Input
              id={inputId}
              type="number"
              inputMode="decimal"
              min={min}
              max={max}
              step={step}
              placeholder={placeholder}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              aria-invalid={!!fieldState.error}
            />

            {fieldState.error?.message ? (
              <p className="text-xs text-red-500">
                {fieldState.error.message}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}