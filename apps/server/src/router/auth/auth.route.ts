import { Router } from "express";
import { employeeLoginController, adminLoginController, logout } from "../../controllers/auth/auth.controller.js";

const router = Router();

router.post("/admin/login", adminLoginController);
router.post("/employee/login", employeeLoginController);

// LOGOUT (common for both)
router.post("/logout", logout);
export default router;