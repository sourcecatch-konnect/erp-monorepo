import type {
  AssignOneLapTrackerBody,
  AvailableOneLapTracker,
  OneLapTrackerAssignmentDetail,
  ReplaceOneLapTrackerBody,
} from "@skerp/types";

import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import { calculateSignalHealth } from "./one-lap-tracker.service.js";

const assignmentInclude = {
  tracker: true,
  installedOnMrRrRow: {
    select: {
      vpNo: true,
    },
  },
  vpSchedule: {
    select: {
      id: true,
      scheduleNumber: true,
      scheduleName: true,
      status: true,
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
} as const;

type AssignmentRecord = Prisma.OneLapTrackerAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

const mapAssignment = (
  assignment: AssignmentRecord,
): OneLapTrackerAssignmentDetail => ({
  id: assignment.id,
  trackerId: assignment.trackerId,
  vpScheduleId: assignment.vpScheduleId,
  installedOnMrRrRowId: assignment.installedOnMrRrRowId,
  installedOnVpNo: assignment.installedOnMrRrRow.vpNo,
  assignedAt: assignment.assignedAt.toISOString(),
  releasedAt: assignment.releasedAt?.toISOString() ?? null,
  releaseReason: assignment.releaseReason,
  releaseRemarks: assignment.releaseRemarks,
  tracker: {
    id: assignment.tracker.id,
    oneLapDeviceId: assignment.tracker.oneLapDeviceId,
    uniqueId: assignment.tracker.uniqueId,
    name: assignment.tracker.name,
    vehicleNumber: assignment.tracker.vehicleNumber,
    providerStatus: assignment.tracker.providerStatus,
    validityAt: assignment.tracker.validityAt?.toISOString() ?? null,
    lastProviderUpdateAt:
      assignment.tracker.lastProviderUpdateAt?.toISOString() ?? null,
    signalHealth: calculateSignalHealth(
      assignment.tracker.lastProviderUpdateAt,
    ),
  },
  schedule: {
    id: assignment.vpSchedule.id,
    scheduleNumber: assignment.vpSchedule.scheduleNumber,
    scheduleName: assignment.vpSchedule.scheduleName,
    status: assignment.vpSchedule.status,
    fromBranch: assignment.vpSchedule.fromBranch,
    toBranch: assignment.vpSchedule.toBranch,
    sourceArea: assignment.vpSchedule.sourceArea,
    destinationArea: assignment.vpSchedule.destinationArea,
    railRake: assignment.vpSchedule.railRake,
  },
});

const activeAssignment = (vpScheduleId: string) =>
  db.oneLapTrackerAssignment.findFirst({
    where: {
      vpScheduleId,
      releasedAt: null,
    },
    orderBy: { assignedAt: "desc" },
    include: assignmentInclude,
  });

export const getActiveTrackerAssignment = async (
  vpScheduleId: string,
): Promise<OneLapTrackerAssignmentDetail | null> => {
  const assignment = await activeAssignment(vpScheduleId);
  return assignment ? mapAssignment(assignment) : null;
};

export const listAvailableOneLapTrackers =
  async (): Promise<AvailableOneLapTracker[]> => {
    const now = new Date();
    const trackers = await db.oneLapTracker.findMany({
      where: {
        isEnabled: true,
        isPresentOnProvider: true,
        OR: [{ validityAt: null }, { validityAt: { gte: now } }],
        assignments: {
          none: {
            releasedAt: null,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return trackers.map((tracker) => ({
      id: tracker.id,
      oneLapDeviceId: tracker.oneLapDeviceId,
      uniqueId: tracker.uniqueId,
      name: tracker.name,
      vehicleNumber: tracker.vehicleNumber,
      providerStatus: tracker.providerStatus,
      validityAt: tracker.validityAt?.toISOString() ?? null,
      lastProviderUpdateAt:
        tracker.lastProviderUpdateAt?.toISOString() ?? null,
      signalHealth: calculateSignalHealth(tracker.lastProviderUpdateAt),
    }));
  };

const validateAssignmentTarget = async (
  tx: Prisma.TransactionClient,
  vpScheduleId: string,
  installedOnMrRrRowId: string,
) => {
  const schedule = await tx.vPSchedule.findUnique({
    where: { id: vpScheduleId },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      mrRr: {
        select: {
          id: true,
          status: true,
        },
      },
      railRake: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!schedule || schedule.deletedAt) {
    throw new NotFoundError("VP Schedule not found");
  }

  if (schedule.status === "CANCELLED") {
    throw new BadRequestError("A cancelled VP Schedule cannot have a tracker");
  }

  if (
    schedule.railRake &&
    ["DISPATCHED", "UNLOADING", "RECEIVED"].includes(
      schedule.railRake.status,
    )
  ) {
    throw new BadRequestError(
      "The tracker cannot be changed after the rake journey has started",
    );
  }

  if (!schedule.mrRr || schedule.mrRr.status !== "SUBMITTED") {
    throw new BadRequestError(
      "A submitted MR/RR is required before assigning a tracker",
    );
  }

  const hostRow = await tx.mRRRRow.findFirst({
    where: {
      id: installedOnMrRrRowId,
      mrRrId: schedule.mrRr.id,
    },
    select: {
      id: true,
      vpNo: true,
    },
  });

  if (!hostRow) {
    throw new BadRequestError(
      "The selected host VP does not belong to this VP Schedule",
    );
  }

  if (!hostRow.vpNo?.trim()) {
    throw new BadRequestError("The selected host wagon does not have a VP No.");
  }

  return schedule;
};

const validateTracker = async (
  tx: Prisma.TransactionClient,
  trackerId: string,
) => {
  const tracker = await tx.oneLapTracker.findUnique({
    where: { id: trackerId },
  });

  if (!tracker) throw new NotFoundError("OneLap tracker not found");
  if (!tracker.isEnabled) {
    throw new BadRequestError("The selected tracker is disabled");
  }
  if (!tracker.isPresentOnProvider) {
    throw new BadRequestError("The selected tracker is missing from OneLap");
  }
  if (tracker.validityAt && tracker.validityAt.getTime() < Date.now()) {
    throw new BadRequestError("The selected tracker has expired");
  }

  return tracker;
};

const mapAssignmentConflict = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictError(
      "The tracker or VP Schedule was assigned by another user. Refresh and try again.",
    );
  }
  throw error;
};

export const assignOneLapTracker = async (
  vpScheduleId: string,
  body: AssignOneLapTrackerBody,
  userId: string,
): Promise<OneLapTrackerAssignmentDetail> => {
  try {
    const id = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "VPSchedule"
        WHERE "id" = ${vpScheduleId}
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT "id" FROM "OneLapTracker"
        WHERE "id" = ${body.trackerId}
        FOR UPDATE
      `;

      await validateAssignmentTarget(
        tx,
        vpScheduleId,
        body.installedOnMrRrRowId,
      );
      await validateTracker(tx, body.trackerId);

      const existingForSchedule =
        await tx.oneLapTrackerAssignment.findFirst({
          where: { vpScheduleId, releasedAt: null },
        });

      if (existingForSchedule) {
        if (
          existingForSchedule.trackerId === body.trackerId &&
          existingForSchedule.installedOnMrRrRowId ===
            body.installedOnMrRrRowId
        ) {
          return existingForSchedule.id;
        }
        throw new ConflictError(
          "This VP Schedule already has an active tracker",
        );
      }

      const existingForTracker =
        await tx.oneLapTrackerAssignment.findFirst({
          where: { trackerId: body.trackerId, releasedAt: null },
          select: {
            vpSchedule: {
              select: {
                scheduleNumber: true,
              },
            },
          },
        });

      if (existingForTracker) {
        throw new ConflictError(
          `Tracker is already assigned to ${existingForTracker.vpSchedule.scheduleNumber}`,
        );
      }

      const created = await tx.oneLapTrackerAssignment.create({
        data: {
          trackerId: body.trackerId,
          vpScheduleId,
          installedOnMrRrRowId: body.installedOnMrRrRowId,
          assignedById: userId,
        },
        select: { id: true },
      });

      return created.id;
    });

    const assignment = await db.oneLapTrackerAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundError("Tracker assignment not found");
    return mapAssignment(assignment);
  } catch (error) {
    return mapAssignmentConflict(error);
  }
};

export const replaceOneLapTracker = async (
  vpScheduleId: string,
  body: ReplaceOneLapTrackerBody,
  userId: string,
): Promise<OneLapTrackerAssignmentDetail> => {
  try {
    const assignmentId = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "VPSchedule"
        WHERE "id" = ${vpScheduleId}
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT "id" FROM "OneLapTracker"
        WHERE "id" = ${body.trackerId}
        FOR UPDATE
      `;

      await validateAssignmentTarget(
        tx,
        vpScheduleId,
        body.installedOnMrRrRowId,
      );
      await validateTracker(tx, body.trackerId);

      const current = await tx.oneLapTrackerAssignment.findFirst({
        where: { vpScheduleId, releasedAt: null },
      });
      if (!current) {
        throw new BadRequestError(
          "This VP Schedule does not have a tracker to replace",
        );
      }
      if (current.trackerId === body.trackerId) {
        throw new BadRequestError(
          "Select a different tracker for replacement",
        );
      }

      const trackerConflict = await tx.oneLapTrackerAssignment.findFirst({
        where: { trackerId: body.trackerId, releasedAt: null },
        select: {
          vpSchedule: { select: { scheduleNumber: true } },
        },
      });
      if (trackerConflict) {
        throw new ConflictError(
          `Tracker is already assigned to ${trackerConflict.vpSchedule.scheduleNumber}`,
        );
      }

      const releasedAt = new Date();
      await tx.oneLapTrackerAssignment.update({
        where: { id: current.id },
        data: {
          releasedAt,
          releasedById: userId,
          releaseReason: "TRACKER_REPLACED",
          releaseRemarks: body.reason,
        },
      });

      const created = await tx.oneLapTrackerAssignment.create({
        data: {
          trackerId: body.trackerId,
          vpScheduleId,
          installedOnMrRrRowId: body.installedOnMrRrRowId,
          assignedById: userId,
        },
        select: { id: true },
      });
      return created.id;
    });

    const assignment = await db.oneLapTrackerAssignment.findUnique({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundError("Tracker assignment not found");
    return mapAssignment(assignment);
  } catch (error) {
    return mapAssignmentConflict(error);
  }
};

export const releaseOneLapTracker = async (
  vpScheduleId: string,
  reason: string,
  userId: string,
): Promise<OneLapTrackerAssignmentDetail> => {
  const assignmentId = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "VPSchedule"
      WHERE "id" = ${vpScheduleId}
      FOR UPDATE
    `;

    const schedule = await tx.vPSchedule.findUnique({
      where: { id: vpScheduleId },
      select: {
        railRake: { select: { status: true } },
      },
    });
    if (!schedule) throw new NotFoundError("VP Schedule not found");
    if (
      schedule.railRake &&
      ["DISPATCHED", "UNLOADING"].includes(schedule.railRake.status)
    ) {
      throw new BadRequestError(
        "Replace the tracker instead of releasing it during an active journey",
      );
    }

    const current = await tx.oneLapTrackerAssignment.findFirst({
      where: { vpScheduleId, releasedAt: null },
    });
    if (!current) {
      throw new BadRequestError("This VP Schedule has no active tracker");
    }

    await tx.oneLapTrackerAssignment.update({
      where: { id: current.id },
      data: {
        releasedAt: new Date(),
        releasedById: userId,
        releaseReason: "MANUAL_RELEASE",
        releaseRemarks: reason,
      },
    });
    return current.id;
  });

  const assignment = await db.oneLapTrackerAssignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });
  if (!assignment) throw new NotFoundError("Tracker assignment not found");
  return mapAssignment(assignment);
};

export const releaseActiveTrackerInTransaction = async (
  tx: Prisma.TransactionClient,
  vpScheduleId: string,
  input: {
    userId?: string;
    reason: "RAKE_RECEIVED" | "SCHEDULE_CANCELLED";
    remarks?: string;
    releasedAt?: Date;
  },
) =>
  tx.oneLapTrackerAssignment.updateMany({
    where: {
      vpScheduleId,
      releasedAt: null,
    },
    data: {
      releasedAt: input.releasedAt ?? new Date(),
      releasedById: input.userId ?? null,
      releaseReason: input.reason,
      releaseRemarks: input.remarks ?? null,
    },
  });
