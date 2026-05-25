"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";

type UppercaseTextFieldProps<T extends FieldValues> = {
  control: Control<T, unknown, any>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
};

export default function UppercaseTextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  maxLength,
}: UppercaseTextFieldProps<T>) {
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
              name={field.name}
              ref={field.ref}
              value={field.value ?? ""}
              placeholder={placeholder}
              maxLength={maxLength}
              aria-invalid={!!fieldState.error}
              onBlur={field.onBlur}
              onChange={(e) => {
                field.onChange(e.target.value.toUpperCase().replace(/\s+/g, ""));
              }}
            />

            {fieldState.error?.message ? (
              <p className="text-xs text-red-500">{fieldState.error.message}</p>
            ) : null}
          </div>
        );
      }}
    />
  );
}