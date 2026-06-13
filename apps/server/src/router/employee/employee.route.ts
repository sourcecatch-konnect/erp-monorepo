import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import {
  createEmployeeController,
  getEmployeeController,
  listEmployeesController,
  resetEmployeePasswordController,
  updateEmployeeController,
  updateEmployeeStatusController,
} from "../../controllers/employee/employee.controller.js";

const router = Router();

// Employee management is available to users with RBAC management permission.
router.use(authMiddleware, can(PERMS.ADMIN.RBAC_MANAGE));

router.post("/", createEmployeeController);
router.get("/", listEmployeesController);
router.get("/:id", getEmployeeController);
router.patch("/:id", updateEmployeeController);
router.patch("/:id/password", resetEmployeePasswordController);
router.patch("/:id/status", updateEmployeeStatusController);

export default router;
