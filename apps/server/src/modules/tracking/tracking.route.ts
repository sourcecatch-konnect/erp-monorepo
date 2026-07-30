import { Router } from "express";
import { PERMS } from "@skerp/types";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { sendOk } from "../_shared/response.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../lib/error.js";
import { getFleet, getHistory } from "./onelap.client.js";
import { db } from "../../../prisma/prisma.js";

const router: Router = Router();
router.use(authMiddleware);

/* ------------------------------------------------------------------ */
/* Live fleet — devices joined with their latest position (Onelap)    */
/* ------------------------------------------------------------------ */
router.get("/fleet", can(PERMS.TRACKING.VIEW), async (_req, res) => {
  const [oneLapFleet, assignments] = await Promise.all([
    getFleet(),
    db.oneLapTrackerAssignment.findMany({
      where: { releasedAt: null },
      orderBy: { assignedAt: "desc" },
      include: {
        tracker: true,
        installedOnMrRrRow: {
          select: { vpNo: true },
        },
        vpSchedule: {
          select: {
            id: true,
            scheduleNumber: true,
            scheduleName: true,
            mrRr: {
              select: { mrRrNumber: true },
            },
            fromBranch: { select: { id: true, name: true } },
            toBranch: { select: { id: true, name: true } },
            sourceArea: { select: { id: true, name: true } },
            destinationArea: { select: { id: true, name: true } },
            railRake: {
              select: {
                id: true,
                rakeNumber: true,
                status: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const liveByDeviceId = new Map(
    oneLapFleet.map((device) => [device.id, device]),
  );

  const fleet = assignments.map((assignment) => {
    const live = liveByDeviceId.get(assignment.tracker.oneLapDeviceId);
    return {
      id: assignment.tracker.oneLapDeviceId,
      name: assignment.tracker.name,
      uniqueId: assignment.tracker.uniqueId,
      status: live?.status ?? "unknown",
      lastUpdate:
        live?.lastUpdate ??
        assignment.tracker.lastProviderUpdateAt?.toISOString() ??
        null,
      battery: live?.battery ?? null,
      vehicleNumber:
        assignment.tracker.vehicleNumber ?? live?.vehicleNumber ?? null,
      phone: assignment.tracker.phone,
      validity:
        live?.validity ??
        assignment.tracker.validityAt?.toISOString() ??
        null,
      position: live?.position ?? null,
      assignment: {
        id: assignment.id,
        vpScheduleId: assignment.vpScheduleId,
        scheduleNumber: assignment.vpSchedule.scheduleNumber,
        scheduleName: assignment.vpSchedule.scheduleName,
        installedOnMrRrRowId: assignment.installedOnMrRrRowId,
        installedOnVpNo: assignment.installedOnMrRrRow.vpNo,
        mrRrNumber: assignment.vpSchedule.mrRr?.mrRrNumber ?? null,
        assignedAt: assignment.assignedAt.toISOString(),
        releasedAt: null,
        rake: assignment.vpSchedule.railRake,
        route: {
          fromBranch: assignment.vpSchedule.fromBranch,
          toBranch: assignment.vpSchedule.toBranch,
          sourceArea: assignment.vpSchedule.sourceArea,
          destinationArea: assignment.vpSchedule.destinationArea,
        },
      },
    };
  });

  return sendOk(res, fleet);
});

/* ------------------------------------------------------------------ */
/* History trail — breadcrumb between two timestamps for one device   */
/* ------------------------------------------------------------------ */
router.get("/history", can(PERMS.TRACKING.VIEW), async (req, res) => {
  const assignmentId =
    typeof req.query.assignmentId === "string"
      ? req.query.assignmentId.trim()
      : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";

  if (!assignmentId || !from || !to) {
    throw new BadRequestError("assignmentId, from and to are required");
  }

  const assignment = await db.oneLapTrackerAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      assignedAt: true,
      releasedAt: true,
      tracker: { select: { oneLapDeviceId: true } },
    },
  });
  if (!assignment) {
    throw new NotFoundError("Tracker assignment not found");
  }

  const requestedFrom = new Date(from);
  const requestedTo = new Date(to);
  if (
    Number.isNaN(requestedFrom.getTime()) ||
    Number.isNaN(requestedTo.getTime()) ||
    requestedFrom >= requestedTo
  ) {
    throw new BadRequestError("A valid history time range is required");
  }

  const effectiveFrom = new Date(
    Math.max(requestedFrom.getTime(), assignment.assignedAt.getTime()),
  );
  const effectiveTo = new Date(
    Math.min(
      requestedTo.getTime(),
      assignment.releasedAt?.getTime() ?? Date.now(),
    ),
  );

  if (effectiveFrom >= effectiveTo) {
    return sendOk(res, []);
  }

  const trail = await getHistory(
    assignment.tracker.oneLapDeviceId,
    effectiveFrom.toISOString(),
    effectiveTo.toISOString(),
  );
  return sendOk(res, trail);
});

export default router;
