"use client";

import * as React from "react";
import {
  Controller,
  FieldValues,
  Path,
  useFormContext,
} from "react-hook-form";
import { Switch } from "@skerp/ui/components/switch";

type Props<TFormValues extends FieldValues> = {
  name: Path<TFormValues>;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: "default" | "warning" | "danger";
};

const toneClasses = {
  default: "border-input",
  warning: "border-amber-200 bg-amber-50/50",
  danger: "border-red-200 bg-red-50/50",
};

export default function SwitchField<TFormValues extends FieldValues>({
  name,
  label,
  description,
  icon,
  tone = "default",
}: Props<TFormValues>) {
  const { control } = useFormContext<TFormValues>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${toneClasses[tone]}`}
        >
          <div className="flex items-center gap-2">
            {icon ? (
              <span className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground">
                {icon}
              </span>
            ) : null}
            <div>
              <div className="text-sm font-medium text-foreground">{label}</div>
              {description ? (
                <div className="text-xs text-muted-foreground">
                  {description}
                </div>
              ) : null}
            </div>
          </div>

          <Switch
            checked={Boolean(field.value)}
            onCheckedChange={(value) => field.onChange(value)}
          />
        </label>
      )}
    />
  );
}
