"use client";

import * as React from "react";

import { CompactMoney } from "./CompactMoney";

const toneText = {
  sky: "text-sky-600",
  emerald: "text-emerald-600",
  destructive: "text-destructive",
} as const;

type Props = {
  icon: React.ReactNode;
  label: string;
  /** amount in paise — rendered via CompactMoney (with exact-value tooltip) */
  value?: number;
  /** non-money content; overrides `value` when provided */
  display?: React.ReactNode;
  tone?: keyof typeof toneText;
  sub?: React.ReactNode;
};

/**
 * Notion-style overview stat card: icon chip + label, a large value (compact
 * money by default, or arbitrary `display`), and an optional sub-line.
 * Money values need a `TooltipProvider` ancestor (CompactMoney).
 */
export function StatCard({ icon, label, value, display, tone, sub }: Props) {
  const toneClass = tone ? toneText[tone] : "";
  return (
    <div className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      {display !== undefined ? (
        <p className={`mt-2.5 truncate text-xl font-semibold ${toneClass}`}>
          {display}
        </p>
      ) : (
        <CompactMoney
          className={`mt-2.5 block text-xl font-semibold ${toneClass}`}
          value={value ?? 0}
        />
      )}
      {sub ? <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
