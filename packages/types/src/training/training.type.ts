import { z } from "zod";
import {
  trainingCompletedBySchema,
  trainingRoleFormSchema,
  trainingRoleUpdateSchema,
  trainingProgressSchema,
  trainingQuizSubmitSchema,
  trainingStepStatusSchema,
} from "@skerp/validators";
import type { TrainingStageKey, TrainingTrackKey } from "./catalog.js";
import type { TrainingQuizQuestion } from "./quizzes.js";

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
  /** Best quiz result per track the user has tried. */
  certifications: TrainingCertification[];
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
  /** Has passed this track's quiz. */
  certified: boolean;
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

/* ------------------------------------------------------------------ */
/* Quizzes (A10)                                                       */
/* ------------------------------------------------------------------ */

export type TrainingQuizSubmitBody = z.infer<typeof trainingQuizSubmitSchema>;

/** A user's best result on one track's quiz. */
export type TrainingCertification = {
  trackKey: TrainingTrackKey;
  passed: boolean;
  bestScore: number;
  total: number;
  /** When they first passed, if they have. */
  passedAt: string | null;
};

/** GET /training/quiz/:trackKey */
export type TrainingQuizView = {
  trackKey: TrainingTrackKey;
  questions: TrainingQuizQuestion[];
  passPercent: number;
  attempts: number;
  best: TrainingCertification | null;
};

/** POST /training/quiz/:trackKey — the graded attempt. */
export type TrainingQuizResult = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  results: {
    id: string;
    chosen: number | null;
    answer: number;
    correct: boolean;
    explain: string;
  }[];
};

/* ------------------------------------------------------------------ */
/* Practice missions (A9, training environment only)                   */
/* ------------------------------------------------------------------ */

/** GET /training/missions — one row per mission in the user's tracks. */
export type TrainingMissionView = {
  key: string;
  /** All checks passed, or marked done by the trainee. */
  done: boolean;
  /** Per verifier: has the ERP seen this work? (empty for self-marked missions) */
  checks: { verifier: string; done: boolean }[];
};
