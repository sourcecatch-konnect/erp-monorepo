"use client";

import * as React from "react";
import {
  IconBattery2,
  IconClock,
  IconExternalLink,
  IconGauge,
  IconHistory,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconRoute,
  IconTrain,
  IconX,
} from "@tabler/icons-react";
import type { FleetVehicle, TrailPoint } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  AssignmentBadge,
  StatusBadge,
  formatDateTime,
  formatLastUpdate,
} from "./tracking-ui";
import { toLocalInputValue } from "./tracking-ui";
import { toValidDate } from "@/lib/date";

type WagonPanelProps = {
  vehicle: FleetVehicle;
  mode: "live" | "history";
  onClose: () => void;

  onOpenHistory: () => void;
  onExitHistory: () => void;

  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onLoadHistory: () => void;
  historyLoading: boolean;
  historyError?: string;

  trail: TrailPoint[] | null;
  playIndex: number;
  playing: boolean;
  onPlayToggle: () => void;
  onSeek: (index: number) => void;
};

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function WagonPanel(props: WagonPanelProps) {
  const { vehicle, mode } = props;
  const pos = vehicle.position;

  return (
    <div className="pointer-events-auto w-full max-w-md rounded-md border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">
              {vehicle.name}
            </h2>
            <StatusBadge status={vehicle.status} />
            <AssignmentBadge assigned={Boolean(vehicle.assignment)} />
          </div>
          {vehicle.vehicleNumber && (
            <p className="truncate text-xs text-muted-foreground">
              {vehicle.vehicleNumber}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
          aria-label="Close"
        >
          <IconX className="size-4" />
        </button>
      </div>

      {mode === "live" ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {vehicle.assignment ? (
              <>
                <Fact
                  icon={<IconTrain className="size-4" />}
                  label="Schedule"
                  value={vehicle.assignment.scheduleNumber}
                />
                <Fact
                  icon={<IconTrain className="size-4" />}
                  label="Rake"
                  value={vehicle.assignment.rake?.rakeNumber ?? "Not generated"}
                />
                <Fact
                  icon={<IconRoute className="size-4" />}
                  label="Route"
                  value={`${vehicle.assignment.route.fromBranch.name} → ${vehicle.assignment.route.toBranch.name}`}
                />
                <Fact
                  icon={<IconTrain className="size-4" />}
                  label="Installed on"
                  value={vehicle.assignment.installedOnVpNo ?? "—"}
                />
              </>
            ) : null}
            <Fact
              icon={<IconGauge className="size-4" />}
              label="Speed"
              value={pos ? `${pos.speedKmph} km/h` : "—"}
            />
            <Fact
              icon={<IconClock className="size-4" />}
              label="Last update"
              value={formatLastUpdate(vehicle.lastUpdate)}
            />
            <Fact
              icon={<IconBattery2 className="size-4" />}
              label="Battery"
              value={vehicle.battery != null ? String(vehicle.battery) : "—"}
            />
            <Fact
              icon={<IconClock className="size-4" />}
              label="Valid till"
              value={vehicle.validity ?? "—"}
            />
          </div>

          {pos && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}
            </p>
          )}

          {!vehicle.assignment && (
            <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-800">
              This is the tracker&apos;s physical location only. It is not
              currently connected to a VP wagon or rake.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {vehicle.assignment && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={props.onOpenHistory}
              >
                <IconHistory className="size-4" />
                View journey history
              </Button>
            )}
            {pos && (
              <Button asChild size="sm" variant="outline">
                <a
                  href={`https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconExternalLink className="size-4" />
                  Maps
                </a>
              </Button>
            )}
          </div>
        </>
      ) : (
        <HistoryControls {...props} />
      )}
    </div>
  );
}

function HistoryControls({
  from,
  to,
  onFrom,
  onTo,
  onLoadHistory,
  historyLoading,
  historyError,
  trail,
  playIndex,
  playing,
  onPlayToggle,
  onSeek,
  onExitHistory,
}: WagonPanelProps) {
  const current =
    trail && trail.length ? trail[Math.min(playIndex, trail.length - 1)] : null;

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            From
          </span>
          <DateTimePicker
            selected={toValidDate(from)}
            onSelect={(date) => onFrom(date ? toLocalInputValue(date) : "")}
            placeholder="Select start date and time"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            To
          </span>
          <DateTimePicker
            selected={toValidDate(to)}
            onSelect={(date) => onTo(date ? toLocalInputValue(date) : "")}
            placeholder="Select end date and time"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={onLoadHistory}
          disabled={historyLoading}
        >
          {historyLoading ? "Loading…" : "Load trail"}
        </Button>
        <Button size="sm" variant="outline" onClick={onExitHistory}>
          Back to live
        </Button>
      </div>

      {historyLoading ? (
        <div className="space-y-2 pt-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : historyError ? (
        <p className="text-sm text-destructive">{historyError}</p>
      ) : trail && trail.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPlayToggle}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <IconPlayerPauseFilled className="size-4" />
              ) : (
                <IconPlayerPlayFilled className="size-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={trail.length - 1}
              value={Math.min(playIndex, trail.length - 1)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{current ? formatDateTime(current.fixTime) : "—"}</span>
            <span className="tabular-nums">
              {current ? `${current.speedKmph} km/h` : ""} ·{" "}
              {Math.min(playIndex, trail.length - 1) + 1}/{trail.length}
            </span>
          </div>
        </div>
      ) : trail ? (
        <p className="text-sm text-muted-foreground">
          No movement recorded for this range.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pick a time range and load the wagon&apos;s trail.
        </p>
      )}
    </div>
  );
}
