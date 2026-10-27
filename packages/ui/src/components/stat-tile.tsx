import * as React from "react";
import { cn } from "../lib/util";

/**
 * One figure, as a tile: an icon chip, what it counts, the count, and a line
 * of context. A row of these answers "where am I?" before the reader has to
 * take in a single card.
 *
 * `tone` picks one of the six learning accents defined in the app's
 * globals.css (`--learn-1` … `--learn-6`); omit it for a quiet neutral tile,
 * or pass a semantic tone for success / warning states.
 */
export type StatTone =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | "muted"
  | "primary"
  | "success"
  | "warning"
  | "destructive";

const SURFACE: Record<StatTone, string> = {
  1: "bg-learn-1-soft",
  2: "bg-learn-2-soft",
  3: "bg-learn-3-soft",
  4: "bg-learn-4-soft",
  5: "bg-learn-5-soft",
  6: "bg-learn-6-soft",
  muted: "bg-card",
  primary: "bg-primary/5",
  success: "bg-success/8",
  warning: "bg-warning/8",
  destructive: "bg-destructive/8",
};

const BADGE: Record<StatTone, string> = {
  1: "bg-learn-1 text-primary-foreground",
  2: "bg-learn-2 text-primary-foreground",
  3: "bg-learn-3 text-primary-foreground",
  4: "bg-learn-4 text-primary-foreground",
  5: "bg-learn-5 text-primary-foreground",
  6: "bg-learn-6 text-primary-foreground",
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-white",
};

export type StatTileProps = {
  /** Any icon component that takes a className — Tabler, Lucide, your own. */
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  /** Shown at the right, for a delta or a status chip. */
  trailing?: React.ReactNode;
  className?: string;
};

export function StatTile({
  icon: TileIcon,
  label,
  value,
  hint,
  tone = "muted",
  trailing,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        SURFACE[tone],
        className,
      )}
    >
      {TileIcon ? (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            BADGE[tone],
          )}
        >
          <TileIcon className="size-[18px]" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="block text-lg font-semibold leading-tight tabular-nums text-foreground">
          {value}
        </span>
        {hint ? (
          <span className="block truncate text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );
}

/**
 * The same tile as a link. Kept separate so the plain tile stays a `div` and
 * never nests interactive elements by accident.
 */
export function StatTileShell({
  tone = "muted",
  className,
  children,
}: {
  tone?: StatTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors duration-150 hover:border-primary/40",
        SURFACE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export const statToneBadge = (tone: StatTone) => BADGE[tone];
export const statToneSurface = (tone: StatTone) => SURFACE[tone];
