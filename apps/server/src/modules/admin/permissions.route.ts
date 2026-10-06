import { Router } from "express";
import { ValidationError } from "../../lib/error.js";
import { permissionPageQuerySchema } from "@skerp/validators";
import { permissionAreaLabel } from "@skerp/types";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { permissionPageOptions } from "./permission-page.query.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";

import { sendOk } from "../_shared/response.js";

const router = Router();
router.use(authMiddleware);
router.get("/modules", async (_req, res) => {
  const modules = await db.permissionDef.groupBy({
    by: ["moduleCode"],
    _count: {
      key: true,
    },
    orderBy: {
      moduleCode: "asc",
    },
  });

  sendOk(
    res,
    modules.map((m) => ({
      moduleCode: m.moduleCode,
      label: permissionAreaLabel(m.moduleCode),
      permissionCount: m._count.key,
    })),
  );
});
router.get("/page", can(PERMS.ADMIN.RBAC_MANAGE), async (req, res) => {
  const parsed = permissionPageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.flatten().fieldErrors,
      "Check the permission filters and try again.",
    );
  }
  const query = parsed.data;
  const options = permissionPageOptions(query);
  const [permissions, total] = await Promise.all([
    db.permissionDef.findMany({
      ...options,
      select: {
        key: true,
        moduleCode: true,
        rolePermissions: {
          where: { roleId: query.roleId ?? "" },
          select: { roleId: true },
        },
      },
    }),
    db.permissionDef.count({ where: options.where }),
  ]);
  sendOk(
    res,
    permissions.map(({ rolePermissions, ...permission }) => ({
      ...permission,
      roleAllowed: rolePermissions.length > 0,
    })),
    { total, page: query.page, size: query.size },
  );
});
router.get("/", async (req, res) => {
  const moduleCode = req.query.moduleCode as string | undefined;

  const permissions = await db.permissionDef.findMany({
    where: moduleCode
      ? moduleCode === "masters"
        ? { moduleCode: { startsWith: "masters." } }
        : { moduleCode }
      : undefined,
    orderBy: { key: "asc" },
    select: {
      key: true,
      moduleCode: true,
    },
  });

  sendOk(res, permissions);
});
export default router;
