"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconRefresh } from "@tabler/icons-react";
import type { FleetVehicle, LivePosition } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@/lib/utils";

import { trackingApi } from "./tracking.service";
import { trackingKeys } from "./tracking.keys";
import { FleetMap } from "./FleetMap";
import {
  WagonList,
  type AssignmentFilter,
  type StatusFilter,
} from "./WagonList";
import { WagonPanel } from "./WagonPanel";
import { useTrackingSocket } from "./useTrackingSocket";
import { LiveBadge, toLocalInputValue } from "./tracking-ui";

/** Metadata safety-net refetch; live positions arrive over the socket. */
const FLEET_REFRESH_MS = 60_000;
const PLAYBACK_MS = 400;

type Mode = "live" | "history";

/** Merge a batch of live positions into the cached fleet list. */
function mergePositions(
  fleet: FleetVehicle[] | undefined,
  positions: LivePosition[],
): FleetVehicle[] {
  if (!fleet) return [];
  const byId = new Map(positions.map((p) => [p.deviceId, p]));
  return fleet.map((v) => {
    const p = byId.get(v.id);
    if (!p) return v;
    return {
      ...v,
      status: "online",
      lastUpdate: p.fixTime ?? new Date().toISOString(),
      position: {
        positionId: v.position?.positionId ?? 0,
        latitude: p.latitude,
        longitude: p.longitude,
        speedKmph: p.speedKmph,
        course: p.course,
        address: null,
        fixTime: p.fixTime,
      },
    };
  });
}

export default function TrackingPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [assignmentFilter, setAssignmentFilter] =
    React.useState<AssignmentFilter>("all");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<Mode>("live");

  // History state
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [range, setRange] = React.useState<{ from: string; to: string } | null>(
    null,
  );
  const [playIndex, setPlayIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  const fleetQuery = useQuery({
    queryKey: trackingKeys.fleet,
    queryFn: trackingApi.fleet,
    refetchInterval: FLEET_REFRESH_MS,
  });

  const onPositions = React.useCallback(
    (positions: LivePosition[]) => {
      queryClient.setQueryData<FleetVehicle[]>(trackingKeys.fleet, (old) =>
        mergePositions(old, positions),
      );
    },
    [queryClient],
  );
  const connected = useTrackingSocket(onPositions);

  const vehicles = React.useMemo(
    () => fleetQuery.data ?? [],
    [fleetQuery.data],
  );

  const statusCounts = React.useMemo<Record<StatusFilter, number>>(
    () => ({
      all: vehicles.length,
      online: vehicles.filter((v) => v.status === "online").length,
      offline: vehicles.filter((v) => v.status !== "online").length,
    }),
    [vehicles],
  );

  const assignmentCounts = React.useMemo<Record<AssignmentFilter, number>>(
    () => ({
      all: vehicles.length,
      assigned: vehicles.filter((v) => Boolean(v.assignment)).length,
      unassigned: vehicles.filter((v) => !v.assignment).length,
    }),
    [vehicles],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter === "online" && v.status !== "online") return false;
      if (statusFilter === "offline" && v.status === "online") return false;
      if (assignmentFilter === "assigned" && !v.assignment) return false;
      if (assignmentFilter === "unassigned" && v.assignment) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.vehicleNumber ?? "").toLowerCase().includes(q) ||
        v.uniqueId.includes(q) ||
        (v.assignment?.scheduleNumber ?? "").toLowerCase().includes(q) ||
        (v.assignment?.rake?.rakeNumber ?? "").toLowerCase().includes(q) ||
        (v.assignment?.installedOnVpNo ?? "").toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, statusFilter, assignmentFilter]);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  // History trail
  const historyQuery = useQuery({
    queryKey:
      range && selected?.assignment
        ? trackingKeys.history(selected.assignment.id, range.from, range.to)
        : ["tracking", "history", "idle"],
    queryFn: () =>
      trackingApi.history(selected!.assignment!.id, range!.from, range!.to),
    enabled: mode === "history" && !!range && Boolean(selected?.assignment),
  });
  const trail = range ? (historyQuery.data ?? null) : null;

  // Advance playback
  React.useEffect(() => {
    if (!playing || !trail || trail.length === 0) return;
    const timer = setInterval(() => {
      setPlayIndex((i) => {
        if (i >= trail.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAYBACK_MS);
    return () => clearInterval(timer);
  }, [playing, trail]);

  const selectWagon = (id: number) => {
    setSelectedId(id);
    setMode("live");
    setRange(null);
    setPlaying(false);
  };

  const closePanel = () => {
    setSelectedId(null);
    setMode("live");
    setRange(null);
    setPlaying(false);
  };

  const openHistory = () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (selected?.assignment) {
      const assignedAt = new Date(selected.assignment.assignedAt);
      if (assignedAt > start) start.setTime(assignedAt.getTime());
    }
    setFrom(toLocalInputValue(start));
    setTo(toLocalInputValue(now));
    setRange(null);
    setPlayIndex(0);
    setPlaying(false);
    setMode("history");
  };

  const exitHistory = () => {
    setMode("live");
    setRange(null);
    setPlaying(false);
  };

  const loadHistory = () => {
    if (!from || !to) return;
    setPlayIndex(0);
    setPlaying(false);
    setRange({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              Wagon Tracking
            </h1>
            <LiveBadge connected={connected} />
          </div>
          <p className="text-sm text-muted-foreground">
            {statusCounts.all} tracker{statusCounts.all === 1 ? "" : "s"} ·{" "}
            {assignmentCounts.assigned} assigned · {statusCounts.online} online
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fleetQuery.refetch()}
          disabled={fleetQuery.isFetching}
        >
          <IconRefresh
            className={cn("size-4", fleetQuery.isFetching && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      <div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="flex min-h-0 flex-col rounded-md border border-border bg-card p-3">
          <WagonList
            vehicles={filtered}
            statusCounts={statusCounts}
            assignmentCounts={assignmentCounts}
            isLoading={fleetQuery.isLoading}
            isError={fleetQuery.isError}
            errorMessage={(fleetQuery.error as Error | null)?.message}
            selectedId={selectedId}
            onSelect={selectWagon}
            search={search}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            assignmentFilter={assignmentFilter}
            onAssignmentFilter={setAssignmentFilter}
          />
        </div>

        <div className="relative min-h-0 overflow-hidden rounded-md border border-border">
          <FleetMap
            vehicles={filtered}
            selectedId={selectedId}
            onSelect={(id) => (id == null ? closePanel() : selectWagon(id))}
            trail={mode === "history" ? trail : null}
            trailIndex={playIndex}
          />

          {selected && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center sm:justify-start">
              <WagonPanel
                vehicle={selected}
                mode={mode}
                onClose={closePanel}
                onOpenHistory={openHistory}
                onExitHistory={exitHistory}
                from={from}
                to={to}
                onFrom={setFrom}
                onTo={setTo}
                onLoadHistory={loadHistory}
                historyLoading={historyQuery.isFetching}
                historyError={(historyQuery.error as Error | null)?.message}
                trail={trail}
                playIndex={playIndex}
                playing={playing}
                onPlayToggle={() => setPlaying((p) => !p)}
                onSeek={(i) => {
                  setPlaying(false);
                  setPlayIndex(i);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
