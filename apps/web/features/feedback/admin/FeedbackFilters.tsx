"use client";

import { IconSearch, IconX } from "@tabler/icons-react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_SEVERITIES,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
} from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import type { FeedbackListParams } from "../feedback.service";

export type FeedbackFilterValues = Omit<FeedbackListParams, "page" | "size">;

// Radix Select can't use "" as an item value.
const ALL = "__all__";

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? undefined : next)}
      >
        <SelectTrigger id={id} className="h-10 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FeedbackFilters({
  filters,
  searchText,
  modules,
  onSearchText,
  onChange,
  onClear,
}: {
  filters: FeedbackFilterValues;
  searchText: string;
  modules: string[];
  onSearchText: (text: string) => void;
  onChange: (patch: Partial<FeedbackFilterValues>) => void;
  onClear: () => void;
}) {
  const hasFilters =
    searchText !== "" ||
    Object.values(filters).some((value) => value !== undefined && value !== "");

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-64 flex-1 gap-1.5">
          <label htmlFor="feedback-search" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="feedback-search"
              className="h-10 pl-9"
              placeholder="Title, page, person or FB number"
              value={searchText}
              onChange={(event) => onSearchText(event.target.value)}
            />
          </div>
        </div>
        <FilterSelect
          id="feedback-status"
          label="Status"
          value={filters.status}
          options={[
            { value: "OPEN", label: "Open (not finished)" },
            ...FEEDBACK_STATUSES.map((value) => ({
              value,
              label: FEEDBACK_STATUS_LABELS[value],
            })),
          ]}
          onChange={(value) =>
            onChange({ status: value as FeedbackFilterValues["status"] })
          }
        />
        <FilterSelect
          id="feedback-category"
          label="Type"
          value={filters.category}
          options={FEEDBACK_CATEGORIES.map((value) => ({
            value,
            label: FEEDBACK_CATEGORY_LABELS[value],
          }))}
          onChange={(value) =>
            onChange({ category: value as FeedbackFilterValues["category"] })
          }
        />
        <FilterSelect
          id="feedback-severity"
          label="Severity"
          value={filters.severity}
          options={FEEDBACK_SEVERITIES.map((value) => ({
            value,
            label: FEEDBACK_SEVERITY_LABELS[value],
          }))}
          onChange={(value) =>
            onChange({ severity: value as FeedbackFilterValues["severity"] })
          }
        />
        <FilterSelect
          id="feedback-module"
          label="Module"
          value={filters.module}
          options={modules.map((value) => ({ value, label: value }))}
          onChange={(value) => onChange({ module: value, pageTitle: undefined })}
        />
        {hasFilters ? (
          <Button variant="ghost" className="h-10" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {filters.pageTitle ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Showing page:</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-foreground">
            {filters.pageTitle}
            <button
              type="button"
              onClick={() => onChange({ pageTitle: undefined })}
              className="rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              aria-label="Stop filtering by this page"
            >
              <IconX className="size-3.5" />
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
