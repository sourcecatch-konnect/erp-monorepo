"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { GLOSSARY } from "../content/glossary";

const GLOSSARY_BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

/**
 * An ERP word with its meaning one click away. Click (not hover) so it works
 * on touch screens too.
 *
 *   <Term id="tbb">TBB</Term>
 */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = GLOSSARY_BY_ID.get(id);
  if (!entry) return <>{children}</>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-help underline decoration-muted-foreground decoration-dotted underline-offset-4 transition-colors duration-150 hover:decoration-primary"
        >
          {children ?? entry.term}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-1.5 text-sm">
        <p className="font-semibold text-foreground">
          {entry.term}
          {entry.fullName ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {entry.fullName}
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground">{entry.meaning}</p>
        <Link
          href={`/training/glossary#term-${entry.id}`}
          className="inline-block text-xs font-medium text-primary hover:underline"
        >
          Open the glossary
        </Link>
      </PopoverContent>
    </Popover>
  );
}
