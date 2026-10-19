import { Router } from "express";
import {
  trainingProgressSchema,
  trainingStepKeySchema,
} from "@skerp/validators";
import {
  TRAINING_STAGES,
  TRAINING_STAGE_PERMISSION_KEYS,
  isStageOwned,
  type PermissionKey,
  type TrainingMe,
} from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { BadRequestError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { resolveTracks } from "./training.tracks.js";

/**
 * Role-based training. Every signed-in user reads their own training data,
 * so auth is the only gate here; admin routes (A5) will add
 * can(PERMS.ADMIN.TRAINING_MANAGE).
 *
 * Training only *reads* other modules' tables; nothing imports from it.
 */
const router: Router = Router();
router.use(authMiddleware);

const progressSelect = {
  stepKey: true,
  status: true,
  completedBy: true,
  completedAt: true,
} as const;

router.get("/me", async (req, res) => {
  const ctx = req.ctx!;
  const has = (key: PermissionKey) => ctx.permissions.has(key);

  const [user, profile, branches, ownerRows, roleTracks, progress] =
    await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          branch: { select: { id: true, name: true } },
        },
      }),
      db.trainingRoleProfile.findUnique({
        where: { roleId: ctx.roleId },
        select: { summary: true, responsibilities: true },
      }),
      ctx.branchScope === "ALL"
        ? Promise.resolve([])
        : db.branch.findMany({
            where: { id: { in: ctx.branchIds } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
      // System roles (Admin) can do everything — listing them under every
      // stage says nothing, so "done by" only names regular roles.
      db.rolePermission.findMany({
        where: {
          role: { isSystem: false },
          permission: { key: { in: [...TRAINING_STAGE_PERMISSION_KEYS] } },
        },
        select: {
          role: { select: { name: true } },
          permission: { select: { key: true } },
        },
      }),
      db.trainingRoleTrack.findMany({
        where: { roleId: ctx.roleId },
        select: { trackKey: true, required: true },
      }),
      db.trainingProgress.findMany({
        where: { userId: ctx.userId },
        select: progressSelect,
        orderBy: { completedAt: "asc" },
      }),
    ]);

  const rolesByKey = new Map<string, Set<string>>();
  for (const row of ownerRows) {
    const roles = rolesByKey.get(row.permission.key) ?? new Set<string>();
    roles.add(row.role.name);
    rolesByKey.set(row.permission.key, roles);
  }

  const body: TrainingMe = {
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
    },
    role: { id: ctx.roleId, name: ctx.roleName },
    homeBranch: user.branch ?? null,
    branchScope: ctx.branchScope,
    branches,
    profile,
    stages: TRAINING_STAGES.map((stage) => {
      const owners = new Set<string>();
      for (const action of stage.actions) {
        rolesByKey.get(action.key)?.forEach((name) => owners.add(name));
      }
      return {
        key: stage.key,
        owned: isStageOwned(stage, has),
        canOpen: has(stage.viewPermission),
        owners: [...owners].sort(),
        abilities: stage.actions
          .filter((action) => has(action.key))
          .map((action) => action.label),
      };
    }),
    tracks: resolveTracks(has, ctx.isSystemRole, roleTracks),
    progress: progress.map((entry) => ({
      ...entry,
      completedAt: entry.completedAt.toISOString(),
    })),
  };
  return sendOk(res, body);
});

router.post("/progress", async (req, res) => {
  const parsed = trainingProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const userId = req.ctx!.userId;
  const { stepKey, status } = parsed.data;
  const entry = await db.trainingProgress.upsert({
    where: { userId_stepKey: { userId, stepKey } },
    create: { userId, stepKey, status, completedBy: "SELF" },
    update: { status, completedBy: "SELF", completedAt: new Date() },
    select: progressSelect,
  });
  return sendOk(res, { ...entry, completedAt: entry.completedAt.toISOString() });
});

/** "Undo" — the step goes back to not done. */
router.delete("/progress/:stepKey", async (req, res) => {
  const parsed = trainingStepKeySchema.safeParse(req.params.stepKey);
  if (!parsed.success) throw new BadRequestError("Invalid step key");
  await db.trainingProgress.deleteMany({
    where: { userId: req.ctx!.userId, stepKey: parsed.data },
  });
  return sendOk(res, { stepKey: parsed.data });
});

export default router;
