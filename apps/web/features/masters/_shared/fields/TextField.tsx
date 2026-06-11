"use client";

import { FieldValues, Path, useFormContext } from "react-hook-form";
import { Input } from "@skerp/ui/components/input";

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export default function TextField<TFormValues extends FieldValues>({
  name,
  label,
  placeholder,
  required,
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
      <Input
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        {...register(name)}
      />
      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
