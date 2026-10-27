"use client";

import { Controller, useFormContext } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@skerp/ui/components/radioButton";
import { cn } from "@skerp/ui/lib/util";
import type { FeedbackFormValues } from "../form-values";

export type ChoiceOption = { value: string; label: string; hint?: string };

type Props = {
  name: keyof FeedbackFormValues;
  label: string;
  options: ChoiceOption[];
  required?: boolean;
  columns?: 1 | 2;
};

/**
 * Every option visible as a full-width row with plain-language text — easier
 * to read and tap than a dropdown. Not in the shared field library, hence the
 * local Controller.
 */
export function ChoiceField({
  name,
  label,
  options,
  required,
  columns = 1,
}: Props) {
  const {
    control,
    formState: { errors },
  } = useFormContext<FeedbackFormValues>();
  const error = errors[name]?.message;

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
            value={field.value}
            onValueChange={field.onChange}
            aria-invalid={Boolean(error)}
            className={cn(columns === 2 && "grid-cols-1 sm:grid-cols-2")}
          >
            {options.map((option) => {
              const id = `feedback-${name}-${option.value}`;
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
