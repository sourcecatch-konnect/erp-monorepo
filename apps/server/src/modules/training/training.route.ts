import { Router } from "express";
import {
  trainingProgressSchema,
  trainingStepKeySchema,
} from "@skerp/validators";
import {
  TRAINING_STAGES,
  TRAINING_STAGE_PERMISSION_KEYS,
  TRAINING_TRACKS,
  isStageOwned,
  type PermissionKey,
  type TrainingMe,
  type TrainingVerifyResult,
} from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { BadRequestError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import adminRoute from "./training.admin.route.js";
import { resolveTracks } from "./training.tracks.js";
import { VERIFIERS } from "./training.verifiers.js";

/**
 * Role-based training. Every signed-in user reads their own training data,
 * so auth is the only gate here; /admin/* adds can(PERMS.ADMIN.TRAINING_MANAGE).
 *
 * Training only *reads* other modules' tables; nothing imports from it.
 */
const router: Router = Router();
router.use(authMiddleware);
router.use("/admin", adminRoute);

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

/**
 * A6 — tick steps the user has already done for real. Looks only at steps
 * that are not done yet (a skipped step is upgraded to done if the work has
 * since happened), so each lookup runs at most once per user per step.
 */
router.post("/verify/:trackKey", async (req, res) => {
  const ctx = req.ctx!;
  const track = TRAINING_TRACKS.find((t) => t.key === req.params.trackKey);
  if (!track) throw new NotFoundError("Training not found");

  const has = (key: PermissionKey) => ctx.permissions.has(key);
  const candidates = track.steps.filter(
    (step) => step.verifier && (!step.requires || has(step.requires)),
  );
  if (candidates.length === 0) {
    return sendOk<TrainingVerifyResult>(res, { verified: [] });
  }

  const existing = new Map(
    (
      await db.trainingProgress.findMany({
        where: { userId: ctx.userId, stepKey: { in: candidates.map((s) => s.key) } },
        select: { stepKey: true, status: true },
      })
    ).map((row) => [row.stepKey, row.status]),
  );
  const pending = candidates.filter((step) => existing.get(step.key) !== "DONE");
  const checks = await Promise.all(
    pending.map(async (step) =>
      step.verifier && (await VERIFIERS[step.verifier](ctx.userId)) ? step.key : null,
    ),
  );
  const verified = checks.filter((key): key is string => key !== null);
  const upgraded = verified.filter((key) => existing.get(key) === "SKIPPED");
  const fresh = verified.filter((key) => !existing.has(key));

  if (verified.length > 0) {
    await db.$transaction([
      db.trainingProgress.createMany({
        data: fresh.map((stepKey) => ({
          userId: ctx.userId,
          stepKey,
          status: "DONE" as const,
          completedBy: "SYSTEM" as const,
        })),
        skipDuplicates: true,
      }),
      db.trainingProgress.updateMany({
        where: { userId: ctx.userId, stepKey: { in: upgraded } },
        data: { status: "DONE", completedBy: "SYSTEM", completedAt: new Date() },
      }),
    ]);
  }
  return sendOk<TrainingVerifyResult>(res, { verified });
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
