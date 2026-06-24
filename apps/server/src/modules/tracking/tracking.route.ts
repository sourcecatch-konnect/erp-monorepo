import { Router } from "express";
import { PERMS } from "@skerp/types";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { sendOk } from "../_shared/response.js";
import { BadRequestError } from "../../lib/error.js";
import { getFleet, getHistory } from "./onelap.client.js";

const router: Router = Router();
router.use(authMiddleware);

/* ------------------------------------------------------------------ */
/* Live fleet — devices joined with their latest position (Onelap)    */
/* ------------------------------------------------------------------ */
router.get("/fleet", can(PERMS.TRACKING.VIEW), async (_req, res) => {
  const fleet = await getFleet();
  return sendOk(res, fleet);
});

/* ------------------------------------------------------------------ */
/* History trail — breadcrumb between two timestamps for one device   */
/* ------------------------------------------------------------------ */
router.get("/history", can(PERMS.TRACKING.VIEW), async (req, res) => {
  const deviceId = Number(req.query.deviceId);
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";

  if (!Number.isFinite(deviceId) || !from || !to) {
    throw new BadRequestError("deviceId, from and to are required");
  }

  const trail = await getHistory(deviceId, from, to);
  return sendOk(res, trail);
});

export default router;
