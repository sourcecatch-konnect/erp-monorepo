"use client";

import { FieldValues, Path, PathValue, useFormContext } from "react-hook-form";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label: string;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onScrollEnd?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onValueChange?: (value: string) => void;
  /** Optional inline action rendered next to the label, e.g. "+ New trip". */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Form-aware searchable select. Reads/writes through useFormContext and shows
 * inline validation errors. Prefer this over SelectField for long lists.
 */
export default function ComboboxField<TFormValues extends FieldValues>({
  name,
  label,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  required,
  disabled,
  searchValue,
  onSearchChange,
  onScrollEnd,
  hasMore,
  isLoadingMore,
  onValueChange,
  actionLabel,
  onAction,
}: Props<TFormValues>) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TFormValues>();

  const value = watch(name);
  const error = errors[name]?.message;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-medium text-primary hover:underline"
          >
            {actionLabel ?? "+ Add new"}
          </button>
        ) : null}
      </div>
      <Combobox
        options={options}
        value={typeof value === "string" ? value : undefined}
        onChange={(next) => {
          setValue(name, next as PathValue<TFormValues, Path<TFormValues>>, {
            shouldDirty: true,
            shouldValidate: true,
          });
          onValueChange?.(next);
        }}
        placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        disabled={disabled}
        invalid={Boolean(error)}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onScrollEnd={onScrollEnd}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
      />
      {typeof error === "string" ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
