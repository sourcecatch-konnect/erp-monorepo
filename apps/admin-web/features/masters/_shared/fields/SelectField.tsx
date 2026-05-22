"use client";

import { FieldValues, Path, PathValue, useFormContext } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

type Option = {
  label: string;
  value: string;
};

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label: string;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export default function SelectField<TFormValues extends FieldValues>({
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
}: Props<TFormValues>) {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<TFormValues>();
  const value = watch(name);
  const error = errors[name]?.message;

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(nextValue) =>
          setValue(name, nextValue as PathValue<TFormValues, Path<TFormValues>>, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        disabled={disabled}
      >
        <SelectTrigger aria-invalid={Boolean(error)}>
          <SelectValue placeholder={placeholder ?? `Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
