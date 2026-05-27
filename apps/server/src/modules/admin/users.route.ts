import { Router } from "express";
import { updateUserAccessSchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { invalidateUser } from "../../auth/permission-cache.js";
import { recordAuditEntry } from "../audit/audit.service.js";
import { NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";

const router = Router();
router.use(authMiddleware);
router.use(can(PERMS.ADMIN.RBAC_MANAGE));

const userListSelect = {
  id: true,
  userName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  status: true,
  branchScope: true,
  branchId: true,
  role: { select: { id: true, name: true, isSystem: true } },
  userBranches: { select: { branchId: true } },
} as const;

router.get("/", async (_req, res) => {
  const users = await db.user.findMany({
    orderBy: { email: "asc" },
    select: userListSelect,
  });
  sendOk(res, users);
});

router.get("/:id/access", async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.params.id },
    select: {
      ...userListSelect,
      userPermissions: {
        select: { effect: true, permission: { select: { key: true } } },
      },
    },
  });
  if (!user) throw new NotFoundError("User not found");
  sendOk(res, {
    ...user,
    branchIds: user.userBranches.map((b) => b.branchId),
    overrides: user.userPermissions.map((up) => ({
      key: up.permission.key,
      effect: up.effect,
    })),
  });
});

router.patch("/:id/access", async (req, res) => {
  const body = updateUserAccessSchema.parse(req.body);
  const user = await db.user.findUnique({
    where: { id: req.params.id },
    include: {
      role: { select: { id: true, name: true } },
      userBranches: { select: { branchId: true } },
      userPermissions: {
        select: { effect: true, permission: { select: { id: true, key: true } } },
      },
    },
  });
  if (!user) throw new NotFoundError("User not found");

  const auditBefore = {
    roleId: user.role?.id,
    branchScope: user.branchScope,
    branchIds: user.userBranches.map((b) => b.branchId).sort(),
    overrides: user.userPermissions
      .map((up) => ({ key: up.permission.key, effect: up.effect }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };

  const auditedActions: Promise<unknown>[] = [];

  await db.$transaction(async (tx) => {
    if (body.roleId && body.roleId !== user.roleId) {
      await tx.user.update({
        where: { id: user.id },
        data: { roleId: body.roleId },
      });
      auditedActions.push(
        recordAuditEntry({
          actor: { id: req.ctx!.userId },
          action: "user.role.update",
          entity: "User",
          entityId: user.id,
          before: { roleId: user.roleId },
          after: { roleId: body.roleId },
        })
      );
    }

    if (body.branchScope && body.branchScope !== user.branchScope) {
      await tx.user.update({
        where: { id: user.id },
        data: { branchScope: body.branchScope },
      });
    }

    if (body.branchIds) {
      await tx.userBranch.deleteMany({ where: { userId: user.id } });
      if (body.branchIds.length) {
        await tx.userBranch.createMany({
          data: body.branchIds.map((branchId) => ({
            userId: user.id,
            branchId,
          })),
          skipDuplicates: true,
        });
      }
      auditedActions.push(
        recordAuditEntry({
          actor: { id: req.ctx!.userId },
          action: "user.branches.update",
          entity: "User",
          entityId: user.id,
          before: { branchIds: user.userBranches.map((b) => b.branchId) },
          after: { branchIds: body.branchIds, branchScope: body.branchScope ?? user.branchScope },
        })
      );
    }

    if (body.overrides) {
      const defs = await tx.permissionDef.findMany({
        where: { key: { in: body.overrides.map((o) => o.key) } },
        select: { id: true, key: true },
      });
      const idByKey = new Map(defs.map((d) => [d.key, d.id]));

      await tx.userPermission.deleteMany({ where: { userId: user.id } });
      if (body.overrides.length) {
        await tx.userPermission.createMany({
          data: body.overrides
            .filter((o) => idByKey.has(o.key))
            .map((o) => ({
              userId: user.id,
              permissionId: idByKey.get(o.key)!,
              effect: o.effect,
            })),
        });
      }
      auditedActions.push(
        recordAuditEntry({
          actor: { id: req.ctx!.userId },
          action: "user.permissions.update",
          entity: "User",
          entityId: user.id,
          before: { overrides: auditBefore.overrides },
          after: { overrides: body.overrides },
        })
      );
    }
  });

  await Promise.all(auditedActions);
  invalidateUser(user.id);

  const fresh = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: userListSelect,
  });
  sendOk(res, { ...fresh, branchIds: fresh.userBranches.map((b) => b.branchId) });
});

export default router;
