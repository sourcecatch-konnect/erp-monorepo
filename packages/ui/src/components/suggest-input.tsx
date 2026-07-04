"use client";

import * as React from "react";
import { cn } from "../lib/util";
import { Input } from "./input";

export type SuggestOption = {
  value: string;
  /** Optional secondary text. */
  hint?: string;
  badge?: string;
  badgeTone?: "success" | "warning" | "danger" | "muted";
};
type SuggestInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Pool of suggestions, filtered live against what the user types. */
  suggestions: SuggestOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Render as invalid (red ring) — wire to a form error. */
  invalid?: boolean;
  className?: string;
  id?: string;
  /** Max suggestions visible at once. */
  maxItems?: number;
  onBlur?: () => void;
};

/**
 * Free-text input with live suggestions. Unlike Combobox, the typed text IS the
 * value — picking a suggestion just fills it in. Use for fields where the value
 * usually exists already (vehicle numbers, goods names) but new entries are
 * still allowed.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
  invalid,
  className,
  id,
  maxItems = 8,
  onBlur,
}: SuggestInputProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

const filtered = React.useMemo(() => {
  const q = value.trim().toLowerCase();

  const list = q
    ? suggestions.filter(
        (s) =>
          s.value.toLowerCase().includes(q) ||
          (s.hint ? s.hint.toLowerCase().includes(q) : false) ||
          (s.badge ? s.badge.toLowerCase().includes(q) : false),
      )
    : suggestions;

  return list.slice(0, maxItems);
}, [value, suggestions, maxItems]);

  // Hide the list when the only match is exactly what's already typed.
  const showList =
    open &&
    !disabled &&
    filtered.length > 0 &&
    !(
      filtered.length === 1 &&
      filtered[0]!.value.trim().toLowerCase() === value.trim().toLowerCase()
    );

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (showList && active >= 0 && filtered[active]) {
        e.preventDefault();
        select(filtered[active]!.value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };
const badgeToneClass: Record<
  NonNullable<SuggestOption["badgeTone"]>,
  string
> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  muted: "border-border bg-muted text-muted-foreground",
};
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
      />
      {showList ? (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {filtered.map((s, i) => (
     <li
  key={s.value}
  role="option"
  aria-selected={i === active}
  onMouseDown={(e) => {
    e.preventDefault();
    select(s.value);
  }}
  onMouseEnter={() => setActive(i)}
  className={cn(
    "flex cursor-pointer items-center justify-between gap-2 rounded-[5px] px-2 py-1.5 text-sm transition-colors",
    i === active && "bg-accent text-accent-foreground",
  )}
>
  <span className="min-w-0">
    <span className="block truncate font-medium">{s.value}</span>

    {s.hint ? (
      <span className="block truncate text-xs text-muted-foreground">
        {s.hint}
      </span>
    ) : null}
  </span>

  {s.badge ? (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        badgeToneClass[s.badgeTone ?? "muted"],
      )}
    >
      {s.badge}
    </span>
  ) : null}
</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
