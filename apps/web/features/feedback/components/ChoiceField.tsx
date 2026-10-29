"use client";

import { Controller, useFormContext } from "react-hook-form";
import type { Icon } from "@tabler/icons-react";
import { RadioGroup, RadioGroupItem } from "@skerp/ui/components/radioButton";
import { cn } from "@skerp/ui/lib/util";
import type { FeedbackFormValues } from "../form-values";

export type ChoiceOption = {
  value: string;
  label: string;
  hint?: string;
  icon?: Icon;
};

type Props = {
  name: keyof FeedbackFormValues;
  label: string;
  options: ChoiceOption[];
  required?: boolean;
  columns?: 1 | 2;
  /**
   * A short ordered scale (Low → Critical) reads better as one row of equal
   * buttons than as four stacked cards: the order is the point, and the four
   * hints together take more room than the question deserves. The hint for
   * the chosen option is shown underneath instead.
   */
  compact?: boolean;
};

/**
 * Every option visible as a row you tap, with plain-language text under the
 * name — easier to read and far easier to tap than a dropdown, which hides
 * the choices and the hints behind an extra click. Not in the shared field
 * library, hence the local Controller.
 */
export function ChoiceField({
  name,
  label,
  options,
  required,
  columns = 1,
  compact = false,
}: Props) {
  const {
    control,
    formState: { errors },
  } = useFormContext<FeedbackFormValues>();
  const error = errors[name]?.message;

  if (compact) {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </legend>
        <Controller
          control={control}
          name={name}
          render={({ field }) => {
            const chosen = options.find(
              (option) => option.value === field.value,
            );
            return (
              <>
                <RadioGroup
                  value={typeof field.value === "string" ? field.value : ""}
                  onValueChange={field.onChange}
                  aria-invalid={Boolean(error)}
                  className="grid auto-cols-fr grid-flow-col gap-1.5"
                >
                  {options.map((option) => {
                    const id = `feedback-${name}-${option.value}`;
                    return (
                      <label
                        key={option.value}
                        htmlFor={id}
                        className="flex h-11 cursor-pointer items-center justify-center rounded-md border border-border bg-card px-2 text-center text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:text-primary"
                      >
                        <RadioGroupItem id={id} value={option.value} className="sr-only" />
                        <span className="truncate">{option.label}</span>
                      </label>
                    );
                  })}
                </RadioGroup>
                {chosen?.hint ? (
                  <p className="text-xs text-muted-foreground">{chosen.hint}</p>
                ) : null}
              </>
            );
          }}
        />
        {typeof error === "string" ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </fieldset>
    );
  }

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </legend>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <RadioGroup
            value={typeof field.value === "string" ? field.value : ""}
            onValueChange={field.onChange}
            aria-invalid={Boolean(error)}
            className={cn(columns === 2 && "grid-cols-1 sm:grid-cols-2")}
          >
            {options.map((option) => {
              const id = `feedback-${name}-${option.value}`;
              const OptionIcon = option.icon;
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors duration-150 hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  {/* Radix sets data-state="checked"; the shared item's
                      `data-checked:` fill never matches, leaving a white dot on white. */}
                  <RadioGroupItem
                    id={id}
                    value={option.value}
                    className="mt-0.5 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  />
                  {OptionIcon ? (
                    <OptionIcon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    {option.hint ? (
                      <span className="text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        )}
      />
      {typeof error === "string" ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </fieldset>
  );
}
