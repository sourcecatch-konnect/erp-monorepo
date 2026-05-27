import { Router } from "express";
import {
  authMiddleware,
  requireRole,
} from "../../middlewares/auth.middlware.js";
import { ROLES } from "../../util/auth.util.js";
import {
  listBranchesController,
  listCompaniesController,
} from "../../controllers/lookup/lookup.controller.js";

const router = Router();

router.use(authMiddleware, requireRole(ROLES.ADMIN));

// router.get("/companies", listCompaniesController);
// router.get("/branches", listBranchesController);

export default router;
