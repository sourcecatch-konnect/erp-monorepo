import { Router } from "express";
import { z } from "zod";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { sendOk } from "../_shared/response.js";

const router = Router();
router.use(authMiddleware);
router.use(can(PERMS.ADMIN.AUDIT_LOG_VIEW));

const querySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(50),
});

router.get("/", async (req, res) => {
  const q = querySchema.parse(req.query);
  const where = {
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.action ? { action: q.action } : {}),
  };
  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.size,
      skip: (q.page - 1) * q.size,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
  ]);
  sendOk(res, items, { total, page: q.page, size: q.size });
});

export default router;
