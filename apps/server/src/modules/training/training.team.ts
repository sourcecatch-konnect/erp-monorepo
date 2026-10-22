import {
  TRAINING_TRACKS,
  type PermissionKey,
  type TrainingAdminRole,
  type TrainingTeamRow,
} from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { getPermissionContext } from "../../auth/permission-cache.js";
import { resolveTracks } from "./training.tracks.js";

/* ------------------------------------------------------------------ */
/* Roles (A5)                                                          */
/* ------------------------------------------------------------------ */

export const adminRoleSelect = {
  id: true,
  name: true,
  isSystem: true,
  _count: { select: { users: true } },
  trainingProfile: { select: { summary: true, responsibilities: true } },
  trainingTracks: { select: { trackKey: true, required: true } },
  rolePermissions: { select: { permission: { select: { key: true } } } },
} as const;

type AdminRoleRow = {
  id: string;
  name: string;
  isSystem: boolean;
  _count: { users: number };
  trainingProfile: { summary: string; responsibilities: string[] } | null;
  trainingTracks: { trackKey: string; required: boolean }[];
  rolePermissions: { permission: { key: string } }[];
};

/** A role as the admin screen shows it: suggestion vs what the admin chose. */
export function toAdminRole(role: AdminRoleRow): TrainingAdminRole {
  const keys = new Set(role.rolePermissions.map((row) => row.permission.key));
  const has = (key: PermissionKey) => role.isSystem || keys.has(key);
  const suggested = resolveTracks(has, role.isSystem, []);
  const configured =
    role.trainingTracks.length > 0
      ? resolveTracks(has, role.isSystem, role.trainingTracks)
      : null;

  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    userCount: role._count.users,
    profile: role.trainingProfile,
    usesSuggested: configured === null,
    tracks: TRAINING_TRACKS.map((track) => {
      const s = suggested.find((view) => view.key === track.key);
      const c = configured?.find((view) => view.key === track.key);
      return {
        key: track.key,
        stepCount: s?.stepKeys.length ?? 0,
        suggested: s?.assignment ?? null,
        configured: c?.assignment ?? null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Team progress (A5)                                                  */
/* ------------------------------------------------------------------ */

export type TeamUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  role: { name: string };
  branch: { name: string } | null;
};

export const teamUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  roleId: true,
  role: { select: { name: true } },
  branch: { select: { name: true } },
} as const;

/** Resolve permissions a few users at a time so a big export can't flood the DB pool. */
async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function buildTeamRows(users: TeamUser[]): Promise<TrainingTeamRow[]> {
  if (users.length === 0) return [];
  const userIds = users.map((user) => user.id);
  const roleIds = [...new Set(users.map((user) => user.roleId))];

  const [contexts, progress, roleTracks] = await Promise.all([
    inBatches(userIds, 20, (userId) => getPermissionContext(userId)),
    db.trainingProgress.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, stepKey: true, completedAt: true },
    }),
    db.trainingRoleTrack.findMany({
      where: { roleId: { in: roleIds } },
      select: { roleId: true, trackKey: true, required: true },
    }),
  ]);

  const progressByUser = new Map<string, Map<string, Date>>();
  for (const entry of progress) {
    const steps = progressByUser.get(entry.userId) ?? new Map<string, Date>();
    steps.set(entry.stepKey, entry.completedAt);
    progressByUser.set(entry.userId, steps);
  }

  return users.map((user, index) => {
    const ctx = contexts[index];
    const has = (key: PermissionKey) => ctx?.permissions.has(key) ?? false;
    const steps = progressByUser.get(user.id) ?? new Map<string, Date>();
    const views = resolveTracks(
      has,
      ctx?.isSystemRole ?? false,
      roleTracks.filter((row) => row.roleId === user.roleId),
    );
    const tracks = views.map((view) => ({
      key: view.key,
      assignment: view.assignment,
      finished: view.stepKeys.filter((key) => steps.has(key)).length,
      total: view.stepKeys.length,
    }));
    const required = tracks.filter((track) => track.assignment === "required");
    const last = [...steps.values()].sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      roleName: user.role.name,
      branchName: user.branch?.name ?? null,
      tracks,
      required: {
        finished: required.reduce((sum, track) => sum + track.finished, 0),
        total: required.reduce((sum, track) => sum + track.total, 0),
      },
      lastActivity: last ? last.toISOString() : null,
    };
  });
}
