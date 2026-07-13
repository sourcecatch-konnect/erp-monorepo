import * as React from "react";
import type { Trip, TripStatus, TripType } from "@skerp/types";
import {
  IconArrowBackUp,
  IconBan,
  IconCircleCheck,
  IconClipboardList,
  IconFileText,
  IconList,
  IconTrain,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<TripStatus, string> = {
  Planned: "Planned",
  InTransit: "In Transit",
  Closed: "Closed",
  Cancelled: "Cancelled",
};

const STATUS_STYLES: Record<TripStatus, string> = {
  Planned:
    "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  InTransit: "bg-primary/10 text-primary border-primary/20",
  Closed:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  Cancelled: "bg-muted text-muted-foreground border-border",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px",
        "text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "InTransit" && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  lr: "LR",
  dc: "Rake (DC)",
};

export function TripTypeChip({ type }: { type: TripType }) {
  const Icon = type === "lr" ? IconFileText : IconTrain;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      {TRIP_TYPE_LABELS[type]}
    </span>
  );
}

/** Vehicle registration rendered as a license-plate chip. */
export function VehiclePlate({ number }: { number: string }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-border bg-muted/50 px-1 py-px font-mono text-xs font-semibold uppercase">
      {number}
    </span>
  );
}

/** Origin ○ ---- ● destination mini route diagram. */
export function RouteCell({
  from,
  to,
}: {
  from: string | null | undefined;
  to: string | null | undefined;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className="size-2 shrink-0 rounded-full border-[1.5px] border-muted-foreground" />
      <span className="text-muted-foreground">{from ?? "?"}</span>
      <span className="w-5 shrink-0 border-t border-dashed border-muted-foreground/60" />
      <span className="size-2 shrink-0 rounded-full bg-foreground/70" />
      <span className="font-medium">{to ?? "?"}</span>
    </span>
  );
}

/** Client with an initials avatar; empty legs get an explicit chip instead of a bare dash. */
export function ClientCell({
  name,
  isTripEmpty,
}: {
  name: string | null | undefined;
  isTripEmpty: boolean;
}) {
  if (!name) {
    return isTripEmpty ? (
      <span className="inline-flex items-center rounded-sm border border-border bg-muted/50 px-1 py-px text-xs text-muted-foreground">
        Empty leg
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {initials}
      </span>
      <span className="text-sm">{name}</span>
    </span>
  );
}

/** Journey leg position; return legs get a back-arrow so they're spottable at a glance. */
export function LegChip({
  sequenceNo,
  isReturnLeg,
}: {
  sequenceNo: number | null;
  isReturnLeg: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/50 px-1 py-0 text-xs font-medium text-muted-foreground">
      Leg {sequenceNo ?? "?"}
      {isReturnLeg ? <IconArrowBackUp size={11} /> : null}
    </span>
  );
}

export function DriverLine({ name }: { name: string | null | undefined }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <IconUser size={12} className="shrink-0" />
      {name ?? "—"}
    </span>
  );
}

/** Coarse relative time for ops scanning ("3d ago"). */
export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Distance run for a closed trip, or null when KMs aren't both recorded. */
export function tripKmRun(trip: Pick<Trip, "openingKm" | "closingKm">): number | null {
  if (trip.closingKm == null) return null;
  const run = trip.closingKm - trip.openingKm;
  return run >= 0 ? run : null;
}

export const TRIP_STATUS_ORDER: {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "ALL", label: "All", icon: IconList },
  { key: "Planned", label: "Planned", icon: IconClipboardList },
  { key: "InTransit", label: "In Transit", icon: IconTruckDelivery },
  { key: "Closed", label: "Closed", icon: IconCircleCheck },
  { key: "Cancelled", label: "Cancelled", icon: IconBan },
];

type DispatchGateInput = Pick<Trip, "status" | "tripType" | "isTripEmpty">;

/**
 * LR trips carrying goods dispatch by attaching an LR (server flips them to
 * InTransit on attach) — DC/empty legs have no LR to attach, so they use the
 * direct dispatch action instead. See `tripDispatchesDirect`.
 */
export function tripAttachesLR(trip: DispatchGateInput): boolean {
  return (
    trip.status === "Planned" && trip.tripType === "lr" && !trip.isTripEmpty
  );
}

export function tripDispatchesDirect(trip: DispatchGateInput): boolean {
  return (
    trip.status === "Planned" && (trip.tripType === "dc" || trip.isTripEmpty)
  );
}
