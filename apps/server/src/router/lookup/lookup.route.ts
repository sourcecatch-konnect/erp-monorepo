import { Router } from "express";
import {
  authMiddleware,
  requireRole,
} from "../../middlewares/auth.middlware.js";
import { ROLES } from "../../util/auth.util.js";

const router = Router();

router.use(authMiddleware, requireRole(ROLES.ADMIN));

export default router;
