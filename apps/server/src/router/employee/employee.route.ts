import { Router } from "express";
import {
  authMiddleware,
  requireRole,
} from "../../middlewares/auth.middlware.js";
import { ROLES } from "../../util/auth.util.js";
import {
  createEmployeeController,
  getEmployeeController,
  listEmployeesController,
  resetEmployeePasswordController,
  updateEmployeeController,
  updateEmployeeStatusController,
} from "../../controllers/employee/employee.controller.js";

const router = Router();

// Every employee-management route is admin-only.
router.use(authMiddleware, requireRole(ROLES.ADMIN));

router.post("/", createEmployeeController);
router.get("/", listEmployeesController);
router.get("/:id", getEmployeeController);
router.patch("/:id", updateEmployeeController);
router.patch("/:id/password", resetEmployeePasswordController);
router.patch("/:id/status", updateEmployeeStatusController);

export default router;
