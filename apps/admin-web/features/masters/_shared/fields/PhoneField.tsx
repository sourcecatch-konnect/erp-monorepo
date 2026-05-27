"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";

type PhoneFieldProps<T extends FieldValues> = {
  control: Control<T, unknown, any>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export default function PhoneField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "+91 9876543210",
  required,
}: PhoneFieldProps<T>) {
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
              inputMode="tel"
              maxLength={14}
              aria-invalid={!!fieldState.error}
              onBlur={field.onBlur}
              onChange={(e) => {
                let value = e.target.value.replace(/[^\d+]/g, "");

                if (value.startsWith("91")) {
                  value = `+${value}`;
                }

                field.onChange(value);
              }}
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