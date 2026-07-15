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
  suffix?: string;
  type?: string;
  maxLength?: number;
  hint?: string;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
   valueAsNumber?: boolean;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;

  transformValue?: (value: string) => string;
  onChangeTransform?: (value: string) => string;
  /** Runs after react-hook-form's own blur handling — e.g. cross-field checks. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

export default function IconTextField<TFormValues extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  icon,
  prefix,
  suffix,
  type = "text",
  maxLength,
  hint,
  min,
  max,
  step,
  disabled,
  inputMode,
  pattern,
  transformValue,
  onChangeTransform,
  onBlur,
valueAsNumber,
}: Props<TFormValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFormValues>();

  const error = errors[name]?.message;
  const transformer = transformValue ?? onChangeTransform;

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

        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {suffix}
          </span>
        ) : null}

        <Input
          type={type}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
          inputMode={inputMode}
          pattern={pattern}
          className={[
            icon ? "pl-9" : prefix ? "pl-12" : "",
            suffix ? "pr-12" : "",
            transformer ? "uppercase" : "",
          ].join(" ")}
          {...register(name, {
  valueAsNumber,
  onChange: (event) => {
    if (!transformer) return;

    event.target.value = transformer(event.target.value);
  },
  onBlur,
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