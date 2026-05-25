"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";

type VehicleNumberFieldProps<T extends FieldValues> = {
  control: Control<T, unknown, any>;
  name: Path<T>;
  label?: string;
  required?: boolean;
};

export default function VehicleNumberField<T extends FieldValues>({
  control,
  name,
  label = "Vehicle Number",
  required,
}: VehicleNumberFieldProps<T>) {
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
              placeholder="MH31AB1234"
              maxLength={15}
              autoCapitalize="characters"
              aria-invalid={!!fieldState.error}
              onBlur={field.onBlur}
              onChange={(e) => {
                const value = e.target.value
                  .toUpperCase()
                  .replace(/\s+/g, "")
                  .replace(/[^A-Z0-9]/g, "");

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