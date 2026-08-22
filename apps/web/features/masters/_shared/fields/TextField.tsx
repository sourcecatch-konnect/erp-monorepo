
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
  // Fires on every keystroke with the raw input value, in addition to (not
  // instead of) react-hook-form's own state update — for callers that need
  // to react to typing directly (e.g. detecting when a manually-edited value
  // has drifted from a previously-linked external selection).
  onValueChange?: (value: string) => void;
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
  disabled,
  onValueChange,
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
        onChange={(event) => {
          // Keep react-hook-form's own state update working exactly as
          // before, then additionally notify the caller with the raw value.
          field.onChange(event);
          onValueChange?.(event.target.value);
        }}
        disabled={disabled}
      />

      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}