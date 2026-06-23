import { Router } from "express";
import { PERMS } from "@skerp/types";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { sendOk } from "../_shared/response.js";
import { getFleet } from "./onelap.client.js";

const router: Router = Router();
router.use(authMiddleware);

/* ------------------------------------------------------------------ */
/* Live fleet — devices joined with their latest position (Onelap)    */
/* ------------------------------------------------------------------ */
router.get("/fleet", can(PERMS.TRACKING.VIEW), async (_req, res) => {
  const fleet = await getFleet();
  return sendOk(res, fleet);
});

export default router;
