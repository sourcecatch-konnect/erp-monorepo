"use client";

import * as React from "react";
import { ChevronsUpDownIcon, CheckIcon } from "lucide-react";

import { cn } from "../lib/util";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popver";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

export type ComboboxOption = {
  label: string;
  value: string;
  /** Optional secondary line rendered under the label. */
  hint?: string;
  /** Optional right-side badge rendered in the option list. */
  badge?: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Render as invalid (red ring) — wire to a form error. */
  invalid?: boolean;
  className?: string;
  id?: string;
};

/**
 * Searchable single-select. Built on the Command (cmdk) + Popover primitives,
 * so arrow-key navigation and Enter-to-select work out of the box. Prefer this
 * over a plain Select for any list that benefits from type-ahead.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found",
  disabled,
  invalid,
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            // Auto height so a long selected label wraps instead of clipping.
            "h-auto min-h-10 w-full justify-between rounded-lg font-normal",
            !selected && "text-muted-foreground",
            invalid && "ring-1 ring-destructive",
            className
          )}
        >
          <span className="whitespace-normal break-words text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            // itemValue is the option label (set via CommandItem value).
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  data-checked={option.value === value}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      {/* Wrap, don't truncate — long names (e.g. trip names) must stay readable. */}
                      <span className="whitespace-normal break-words">{option.label}</span>
                      {option.hint ? (
                        <span className="whitespace-normal break-words text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                    {option.badge ? (
                      <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                        {option.badge}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
