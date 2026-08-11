"use client";

import * as React from "react";
import { FieldValues, Path, PathValue, useFormContext } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Input } from "@skerp/ui/components/input";

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
  suffix?: React.ReactNode;
  icon?: React.ReactNode;
  labelAction?: React.ReactNode;
};

export default function SelectField<TFormValues extends FieldValues>({
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  suffix,
  icon,
  labelAction,
}: Props<TFormValues>) {
  const [search, setSearch] = React.useState("");

  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<TFormValues>();

  const value = watch(name);
  const error = errors[name]?.message;

  const filteredOptions = React.useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [options, search]);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
        {labelAction}
      </div>

      <Select
        value={typeof value === "string" ? value : ""}
        onOpenChange={(open) => {
          if (!open) setSearch("");
        }}
        onValueChange={(nextValue) =>
          setValue(
            name,
            nextValue as PathValue<TFormValues, Path<TFormValues>>,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          )
        }
        disabled={disabled}
      >
        <SelectTrigger
          aria-invalid={Boolean(error)}
          className="h-10 w-full rounded-lg"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icon ? (
              <span className="shrink-0 text-muted-foreground">{icon}</span>
            ) : null}

            <span className="min-w-0 flex-1 truncate text-left">
              <SelectValue placeholder={placeholder ?? `Select ${label}`} />
            </span>

            {suffix ? (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {suffix}
              </span>
            ) : null}
          </div>
        </SelectTrigger>

        <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[280px] max-h-[320px] p-2">
          <div className="sticky top-0 z-10 bg-popover pb-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-9 text-sm"
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>

          <div className="max-h-[240px] overflow-y-auto pr-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="cursor-pointer rounded-md"
                >
                  {option.label}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        </SelectContent>
      </Select>

      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
