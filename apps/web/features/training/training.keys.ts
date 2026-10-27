import type { TrainingTeamParams } from "./training.service";

export const trainingKeys = {
  all: ["training"] as const,
  me: ["training", "me"] as const,
  adminRoles: ["training", "admin", "roles"] as const,
  adminBranches: ["training", "admin", "branches"] as const,
  adminTeam: (params: TrainingTeamParams) => ["training", "admin", "team", params] as const,
  quiz: (trackKey: string) => ["training", "quiz", trackKey] as const,
  missions: ["training", "missions"] as const,
};
