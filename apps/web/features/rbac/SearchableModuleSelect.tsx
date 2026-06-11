"use client";

import { useState } from "react";
import { IconSelector } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";

import { Popover,  PopoverContent,
  PopoverTrigger, } from "@skerp/ui/components/popver";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@skerp/ui/components/command";

export default function SearchableModuleSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-lg px-3 text-xs font-normal"
        >
          <span className="truncate">
            {selected?.label ?? "Select module"}
          </span>
          < IconSelector  className="ml-2 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

<PopoverContent
  align="start"
  className="w-[var(--radix-popover-trigger-width)] p-0"
  onWheel={(event) => event.stopPropagation()}
>
  <Command className="max-h-[280px]">
    <CommandInput placeholder="Search module..." />

    <CommandList
      className="max-h-[220px] overflow-y-auto overscroll-contain pr-1"
      onWheel={(event) => event.stopPropagation()}
    >
      <CommandEmpty>No module found.</CommandEmpty>

      <CommandGroup>
        {options.map((option) => (
          <CommandItem
            key={option.value}
            value={`${option.label} ${option.value}`}
            onSelect={() => {
              onChange(option.value);
              setOpen(false);
            }}
            data-checked={value === option.value}
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium">
                {option.label}
              </span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {option.value}
              </span>
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </Command>
</PopoverContent>
    </Popover>
  );
}