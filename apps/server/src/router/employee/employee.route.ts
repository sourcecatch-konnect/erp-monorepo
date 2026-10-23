import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import {
  createEmployeeController,
  deleteEmployeeController,
  getEmployeeController,
  listEmployeesController,
  listEmployeesPageController,
  resetEmployeePasswordController,
  updateEmployeeController,
  updateEmployeeStatusController,
} from "../../controllers/employee/employee.controller.js";

const router = Router();

// Every route, including delete, needs a signed-in user with RBAC management
// permission; the service adds self- and last-admin guards on top.
router.use(authMiddleware, can(PERMS.ADMIN.RBAC_MANAGE));

router.post("/", createEmployeeController);
router.get("/", listEmployeesController);
// Before "/:id", which would otherwise treat "page" as a user id.
router.get("/page", listEmployeesPageController);
router.get("/:id", getEmployeeController);
router.patch("/:id", updateEmployeeController);
router.patch("/:id/password", resetEmployeePasswordController);
router.patch("/:id/status", updateEmployeeStatusController);
router.delete("/:id", deleteEmployeeController);

export default router;
