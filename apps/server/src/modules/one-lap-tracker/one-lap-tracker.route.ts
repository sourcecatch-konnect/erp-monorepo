import { Router } from "express";
import { PERMS } from "@skerp/types";
import { updateOneLapTrackerSchema } from "@skerp/validators";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { ValidationError } from "../../lib/error.js";

import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";

import {
    getOneLapTracker,
    getOneLapTrackerStatusCounts,
    listOneLapTrackers,
    syncOneLapTrackers,
    updateOneLapTracker,
} from "./one-lap-tracker.service.js";

const router: Router = Router();

router.use(authMiddleware);

/* ------------------------------------------------------------------ */
/* List Tracker Master records                                        */
/* ------------------------------------------------------------------ */

router.get(
    "/",
    can(PERMS.MASTERS.ONE_LAP_TRACKER.VIEW),
    async (req, res) => {
        const query = parseListQuery(req);

        const result = await listOneLapTrackers({
            page: query.page,
            size: query.size,
            search: query.search,
        });

        return sendOk(res, result.data, {
            page: query.page,
            size: query.size,
            total: result.total,
        });
    },
);

/* ------------------------------------------------------------------ */
/* Tracker Master status counts                                       */
/* Keep static routes before /:id                                     */
/* ------------------------------------------------------------------ */

router.get(
    "/status-counts",
    can(PERMS.MASTERS.ONE_LAP_TRACKER.VIEW),
    async (_req, res) => {
        const counts = await getOneLapTrackerStatusCounts();

        return sendOk(res, counts);
    },
);

/* ------------------------------------------------------------------ */
/* Synchronize devices from OneLap                                    */
/* ------------------------------------------------------------------ */

router.post(
    "/sync",
    can(PERMS.MASTERS.ONE_LAP_TRACKER.SYNC),
    async (_req, res) => {
        const result = await syncOneLapTrackers();

        return sendOk(res, result);
    },
);

/* ------------------------------------------------------------------ */
/* Get one Tracker Master record                                      */
/* ------------------------------------------------------------------ */

router.get(
    "/:id",
    can(PERMS.MASTERS.ONE_LAP_TRACKER.VIEW),
    async (req, res) => {
        const tracker = await getOneLapTracker(
            getParamId(req),
        );

        return sendOk(res, tracker);
    },
);

/* ------------------------------------------------------------------ */
/* Enable or disable one tracker                                      */
/* ------------------------------------------------------------------ */

router.patch(
    "/:id",
    can(PERMS.MASTERS.ONE_LAP_TRACKER.UPDATE),
    async (req, res) => {
        const parsed = updateOneLapTrackerSchema.safeParse(
            req.body,
        );

        if (!parsed.success) {
            throw new ValidationError(
                parsed.error.flatten().fieldErrors,
            );
        }

        const tracker = await updateOneLapTracker(
            getParamId(req),
            parsed.data,
        );

        return sendOk(res, tracker);
    },
);

export default router;