"use client";

import { useFormContext, type FieldValues, type Path, type PathValue } from "react-hook-form";
import type { Icon } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { cn } from "@skerp/ui/lib/util";

export type FeedbackSelectOption = {
  value: string;
  label: string;
  /** Plain-language line shown under the label while the list is open. */
  hint?: string;
  icon?: Icon;
  /** Colours the leading dot, for scales like impact. */
  tone?: "muted" | "primary" | "warning" | "destructive";
};

const TONE_DOT: Record<NonNullable<FeedbackSelectOption["tone"]>, string> = {
  muted: "bg-muted-foreground/50",
  primary: "bg-primary",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

/**
 * A short dropdown for the feedback form.
 *
 * The shared `SelectField` puts a search box inside the list, which is right
 * for a master with hundreds of rows and noise for a handful of fixed choices.
 *
 * The closed trigger shows the label alone. The hint is what the list is for:
 * repeating it on the trigger after the choice is made turns a one-line
 * control into a three-line block and makes the form look unfinished.
 */
export function FeedbackSelect<TFormValues extends FieldValues>({
  name,
  label,
  options,
  placeholder,
  required,
}: {
  name: Path<TFormValues>;
  label: string;
  options: readonly FeedbackSelectOption[];
  placeholder?: string;
  required?: boolean;
}) {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<TFormValues>();

  const value = watch(name);
  const current = typeof value === "string" ? value : "";
  const selected = options.find((option) => option.value === current);
  const error = errors[name]?.message;
  const SelectedIcon = selected?.icon;

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>

      <Select
        value={current}
        onValueChange={(next) =>
          setValue(name, next as PathValue<TFormValues, Path<TFormValues>>, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      >
        <SelectTrigger
          aria-invalid={Boolean(error)}
          className="h-11 w-full rounded-lg"
        >
          {/*
           * Children override what Radix would mirror from the chosen item, so
           * the trigger stays one line even though the list rows are two.
           */}
          <SelectValue placeholder={placeholder ?? "Choose one"}>
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                {SelectedIcon ? (
                  <SelectedIcon className="size-4 shrink-0 text-primary" aria-hidden />
                ) : selected.tone ? (
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", TONE_DOT[selected.tone])}
                  />
                ) : null}
                <span className="truncate text-sm text-foreground">{selected.label}</span>
              </span>
            ) : null}
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[280px]">
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <SelectItem
                key={option.value}
                value={option.value}
                textValue={option.label}
                className="cursor-pointer rounded-md py-2"
              >
                <span className="flex min-w-0 items-start gap-2.5">
                  {OptionIcon ? (
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <OptionIcon className="size-3.5" aria-hidden />
                    </span>
                  ) : option.tone ? (
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        TONE_DOT[option.tone],
                      )}
                    />
                  ) : null}
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm text-foreground">{option.label}</span>
                    {option.hint ? (
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    ) : null}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {typeof error === "string" ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
