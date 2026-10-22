"use client";

import { useMemo, useState } from "react";
import type { TrainingStageKey } from "@skerp/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { ProcessMap, type Highlight } from "./components/ProcessMap";
import { StageSheet } from "./components/StageSheet";
import { TrainingNav } from "./components/TrainingNav";
import { useCompleteOnVisit, useTrainingMe } from "./hooks/useTraining";

const MINE = "__mine__";
const NONE = "__none__";

/** A3 — the whole business on one screen, with "whose step is this?" highlighting. */
export function ProcessMapPage() {
  const { data: me, isLoading, isError, error } = useTrainingMe();
  useCompleteOnVisit("/training/process-map");
  const [mode, setMode] = useState<string>(MINE);
  const [openStage, setOpenStage] = useState<TrainingStageKey | null>(null);

  const roles = useMemo(
    () =>
      me ? [...new Set(me.stages.flatMap((stage) => stage.owners))].sort() : [],
    [me],
  );

  const highlight = useMemo<Highlight | null>(() => {
    if (!me || mode === NONE) return null;
    if (mode === MINE) {
      return {
        stages: new Set(me.stages.filter((s) => s.owned).map((s) => s.key)),
        label: "Your step",
      };
    }
    return {
      stages: new Set(
        me.stages.filter((s) => s.owners.includes(mode)).map((s) => s.key),
      ),
      label: mode,
    };
  }, [me, mode]);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          How the business works
        </h1>
        <p className="text-sm text-muted-foreground">
          Follow an order from booking to payment. Click any step to see what
          happens there, who does it and what you need first.
        </p>
      </header>

      <TrainingNav />

      {isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load the process map: {error.message}
        </p>
      ) : null}

      {isLoading || !me ? (
        isError ? null : (
          <div className="space-y-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
            <label htmlFor="map-highlight" className="text-sm font-medium text-foreground">
              Highlight the steps done by
            </label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="map-highlight" className="h-10 w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MINE}>Me ({me.role.name})</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Nobody (plain map)</SelectItem>
              </SelectContent>
            </Select>
            {highlight ? (
              <span className="text-sm text-muted-foreground">
                {highlight.stages.size === 0
                  ? "No steps to highlight."
                  : `${highlight.stages.size} step${highlight.stages.size === 1 ? "" : "s"} highlighted in blue.`}
              </span>
            ) : null}
          </div>

          <ProcessMap highlight={highlight} onOpen={setOpenStage} />

          <StageSheet
            stageKey={openStage}
            me={me}
            onOpenStage={setOpenStage}
            onClose={() => setOpenStage(null)}
          />
        </>
      )}
    </div>
  );
}
