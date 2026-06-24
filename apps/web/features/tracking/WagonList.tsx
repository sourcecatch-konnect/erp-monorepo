"use client";

import {
  IconBolt,
  IconMapPin,
  IconSearch,
  IconTrain,
} from "@tabler/icons-react";
import type { FleetVehicle } from "@skerp/types";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@/lib/utils";

import { StatusBadge, formatLastUpdate } from "./tracking-ui";

export type StatusFilter = "all" | "online" | "offline";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
];

type WagonListProps = {
  /** Already filtered by search + status (filtering is centralised in the page). */
  vehicles: FleetVehicle[];
  counts: Record<StatusFilter, number>;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
  search: string;
  onSearch: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (value: StatusFilter) => void;
};

export function WagonList({
  vehicles: filtered,
  counts,
  isLoading,
  isError,
  errorMessage,
  selectedId,
  onSelect,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
}: WagonListProps) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search wagon…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onStatusFilter(f.key)}
            className={cn(
              "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              statusFilter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-70">
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border border-border p-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))
        ) : isError ? (
          <p className="px-1 py-6 text-center text-sm text-destructive">
            {errorMessage ?? "Failed to load fleet"}
          </p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-1 py-10 text-center text-sm text-muted-foreground">
            <IconTrain className="size-6 opacity-50" />
            No wagons found.
          </div>
        ) : (
          filtered.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className={cn(
                "w-full rounded-md border p-3 text-left transition-colors",
                selectedId === v.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {v.name}
                </span>
                <StatusBadge status={v.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <IconBolt className="size-3.5" />
                  {v.position ? `${v.position.speedKmph} km/h` : "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconMapPin className="size-3.5" />
                  {formatLastUpdate(v.lastUpdate)}
                </span>
              </div>
              {v.vehicleNumber && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {v.vehicleNumber}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
