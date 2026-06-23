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
