"use client";

import {
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/**
 * Clickable column header bound to a `field:direction` sort string.
 * First click sorts descending, clicking again flips the direction.
 */
export function SortHeader({
  label,
  field,
  sort,
  onSortChange,
}: {
  label: string;
  field: string;
  sort: string;
  onSortChange: (value: string) => void;
}) {
  const [activeField, direction] = sort.split(":");
  const active = activeField === field;
  const Icon = active
    ? direction === "asc"
      ? IconSortAscending
      : IconSortDescending
    : IconArrowsSort;
  return (
    <button
      type="button"
      onClick={() =>
        onSortChange(
          active
            ? `${field}:${direction === "desc" ? "asc" : "desc"}`
            : `${field}:desc`,
        )
      }
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 uppercase transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon size={13} className={active ? undefined : "opacity-50"} />
    </button>
  );
}
