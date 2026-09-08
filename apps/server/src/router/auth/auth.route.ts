import { Router, type Request } from "express";
import {
  employeeLoginController,
  adminLoginController,
  logout,
  refreshTokenController,
  meController,
  webLoginController,
  forgotPasswordController,
  resetPasswordController,
} from "../../controllers/auth/auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import {
  clientIp,
  rateLimit,
} from "../../middlewares/rate-limit.middleware.js";

const router = Router();

router.post("/login", webLoginController);
router.post("/admin/login", adminLoginController);
router.post("/employee/login", employeeLoginController);

// FORGOT PASSWORD
// Per (IP + email): 3 requests / 15 min. After the window elapses the caller
// can try again — the wait is returned in the `Retry-After` header.
const emailKey = (req: Request) =>
  `${clientIp(req)}:${String(req.body?.email ?? "").trim().toLowerCase()}`;

router.post(
  "/forgot-password",
  rateLimit({
    name: "forgot-password",
    windowMs: 15 * 60 * 1000,
    max: 3,
    key: emailKey,
  }),
  forgotPasswordController,
);

// RESET PASSWORD
// Per IP: 10 attempts / 15 min — slows token guessing (tokens are 256-bit, so
// this is defence in depth, not the primary guard).
router.post(
  "/reset-password",
  rateLimit({
    name: "reset-password",
    windowMs: 15 * 60 * 1000,
    max: 10,
    key: clientIp,
  }),
  resetPasswordController,
);

// LOGOUT (common for both)
router.post("/logout", logout);
router.post("/refresh", refreshTokenController);
router.get("/me", authMiddleware, meController);
export default router;
