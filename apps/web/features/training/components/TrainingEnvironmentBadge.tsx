"use client";

import { IconSchool } from "@tabler/icons-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { IS_TRAINING_ENVIRONMENT } from "../environment";

/**
 * A9 — always-visible marker in the top bar of the training copy, so nobody
 * mistakes practice for the real system. Renders nothing elsewhere.
 */
export function TrainingEnvironmentBadge() {
  if (!IS_TRAINING_ENVIRONMENT) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary/15"
        >
          <IconSchool className="size-4" aria-hidden />
          <span className="hidden sm:inline">Training environment</span>
          <span className="sm:hidden">Training</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-1.5 text-sm">
        <p className="font-semibold text-foreground">
          This is the training copy of the ERP
        </p>
        <p className="text-muted-foreground">
          Practise freely: everything here is made up and is reset every night.
          Emails, WhatsApp, the e-way bill portal and GPS tracking are switched
          off, so nothing reaches a real customer or driver.
        </p>
      </PopoverContent>
    </Popover>
  );
}
