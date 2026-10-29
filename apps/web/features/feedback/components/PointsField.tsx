"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { IconPlus, IconX } from "@tabler/icons-react";
import { FEEDBACK_MAX_POINTS, FEEDBACK_MAX_POINT_CHARS } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import type { FeedbackFormValues } from "../form-values";

const newId = () => crypto.randomUUID();

/**
 * Short points, one per row. `points` is a plain string[] (shared schema), so
 * rows are controlled with setValue instead of useFieldArray (which needs
 * objects). A local id per row keeps focus right when a middle row is removed.
 * Enter adds a row below; Backspace in an empty row removes it.
 */
export function PointsField() {
  const {
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useFormContext<FeedbackFormValues>();
  const points = watch("points");
  const [ids, setIds] = useState<string[]>(() => points.map(newId));
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const focusId = useRef<string | null>(null);

  // "Send another" or a restored draft changes the rows from outside.
  if (ids.length !== points.length) setIds(points.map(newId));

  useEffect(() => {
    if (!focusId.current) return;
    inputs.current.get(focusId.current)?.focus();
    focusId.current = null;
  });

  const update = (nextPoints: string[], nextIds: string[]) => {
    setIds(nextIds);
    setValue("points", nextPoints, { shouldDirty: true, shouldValidate: isSubmitted });
  };

  const insertAfter = (index: number) => {
    if (points.length >= FEEDBACK_MAX_POINTS) return;
    const id = newId();
    update(
      [...points.slice(0, index + 1), "", ...points.slice(index + 1)],
      [...ids.slice(0, index + 1), id, ...ids.slice(index + 1)],
    );
    focusId.current = id;
  };

  const removeAt = (index: number) => {
    if (points.length === 1) {
      update([""], ids);
      return;
    }
    const nextIds = ids.filter((_, i) => i !== index);
    update(
      points.filter((_, i) => i !== index),
      nextIds,
    );
    focusId.current = nextIds[Math.max(0, index - 1)] ?? null;
  };

  const listError = errors.points?.message ?? errors.points?.root?.message;

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Points (optional)</span>
      <ol className="grid gap-2">
        {points.map((point, index) => {
          const id = ids[index] ?? String(index);
          const error = errors.points?.[index]?.message;
          return (
            <li key={id} className="grid gap-1">
              <div className="flex items-center gap-2">
                <Input
                  ref={(element) => {
                    if (element) inputs.current.set(id, element);
                    else inputs.current.delete(id);
                  }}
                  value={point}
                  maxLength={FEEDBACK_MAX_POINT_CHARS}
                  placeholder={`Point ${index + 1}`}
                  aria-label={`Point ${index + 1}`}
                  aria-invalid={Boolean(error)}
                  className="h-10 max-sm:h-11"
                  onChange={(event) =>
                    setValue(`points.${index}`, event.target.value, {
                      shouldDirty: true,
                      shouldValidate: isSubmitted,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      insertAfter(index);
                    } else if (event.key === "Backspace" && point === "" && points.length > 1) {
                      event.preventDefault();
                      removeAt(index);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="shrink-0 max-sm:size-11"
                  disabled={points.length === 1 && point === ""}
                  onClick={() => removeAt(index)}
                  aria-label={`Remove point ${index + 1}`}
                >
                  <IconX className="size-4" aria-hidden />
                </Button>
              </div>
              {typeof error === "string" ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="w-fit max-sm:h-11"
        disabled={points.length >= FEEDBACK_MAX_POINTS}
        onClick={() => insertAfter(points.length - 1)}
      >
        <IconPlus className="size-4" aria-hidden />
        Add point
      </Button>
      {points.length >= FEEDBACK_MAX_POINTS ? (
        <p className="text-xs text-muted-foreground">
          That&apos;s the most points one item can have ({FEEDBACK_MAX_POINTS}).
        </p>
      ) : null}
      {typeof listError === "string" ? (
        <p className="text-xs text-destructive">{listError}</p>
      ) : null}
    </div>
  );
}
