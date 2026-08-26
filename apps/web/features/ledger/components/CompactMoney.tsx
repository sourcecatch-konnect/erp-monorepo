"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@skerp/ui/components/tooltip";
import { formatPaise, formatPaiseCompact } from "@/lib/money";

type Props = {
  /** amount in paise */
  value: number;
  /** optional leading text, e.g. "+" */
  prefix?: string;
  className?: string;
};

/**
 * Renders an amount in compact Indian units (₹27K / ₹1.48L / ₹2.77Cr) and
 * shows the exact, fully-formatted value in a tooltip on hover. Requires a
 * `TooltipProvider` ancestor. Local copy of
 * `features/cash-planning/components/CompactMoney.tsx` — kept feature-local
 * rather than cross-imported, per the "no cross-master imports" rule.
 */
export function CompactMoney({ value, prefix, className }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          {prefix}
          {formatPaiseCompact(value)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{formatPaise(value)}</TooltipContent>
    </Tooltip>
  );
}
