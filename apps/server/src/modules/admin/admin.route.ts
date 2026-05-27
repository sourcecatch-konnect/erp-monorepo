import { Router } from "express";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { sendOk } from "../_shared/response.js";
import permissionsRoute from "./permissions.route.js";
import rolesRoute from "./roles.route.js";
import usersRoute from "./users.route.js";
import auditLogRoute from "./audit-log.route.js";

const router = Router();

router.use("/permissions", permissionsRoute);
router.use("/roles", rolesRoute);
router.use("/users", usersRoute);
router.use("/audit-log", auditLogRoute);

// Lightweight branch list for the access drawer. Same admin.rbac.manage
// gate as the rest of the RBAC surface — admins picking branches for a
// user shouldn't have to also hold masters.branch.view.
router.get(
  "/branches",
  authMiddleware,
  can(PERMS.ADMIN.RBAC_MANAGE),
  async (_req, res, next) => {
    try {
      const branches = await db.branch.findMany({
        select: { id: true, name: true, branchCode: true, shortCode: true },
        orderBy: { name: "asc" },
      });
      sendOk(res, branches);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
