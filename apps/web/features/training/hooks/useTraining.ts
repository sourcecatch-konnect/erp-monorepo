"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TrainingMe, TrainingStepStatus } from "@skerp/types";
import { trainingKeys } from "../training.keys";
import { trainingApi } from "../training.service";

export const useTrainingMe = () =>
  useQuery({ queryKey: trainingKeys.me, queryFn: trainingApi.me });

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
        const others = previous.progress.filter((entry) => entry.stepKey !== stepKey);
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainingKeys.me }),
  });
}
