import { cn } from "@skerp/ui/lib/util";
import type { EwbStatus } from "../types";

const STYLES: Record<EwbStatus, { label: string; cls: string }> = {
  ACTIVE: {
    label: "Active",
    cls: "bg-primary/10 text-primary border-primary/30",
  },
  PART_B_PENDING: {
    label: "Part-B Pending",
    cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
  },
  IN_TRANSIT: {
    label: "In Transit",
    cls: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40",
  },
  DELIVERED: {
    label: "Delivered",
    cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40",
  },
  EXPIRED: {
    label: "Expired",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: EwbStatus;
  className?: string;
}) {
  const { label, cls } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium uppercase",
        cls,
        className
      )}
    >
      <span className="size-1.5 bg-current opacity-70" />
      {label}
    </span>
  );
}
