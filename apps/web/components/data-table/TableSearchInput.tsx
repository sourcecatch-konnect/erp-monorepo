"use client";

import * as React from "react";
import { Input } from "@skerp/ui/components/input";
import { IconPlus } from "@tabler/icons-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * Table toolbar search box. Hijacks Ctrl/Cmd+F to focus itself, with a
 * keyboard hint badge — use at most one per page.
 */
export function TableSearchInput({ value, onChange, placeholder }: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isFind =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";
      if (!isFind) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative w-full sm:max-w-sm">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-16"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
        <span>Ctrl</span>
        <IconPlus size={10} />
        <span>F</span>
      </kbd>
    </div>
  );
}
