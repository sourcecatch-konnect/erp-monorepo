"use client";

import * as React from "react";
import { FieldValues, Path, useFormContext } from "react-hook-form";
import { Input } from "@skerp/ui/components/input";

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  prefix?: string;
  type?: string;
  maxLength?: number;
  hint?: string;
  onChangeTransform?: (value: string) => string;
  min?: number;
max?: number;
step?: number | string;
};

export default function IconTextField<TFormValues extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  icon,
  prefix,
  type = "text",
  maxLength,
  hint,
  min,
max,
step,
  onChangeTransform
}: Props<TFormValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFormValues>();
  const error = errors[name]?.message;

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>

      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
            {icon}
          </span>
        ) : null}

        {prefix ? (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {prefix}
          </span>
        ) : null}

      <Input
  type={type}
  placeholder={placeholder}
  aria-invalid={Boolean(error)}
  maxLength={maxLength}
  min={min}
max={max}
step={step}
  className={[
    icon ? "pl-9" : prefix ? "pl-12" : "",
    onChangeTransform ? "uppercase" : "",
  ].join(" ")}
  {...register(name, {
    onChange: (event) => {
      if (!onChangeTransform) return;

      event.target.value = onChangeTransform(event.target.value);
    },
  })}
/>
      </div>

      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
