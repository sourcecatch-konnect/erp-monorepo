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
  hint?: string;
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
  invalid?: boolean;
  className?: string;
  id?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onScrollEnd?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  disabled,
  invalid,
  className,
  id,
  searchValue,
  onSearchChange,
  onScrollEnd,
  hasMore,
  isLoadingMore,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

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
            "h-auto min-h-10 w-full justify-between rounded-lg font-normal",
            !selected && "text-muted-foreground",
            invalid && "ring-1 ring-destructive",
            className,
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
          shouldFilter={!onSearchChange}
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={onSearchChange}
          />
          <CommandList
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(event) => {
              event.stopPropagation();
            }}
            onScroll={(event) => {
              const element = event.currentTarget;
              const reachedBottom =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                24;

              if (reachedBottom && hasMore && !isLoadingMore) {
                onScrollEnd?.();
              }
            }}
          >
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
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="whitespace-normal break-words">
                        {option.label}
                      </span>
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

              {hasMore ? (
                <div className="px-2 py-2 text-center text-sm text-muted-foreground">
                  {isLoadingMore ? "Loading more..." : "Scroll to load more"}
                </div>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
