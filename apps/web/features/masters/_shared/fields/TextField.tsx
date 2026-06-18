"use client";

import * as React from "react";
import { FieldValues, Path, useFormContext } from "react-hook-form";
import { Input } from "@skerp/ui/components/input";

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label: string;
  placeholder?: string;
  required?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  disabled?: boolean;
};

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  (ref as React.MutableRefObject<T | null>).current = value;
}

export default function TextField<TFormValues extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  inputRef,
  disabled
}: Props<TFormValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFormValues>();

  const field = register(name);
  const error = errors[name]?.message;

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>

      <Input
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        {...field}
        ref={(element) => {
          field.ref(element);
          assignRef(inputRef, element);
        }}
        disabled={disabled}
      />

      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}