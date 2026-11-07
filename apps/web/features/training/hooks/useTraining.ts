"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TRAINING_TRACKS,
  type TrainingMe,
  type TrainingStepStatus,
} from "@skerp/types";
import { trainingKeys } from "../training.keys";
import { trainingApi } from "../training.service";

/**
 * The signed-in user's training picture: role, tracks, progress, certificates.
 *
 * `staleTime` is deliberately much longer than the app default (30s), because
 * `PageHelp` reads this on every operational screen that has a Help button —
 * LR, Orders, Trips, Billing and the rest — to know whether to offer the
 * screen's tour. At the default it refetched on almost every navigation, and
 * `/training/me` is seven parallel queries, which is a lot to pay for a dot
 * on a Help button.
 *
 * Staleness costs nothing here: progress only changes through
 * `useStepProgress`, which writes the new value into this cache itself.
 */
export const useTrainingMe = () =>
  useQuery({
    queryKey: trainingKeys.me,
    queryFn: trainingApi.me,
    staleTime: 5 * 60_000,
  });

type StepChange =
  | { stepKey: string; status: TrainingStepStatus }
  | { stepKey: string; status: null };

/**
 * Mark a step done / skipped, or undo it (status: null). Updates the cached
 * /training/me straight away so the checklist responds instantly, and rolls
 * back if the server says no.
 */
export function useStepProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stepKey, status }: StepChange) =>
      status === null
        ? trainingApi.undoProgress(stepKey)
        : trainingApi.saveProgress({ stepKey, status }),
    onMutate: async ({ stepKey, status }) => {
      await queryClient.cancelQueries({ queryKey: trainingKeys.me });
      const previous = queryClient.getQueryData<TrainingMe>(trainingKeys.me);
      if (previous) {
        const others = previous.progress.filter(
          (entry) => entry.stepKey !== stepKey,
        );
        queryClient.setQueryData<TrainingMe>(trainingKeys.me, {
          ...previous,
          progress:
            status === null
              ? others
              : [
                  ...others,
                  {
                    stepKey,
                    status,
                    completedBy: "SELF",
                    completedAt: new Date().toISOString(),
                  },
                ],
        });
      }
      return { previous };
    },
    onError: (error, _change, context) => {
      if (context?.previous) {
        queryClient.setQueryData(trainingKeys.me, context.previous);
      }
      toast.error(`We couldn't save that: ${error.message}`);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: trainingKeys.me }),
  });
}

const VISIT_STEPS = TRAINING_TRACKS.flatMap((track) => track.steps).filter(
  (step) => step.completesOnVisit,
);

/** Ticks "go and look at this page" steps the moment that page is opened. */
export function useCompleteOnVisit(path: string) {
  const { data: me } = useTrainingMe();
  const { mutate } = useStepProgress();
  const sent = useRef(new Set<string>());

  useEffect(() => {
    if (!me) return;
    const visible = new Set(me.tracks.flatMap((track) => track.stepKeys));
    const done = new Set(me.progress.map((entry) => entry.stepKey));
    for (const step of VISIT_STEPS) {
      if (
        step.href === path &&
        visible.has(step.key) &&
        !done.has(step.key) &&
        !sent.current.has(step.key)
      ) {
        sent.current.add(step.key);
        mutate({ stepKey: step.key, status: "DONE" });
      }
    }
  }, [me, path, mutate]);
}

/**
 * A6 — when a track opens, ask the server to tick the steps the user has
 * already done for real (e.g. they have booked an order before).
 */
export function useVerifyTrack(trackKey: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: () => trainingApi.verify(trackKey),
    onSuccess: ({ verified }) => {
      if (verified.length === 0) return;
      const n = verified.length;
      toast.success(
        `${n} step${n === 1 ? " was" : "s were"} ticked for you, because you have already done ${
          n === 1 ? "it" : "them"
        } in the ERP.`,
      );
      void queryClient.invalidateQueries({ queryKey: trainingKeys.me });
    },
  });
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (enabled && ranFor.current !== trackKey) {
      ranFor.current = trackKey;
      mutate();
    }
  }, [enabled, trackKey, mutate]);
}
