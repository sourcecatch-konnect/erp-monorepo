import { z } from "zod";
import {
  trainingCompletedBySchema,
  trainingRoleFormSchema,
  trainingRoleUpdateSchema,
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

/* ------------------------------------------------------------------ */
/* Admin (A5)                                                          */
/* ------------------------------------------------------------------ */

export type TrainingRoleUpdateBody = z.infer<typeof trainingRoleUpdateSchema>;
export type TrainingRoleFormValues = z.infer<typeof trainingRoleFormSchema>;

export type TrainingAdminRoleTrack = {
  key: TrainingTrackKey;
  /** Steps this role can see in the track; 0 = track doesn't apply. */
  stepCount: number;
  /** What the permission-based suggestion would be. */
  suggested: TrainingTrackAssignment | null;
  /** What the admin chose, or null when the role uses the suggestion. */
  configured: TrainingTrackAssignment | null;
};

/** GET /training/admin/roles */
export type TrainingAdminRole = {
  id: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  profile: { summary: string; responsibilities: string[] } | null;
  usesSuggested: boolean;
  tracks: TrainingAdminRoleTrack[];
};

export type TrainingTeamTrack = {
  key: TrainingTrackKey;
  assignment: TrainingTrackAssignment;
  finished: number;
  total: number;
};

/** GET /training/admin/team (one row per active user) */
export type TrainingTeamRow = {
  userId: string;
  name: string;
  email: string;
  roleName: string;
  branchName: string | null;
  tracks: TrainingTeamTrack[];
  required: { finished: number; total: number };
  lastActivity: string | null;
};

/** POST /training/verify/:trackKey */
export type TrainingVerifyResult = { verified: string[] };
