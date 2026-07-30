"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconGps,
  IconRefresh,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Combobox,
  type ComboboxOption,
} from "@skerp/ui/components/combobox";
import { Input } from "@skerp/ui/components/input";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import {
  useAssignOneLapTracker,
  useAvailableOneLapTrackers,
  useReleaseOneLapTracker,
  useReplaceOneLapTracker,
  useVPLoadingTrackerAssignment,
} from "../hook/useVP-loading";

type ActionMode = "replace" | "release" | null;

export function OneLapTrackerAssignmentPanel({
  scheduleId,
  hostRowId,
  hostVpNo,
}: {
  scheduleId: string;
  hostRowId: string;
  hostVpNo?: string | null;
}) {
  const canAssign = useCan(PERMS.VP_LOADING.ASSIGN_TRACKER);
  const canReplace = useCan(PERMS.VP_LOADING.REPLACE_TRACKER);
  const canRelease = useCan(PERMS.VP_LOADING.RELEASE_TRACKER);

  const assignmentQuery = useVPLoadingTrackerAssignment(scheduleId);
  const [mode, setMode] = React.useState<ActionMode>(null);
  const [trackerId, setTrackerId] = React.useState("");
  const [reason, setReason] = React.useState("");

  const assignment = assignmentQuery.data;
  const journeyLocked = Boolean(
    assignment?.schedule.railRake &&
      ["DISPATCHED", "UNLOADING", "RECEIVED"].includes(
        assignment.schedule.railRake.status,
      ),
  );
  const needsOptions =
    Boolean(scheduleId && hostRowId) &&
    ((assignment === null && canAssign) || (mode === "replace" && canReplace));
  const trackersQuery = useAvailableOneLapTrackers(
    scheduleId,
    needsOptions,
  );

  const assignTracker = useAssignOneLapTracker();
  const replaceTracker = useReplaceOneLapTracker();
  const releaseTracker = useReleaseOneLapTracker();

  const trackerOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (trackersQuery.data ?? []).map((tracker) => ({
        value: tracker.id,
        label: `${tracker.name} · ${tracker.signalHealth.replaceAll("_", " ")}`,
        hint:
          tracker.vehicleNumber ?? `IMEI ${tracker.uniqueId}`,
      })),
    [trackersQuery.data],
  );

  const resetAction = () => {
    setMode(null);
    setTrackerId("");
    setReason("");
  };

  const handleAssign = async () => {
    if (!trackerId || !hostRowId) return;
    try {
      const result = await assignTracker.mutateAsync({
        scheduleId,
        body: {
          trackerId,
          installedOnMrRrRowId: hostRowId,
        },
      });
      toast.success(
        `${result.tracker.name} assigned to ${result.schedule.scheduleNumber}`,
      );
      resetAction();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReplace = async () => {
    if (!trackerId || !hostRowId || reason.trim().length < 3) return;
    try {
      const result = await replaceTracker.mutateAsync({
        scheduleId,
        body: {
          trackerId,
          installedOnMrRrRowId: hostRowId,
          reason: reason.trim(),
        },
      });
      toast.success(`Rake tracker replaced with ${result.tracker.name}`);
      resetAction();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleRelease = async () => {
    if (reason.trim().length < 3) return;
    try {
      await releaseTracker.mutateAsync({
        scheduleId,
        body: { reason: reason.trim() },
      });
      toast.success("Rake tracker released");
      resetAction();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!scheduleId) return null;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconGps size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Rake OneLap Tracker</h3>
            <p className="text-xs text-muted-foreground">
              One tracker represents the complete VP Schedule journey.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => assignmentQuery.refetch()}
          disabled={assignmentQuery.isFetching}
        >
          <IconRefresh
            size={15}
            className={assignmentQuery.isFetching ? "animate-spin" : ""}
          />
          Refresh
        </Button>
      </div>

      {assignmentQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">
          Checking tracker assignment…
        </p>
      ) : assignment ? (
        <>
          <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
            <TrackerFact label="Tracker" value={assignment.tracker.name} />
            <TrackerFact
              label="Installed on"
              value={assignment.installedOnVpNo ?? "VP not available"}
            />
            <TrackerFact
              label="Signal"
              value={assignment.tracker.signalHealth.replaceAll("_", " ")}
            />
          </div>

          {mode === "replace" ? (
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-medium">
                  New tracker for {hostVpNo || "selected VP"}
                </p>
                <Combobox
                  options={trackerOptions}
                  value={trackerId}
                  onChange={setTrackerId}
                  placeholder="Select available tracker"
                  emptyText="No available tracker found"
                  disabled={!hostRowId || trackersQuery.isLoading}
                />
              </div>
              <Input
                className="sm:col-span-2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Replacement reason"
              />
              <Button
                type="button"
                onClick={handleReplace}
                disabled={
                  !trackerId ||
                  !hostRowId ||
                  reason.trim().length < 3 ||
                  replaceTracker.isPending
                }
              >
                Replace tracker
              </Button>
              <Button type="button" variant="outline" onClick={resetAction}>
                Cancel
              </Button>
            </div>
          ) : mode === "release" ? (
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <Input
                className="sm:col-span-2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Manual release reason"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={handleRelease}
                disabled={
                  reason.trim().length < 3 || releaseTracker.isPending
                }
              >
                Release tracker
              </Button>
              <Button type="button" variant="outline" onClick={resetAction}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canReplace && !journeyLocked ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setMode("replace")}
                  disabled={!hostRowId}
                >
                  Replace on selected VP
                </Button>
              ) : null}
              {canRelease && !journeyLocked ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setMode("release")}
                >
                  Manual release
                </Button>
              ) : null}
              {journeyLocked ? (
                <p className="text-xs text-muted-foreground">
                  Tracker changes are locked after the rake journey starts.
                </p>
              ) : null}
            </div>
          )}
        </>
      ) : !hostRowId ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <IconAlertTriangle size={17} className="mt-0.5 shrink-0" />
          Select the VP No. where the tracker will be physically installed.
        </div>
      ) : canAssign ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="mb-1.5 text-xs font-medium">
              Tracker installed on {hostVpNo || "selected VP"}
            </p>
            <Combobox
              options={trackerOptions}
              value={trackerId}
              onChange={setTrackerId}
              placeholder="Select available OneLap tracker"
              emptyText="No available tracker found"
              disabled={trackersQuery.isLoading}
            />
          </div>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!trackerId || assignTracker.isPending}
          >
            Assign tracker
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <IconAlertTriangle size={17} className="mt-0.5 shrink-0" />
          This schedule has no tracker. You do not have permission to assign
          one.
        </div>
      )}
    </section>
  );
}

function TrackerFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
