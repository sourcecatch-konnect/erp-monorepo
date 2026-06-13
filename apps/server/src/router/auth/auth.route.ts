import { Router } from "express";
import {
  employeeLoginController,
  adminLoginController,
  logout,
  refreshTokenController,
  meController,
  webLoginController,
} from "../../controllers/auth/auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";

const router = Router();

router.post("/login", webLoginController);
router.post("/admin/login", adminLoginController);
router.post("/employee/login", employeeLoginController);

// LOGOUT (common for both)
router.post("/logout", logout);
router.post("/refresh", refreshTokenController);
router.get("/me", authMiddleware, meController);
export default router;
