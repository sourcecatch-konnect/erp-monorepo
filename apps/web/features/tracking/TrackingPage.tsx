"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { IconMapPin, IconRefresh, IconSearch } from "@tabler/icons-react";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@/lib/utils";

import { trackingApi } from "./tracking.service";
import { trackingKeys } from "./tracking.keys";
import { FleetMap } from "./FleetMap";
import { StatusBadge, formatLastUpdate } from "./tracking-ui";

const REFRESH_MS = 20_000;

export default function TrackingPage() {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: trackingKeys.fleet,
    queryFn: trackingApi.fleet,
    refetchInterval: REFRESH_MS,
  });

  const vehicles = React.useMemo(() => data ?? [], [data]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.vehicleNumber ?? "").toLowerCase().includes(q) ||
        v.uniqueId.includes(q),
    );
  }, [vehicles, search]);

  const onlineCount = vehicles.filter((v) => v.status === "online").length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Wagon Tracking
          </h1>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} wagon{vehicles.length === 1 ? "" : "s"} ·{" "}
            {onlineCount} online
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <IconRefresh className={cn("size-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="flex min-h-0 flex-col gap-3 rounded-md border border-border bg-card p-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search wagon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
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
                {(error as Error)?.message ?? "Failed to load fleet"}
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No devices found.
              </p>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    "w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent",
                    selectedId === v.id && "border-primary ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {v.name}
                    </span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <IconMapPin className="size-3.5" />
                    {v.position ? `${v.position.speedKmph} km/h` : "No position"}
                    <span>· {formatLastUpdate(v.lastUpdate)}</span>
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

        <div className="min-h-0 overflow-hidden rounded-md border border-border">
          <FleetMap
            vehicles={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
