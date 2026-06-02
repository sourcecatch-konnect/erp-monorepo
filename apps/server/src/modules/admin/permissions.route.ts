import { Router } from "express";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { ensurePermissionCatalog } from "../../auth/permission-catalog.js";
import { sendOk } from "../_shared/response.js";

const router = Router();
router.use(authMiddleware);

router.get("/", can(PERMS.ADMIN.RBAC_MANAGE), async (_req, res) => {
  await ensurePermissionCatalog();
  const rows = await db.permissionDef.findMany({
    orderBy: [{ moduleCode: "asc" }, { key: "asc" }],
  });
  sendOk(res, rows);
});

export default router;
