"use client";

import { useFormContext } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import type { FeedbackFormValues } from "../form-values";

// Radix Select can't use "" as an item value; "" in the form means the whole screen.
const WHOLE_SCREEN = "__whole__";
const POINT_AT_IT = "__point__";

/**
 * "Page section (optional)": the whole screen, one of the headings found on
 * this page, or "Point at it on screen…" — which hides the panel and lets the
 * user click the part (the sheet then fills the section in).
 */
export function SectionField({
  sections,
  canPoint,
  onPoint,
}: {
  sections: string[];
  canPoint: boolean;
  onPoint: () => void;
}) {
  const { watch, setValue } = useFormContext<FeedbackFormValues>();
  const section = watch("section");
  // A section picked on screen may not be one of the headings.
  const options = section && !sections.includes(section) ? [section, ...sections] : sections;

  return (
    <div className="grid gap-1.5">
      <label htmlFor="feedback-section" className="text-xs font-medium text-muted-foreground">
        Page section (optional)
      </label>
      <Select
        value={section || WHOLE_SCREEN}
        onValueChange={(value) => {
          if (value === POINT_AT_IT) {
            onPoint();
            return;
          }
          setValue("section", value === WHOLE_SCREEN ? "" : value, { shouldDirty: true });
        }}
      >
        <SelectTrigger id="feedback-section" className="h-10 w-full max-sm:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={WHOLE_SCREEN}>Whole screen</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          {canPoint ? (
            <>
              <SelectSeparator />
              <SelectItem value={POINT_AT_IT}>Point at it on screen…</SelectItem>
            </>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
