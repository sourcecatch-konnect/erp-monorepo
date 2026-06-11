import { cn } from "@skerp/ui/lib/util";
import type { IconProps } from "@tabler/icons-react";
import type { ComponentType } from "react";

export function KpiTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  sub,
  className,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<IconProps>;
  tone?: "default" | "warn" | "info" | "danger";
  sub?: string;
  className?: string;
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/5 dark:text-amber-200"
      : tone === "info"
      ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/5 dark:text-sky-200"
      : tone === "danger"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-card text-foreground";

  return (
    <div className={cn("flex items-start gap-3 border p-4", toneCls, className)}>
      <div className="flex size-9 items-center justify-center border border-current/30 bg-current/5">
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wider opacity-70">
          {label}
        </span>
        <span className="font-mono text-2xl font-semibold leading-tight tabular-nums">
          {value}
        </span>
        {sub && <span className="text-xs opacity-70">{sub}</span>}
      </div>
    </div>
  );
}
