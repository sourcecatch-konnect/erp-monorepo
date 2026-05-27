import { Router } from "express";
import {
  copyRoleSchema,
  createRoleSchema,
  renameRoleSchema,
  setRolePermissionsSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { invalidateAll } from "../../auth/permission-cache.js";
import { recordAuditEntry } from "../audit/audit.service.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";

const router = Router();
router.use(authMiddleware);
router.use(can(PERMS.ADMIN.RBAC_MANAGE));

const listShape = {
  id: true,
  name: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, rolePermissions: true } },
} as const;

router.get("/", async (_req, res) => {
  const rows = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: listShape,
  });
  sendOk(res, rows);
});

router.get("/:id", async (req, res) => {
  const role = await db.role.findUnique({
    where: { id: req.params.id },
    select: { ...listShape, rolePermissions: { select: { permission: { select: { key: true } } } } },
  });
  if (!role) throw new NotFoundError("Role not found");
  sendOk(res, {
    ...role,
    permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
    rolePermissions: undefined,
  });
});

router.post("/", async (req, res) => {
  const body = createRoleSchema.parse(req.body);
  const existing = await db.role.findFirst({ where: { name: body.name } });
  if (existing) throw new ConflictError("Role name already in use");
  const role = await db.role.create({
    data: { name: body.name, isSystem: false },
    select: listShape,
  });
  await recordAuditEntry({
    actor: { id: req.ctx!.userId },
    action: "role.create",
    entity: "Role",
    entityId: role.id,
    after: { name: role.name },
  });
  sendOk(res, role, undefined, 201);
});

router.patch("/:id", async (req, res) => {
  const body = renameRoleSchema.parse(req.body);
  const role = await db.role.findUnique({ where: { id: req.params.id } });
  if (!role) throw new NotFoundError("Role not found");
  if (role.isSystem) throw new ForbiddenError("System role cannot be renamed");
  const updated = await db.role.update({
    where: { id: role.id },
    data: { name: body.name },
    select: listShape,
  });
  await recordAuditEntry({
    actor: { id: req.ctx!.userId },
    action: "role.update",
    entity: "Role",
    entityId: role.id,
    before: { name: role.name },
    after: { name: updated.name },
  });
  invalidateAll();
  sendOk(res, updated);
});

router.delete("/:id", async (req, res) => {
  const role = await db.role.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new NotFoundError("Role not found");
  if (role.isSystem) throw new ForbiddenError("System role cannot be deleted");
  if (role._count.users > 0) {
    throw new BadRequestError(
      `Role still assigned to ${role._count.users} user(s); reassign them first`
    );
  }
  await db.role.delete({ where: { id: role.id } });
  await recordAuditEntry({
    actor: { id: req.ctx!.userId },
    action: "role.delete",
    entity: "Role",
    entityId: role.id,
    before: { name: role.name },
  });
  invalidateAll();
  sendOk(res, { id: role.id });
});

router.post("/:id/copy", async (req, res) => {
  const body = copyRoleSchema.parse(req.body);
  const source = await db.role.findUnique({
    where: { id: req.params.id },
    include: { rolePermissions: true },
  });
  if (!source) throw new NotFoundError("Source role not found");
  const conflict = await db.role.findFirst({ where: { name: body.name } });
  if (conflict) throw new ConflictError("Role name already in use");
  const copy = await db.role.create({
    data: {
      name: body.name,
      isSystem: false,
      rolePermissions: {
        createMany: {
          data: source.rolePermissions.map((rp) => ({ permissionId: rp.permissionId })),
        },
      },
    },
    select: listShape,
  });
  await recordAuditEntry({
    actor: { id: req.ctx!.userId },
    action: "role.create",
    entity: "Role",
    entityId: copy.id,
    after: { name: copy.name, copiedFrom: source.id },
  });
  sendOk(res, copy, undefined, 201);
});

router.put("/:id/permissions", async (req, res) => {
  const body = setRolePermissionsSchema.parse(req.body);
  const role = await db.role.findUnique({
    where: { id: req.params.id },
    include: { rolePermissions: { select: { permission: { select: { key: true } } } } },
  });
  if (!role) throw new NotFoundError("Role not found");
  if (role.isSystem) {
    throw new ForbiddenError("System role permissions are managed by the seed");
  }

  const desired = await db.permissionDef.findMany({
    where: { key: { in: body.permissionKeys } },
    select: { id: true, key: true },
  });
  const desiredIds = new Set(desired.map((p) => p.id));
  const before = role.rolePermissions.map((rp) => rp.permission.key).sort();

  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (desiredIds.size) {
      await tx.rolePermission.createMany({
        data: [...desiredIds].map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }
  });

  await recordAuditEntry({
    actor: { id: req.ctx!.userId },
    action: "role.permissions.update",
    entity: "Role",
    entityId: role.id,
    before: { permissionKeys: before },
    after: { permissionKeys: desired.map((p) => p.key).sort() },
  });
  invalidateAll();
  sendOk(res, { permissionKeys: desired.map((p) => p.key) });
});

export default router;
