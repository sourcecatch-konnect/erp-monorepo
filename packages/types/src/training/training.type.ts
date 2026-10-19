import { z } from "zod";
import {
  trainingCompletedBySchema,
  trainingProgressSchema,
  trainingStepStatusSchema,
} from "@skerp/validators";
import type { TrainingStageKey, TrainingTrackKey } from "./catalog.js";

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
  /** The current user does this step (holds one of its actions). */
  owned: boolean;
  /** The current user can open the stage's screen. */
  canOpen: boolean;
  /** Role names that do this step (system roles left out). */
  owners: string[];
  /** Labels of the stage actions the current user holds ("Book new orders"). */
  abilities: string[];
};

export type TrainingTrackAssignment = "required" | "optional";

export type TrainingTrackView = {
  key: TrainingTrackKey;
  assignment: TrainingTrackAssignment;
  /** Steps the user can see (permission-filtered), in catalog order. */
  stepKeys: string[];
};

/** GET /training/me */
export type TrainingMe = {
  user: { id: string; name: string; firstName: string };
  role: { id: string; name: string };
  homeBranch: { id: string; name: string } | null;
  branchScope: "ALL" | "ASSIGNED";
  branches: { id: string; name: string }[];
  profile: { summary: string; responsibilities: string[] } | null;
  stages: TrainingStageView[];
  /** Required first, then optional; tracks with no visible steps are left out. */
  tracks: TrainingTrackView[];
  progress: TrainingProgressEntry[];
};
