import { Router } from "express";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";

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
      label: m.moduleCode
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[\s._:-]+/)
        .filter(Boolean)
        .map(
          (word) =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" "),
      permissionCount: m._count.key,
    }))
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
