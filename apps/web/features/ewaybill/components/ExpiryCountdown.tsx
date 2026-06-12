"use client";

import * as React from "react";
import { cn } from "@skerp/ui/lib/util";
import { IconClockHour4, IconAlertTriangleFilled } from "@tabler/icons-react";

type Variant = "default" | "compact" | "hero";

const useNow = (intervalMs = 1000) => {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

const fmt = (ms: number) => {
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

/**
 * Live ticking countdown — colour escalates as expiry approaches.
 * Reads validUntil as ISO and updates every second.
 */
export function ExpiryCountdown({
  validUntil,
  variant = "default",
  className,
}: {
  validUntil: string;
  variant?: Variant;
  className?: string;
}) {
  const now = useNow(1000);
  const expiry = new Date(validUntil).getTime();
  const diff = expiry - now;
  const expired = diff <= 0;

  const tone = expired
    ? "text-destructive"
    : diff < 60 * 60 * 1000
    ? "text-destructive"
    : diff < 4 * 60 * 60 * 1000
    ? "text-amber-700 dark:text-amber-400"
    : "text-muted-foreground";

  if (variant === "compact") {
    return (
      <span className={cn("font-mono text-xs tabular-nums", tone, className)}>
        {expired ? "Expired" : fmt(diff)}
      </span>
    );
  }

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 border bg-card px-4 py-3",
          expired
            ? "border-destructive/30 bg-destructive/5"
            : diff < 4 * 60 * 60 * 1000
            ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5"
            : "border-border",
          className
        )}
      >
        {expired || diff < 4 * 60 * 60 * 1000 ? (
          <IconAlertTriangleFilled className={cn("size-5", tone)} />
        ) : (
          <IconClockHour4 className="size-5 text-muted-foreground" />
        )}
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase text-muted-foreground">
            {expired ? "Expired" : "Valid for"}
          </span>
          <span
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              tone
            )}
          >
            {fmt(diff)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs tabular-nums",
        tone,
        className
      )}
    >
      <IconClockHour4 className="size-3" />
      {expired ? "Expired" : fmt(diff)}
    </span>
  );
}
