import type { DeviceStatus } from "@skerp/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<DeviceStatus, string> = {
  online: "bg-green-500/10 text-green-700 border-green-500/20",
  offline: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  unknown: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  unknown: "Unknown",
};

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5",
        "text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AssignmentBadge({
  assigned,
  compact = false,
}: {
  assigned: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        assigned
          ? "border-blue-500/20 bg-blue-500/10 text-blue-700"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700",
      )}
    >
      {compact
        ? assigned
          ? "VP"
          : "Free"
        : assigned
          ? "Assigned rake"
          : "Unassigned tracker"}
    </span>
  );
}

/** Pulsing dot + label that reflects the live-socket connection. */
export function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        connected
          ? "border-green-500/20 bg-green-500/10 text-green-700"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span className="relative flex size-1.5">
        {connected && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500/70" />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            connected ? "bg-green-600" : "bg-muted-foreground",
          )}
        />
      </span>
      {connected ? "Live" : "Offline"}
    </span>
  );
}

/** Human-friendly "x minutes ago" for an ISO timestamp. */
export function formatLastUpdate(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Absolute local datetime, e.g. "23 Jun, 14:05". */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Local date-time value used by the tracking history request. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
