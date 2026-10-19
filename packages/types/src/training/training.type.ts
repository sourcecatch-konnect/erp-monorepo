import { z } from "zod";
import {
  trainingCompletedBySchema,
  trainingProgressSchema,
  trainingStepStatusSchema,
} from "@skerp/validators";
import type { TrainingStageKey } from "./catalog.js";

export type TrainingStepStatus = z.infer<typeof trainingStepStatusSchema>;
export type TrainingCompletedBy = z.infer<typeof trainingCompletedBySchema>;
export type TrainingProgressBody = z.infer<typeof trainingProgressSchema>;

export type TrainingProgressEntry = {
  stepKey: string;
  status: TrainingStepStatus;
  completedBy: TrainingCompletedBy;
  completedAt: string;
};

export type TrainingStageView = {
  key: TrainingStageKey;
  /** The current user does this step (holds one of its permissions). */
  owned: boolean;
  /** The current user can open the stage's screen. */
  canOpen: boolean;
  /** Role names that do this step. */
  owners: string[];
};

/** GET /training/me */
export type TrainingMe = {
  user: { id: string; name: string };
  role: { id: string; name: string };
  branchScope: "ALL" | "ASSIGNED";
  branches: { id: string; name: string }[];
  profile: { summary: string; responsibilities: string[] } | null;
  stages: TrainingStageView[];
  progress: TrainingProgressEntry[];
};
