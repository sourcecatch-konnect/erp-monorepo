import { Router } from "express";
import {
  closeJourneyLegSchema,
  dispatchJourneyLegSchema,
  cancelJourneySchema,
  closeJourneySchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { writeTripStatus } from "../trip/trip.service.js";
import {
  closeLegAndUpdateJourney,
  computeJourneyTotals,
  getHeadOffice,
  journeyInclude,
  journeyLegSelect,
  journeyListSelect,
  TX_BUDGET,
} from "./vehicle-journey.service.js";
import {
  Prisma,
  type JourneySettlementStatus,
  type VehicleJourneyStatus,
} from "../../../generated/prisma/index.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/*
 * Journeys are never created here — every trip belongs to a journey, and
 * creating a trip (POST /trips) auto-attaches it to the vehicle's active
 * journey or auto-opens a new one based at the head-office city. This router
 * covers the journey cockpit: list/detail, leg transitions, settlement.
 */

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.VEHICLE_JOURNEY.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const search = query.search;
  const status = query.filter.status;
  const settlementStatus = query.filter.settlementStatus;

  const where: Prisma.VehicleJourneyWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { journeyNumber: { contains: search, mode: "insensitive" } },
            {
              vehicle: {
                is: {
                  vehicleNumber: { contains: search, mode: "insensitive" },
                },
              },
            },
            { driver: { is: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(status
      ? {
          status: status.includes(",")
            ? { in: status.split(",") as VehicleJourneyStatus[] }
            : (status as VehicleJourneyStatus),
        }
      : {}),
    ...(settlementStatus
      ? { settlementStatus: settlementStatus as JourneySettlementStatus }
      : {}),
    ...(query.filter.vehicleId ? { vehicleId: query.filter.vehicleId } : {}),
    ...(query.filter.driverId ? { driverId: query.filter.driverId } : {}),
  };

  const [data, total] = await Promise.all([
    db.vehicleJourney.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: journeyListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.vehicleJourney.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Status counts (for cockpit tabs)                                   */
/* ------------------------------------------------------------------ */
router.get(
  "/status-counts",
  can(PERMS.VEHICLE_JOURNEY.VIEW),
  async (_req, res) => {
    const grouped = await db.vehicleJourney.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let all = 0;
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      all += g._count._all;
    }
    counts.ALL = all;
    return sendOk(res, counts);
  },
);

/* ------------------------------------------------------------------ */
/* Active journey for a vehicle (trip-form context)                   */
/* ------------------------------------------------------------------ */
router.get("/active", can(PERMS.TRIP.VIEW), async (req, res) => {
  const vehicleId =
    typeof req.query.vehicleId === "string" ? req.query.vehicleId : "";
  if (!vehicleId) throw new BadRequestError("vehicleId is required");

  const [headOffice, journey] = await Promise.all([
    getHeadOffice(),
    db.vehicleJourney.findFirst({
      where: { vehicleId, deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        journeyNumber: true,
        driverId: true,
        returnCityId: true,
        driver: { select: { name: true } },
        returnCity: { select: { name: true } },
      },
    }),
  ]);

  const lastLeg = journey
    ? await db.vehicleTrip.findFirst({
        where: {
          journeyId: journey.id,
          deletedAt: null,
          status: { not: "Cancelled" },
        },
        orderBy: { sequenceNo: "desc" },
        select: {
          id: true,
          sequenceNo: true,
          status: true,
          toCityId: true,
          closingKm: true,
          endDateTime: true,
          toCity: { select: { name: true } },
        },
      })
    : null;

  return sendOk(res, {
    headOffice,
    journey: journey
      ? {
          id: journey.id,
          journeyNumber: journey.journeyNumber,
          driverId: journey.driverId,
          driverName: journey.driver?.name ?? null,
          returnCityId: journey.returnCityId,
          returnCityName: journey.returnCity?.name ?? null,
          lastLeg: lastLeg
            ? {
                id: lastLeg.id,
                sequenceNo: lastLeg.sequenceNo,
                status: lastLeg.status,
                toCityId: lastLeg.toCityId,
                toCityName: lastLeg.toCity?.name ?? null,
                closingKm: lastLeg.closingKm,
                endDateTime: lastLeg.endDateTime,
              }
            : null,
        }
      : null,
  });
});

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.VEHICLE_JOURNEY.VIEW), async (req, res) => {
  const id = getParamId(req);
  const journey = await db.vehicleJourney.findFirst({
    where: { id, deletedAt: null },
    include: journeyInclude,
  });
  if (!journey) throw new NotFoundError("Journey not found");

  const totals = await computeJourneyTotals(db, id);
  return sendOk(res, { ...journey, totals });
});

/* ------------------------------------------------------------------ */
/* Dispatch leg -> InTransit                                          */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/dispatch-leg/:tripId",
  can(PERMS.VEHICLE_JOURNEY.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const tripId = String(req.params.tripId);
    const me = actorId(req);

    const trip = await db.vehicleTrip.findFirst({
      where: { id: tripId, journeyId: id, deletedAt: null },
      select: { id: true, status: true, startDateTime: true },
    });
    if (!trip) throw new NotFoundError("Journey leg not found");
    if (trip.status !== "Planned") {
      throw new BadRequestError("Only a Planned leg can be dispatched");
    }

    const parsed = dispatchJourneyLegSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.vehicleTrip.update({
        where: { id: tripId },
        data: {
          status: "InTransit",
          startDateTime:
            parsed.data.startDateTime ?? trip.startDateTime ?? new Date(),
          updatedById: me,
          version: { increment: 1 },
        },
        select: journeyLegSelect,
      });
      await writeTripStatus(tx, tripId, me, "InTransit", "Leg dispatched");
      return row;
    }, TX_BUDGET);

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Close leg (return-to-base detection lives in the shared helper)    */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/close-leg/:tripId",
  can(PERMS.VEHICLE_JOURNEY.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const tripId = String(req.params.tripId);
    const me = actorId(req);

    const journey = await db.vehicleJourney.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        returnCityId: true,
        vehicleId: true,
        driverId: true,
      },
    });
    if (!journey) throw new NotFoundError("Journey not found");
    if (journey.status !== "ACTIVE") {
      throw new BadRequestError("Legs can only be closed on an active journey");
    }

    const trip = await db.vehicleTrip.findFirst({
      where: { id: tripId, journeyId: id, deletedAt: null },
      select: {
        id: true,
        status: true,
        openingKm: true,
        startDateTime: true,
        toCityId: true,
      },
    });
    if (!trip) throw new NotFoundError("Journey leg not found");
    if (trip.status !== "InTransit") {
      throw new BadRequestError("Only an InTransit leg can be closed");
    }

    const parsed = closeJourneyLegSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    if (data.closingKm < trip.openingKm) {
      throw new BadRequestError(
        `Closing KM (${data.closingKm}) cannot be less than opening KM (${trip.openingKm})`,
      );
    }
    const endDateTime = data.endDateTime ?? new Date();
    if (trip.startDateTime && endDateTime <= trip.startDateTime) {
      throw new BadRequestError("End time must be after the leg's start time");
    }

    await closeLegAndUpdateJourney({
      journey,
      trip: { id: tripId, toCityId: trip.toCityId },
      closingKm: data.closingKm,
      endDateTime,
      arrivalDateTime: data.arrivalDateTime,
      unloadingCompletedAt: data.unloadingCompletedAt,
      closeReason: data.closeReason,
      actorId: me,
    });

    const updated = await db.vehicleJourney.findUnique({
      where: { id },
      include: journeyInclude,
    });
    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Mark ready for log slip (settlement review sign-off)               */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/mark-ready-for-log-slip",
  can(PERMS.VEHICLE_JOURNEY.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const me = actorId(req);

    const journey = await db.vehicleJourney.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!journey) throw new NotFoundError("Journey not found");
    if (journey.status !== "RETURNED") {
      throw new BadRequestError(
        "Only a returned journey can be marked ready for log slip",
      );
    }

    const totals = await computeJourneyTotals(db, id);
    if (totals.openLegCount > 0) {
      throw new BadRequestError(
        `${totals.openLegCount} leg(s) are still open — close them first`,
      );
    }
    if (totals.unapprovedExpenseCount > 0) {
      throw new BadRequestError(
        `${totals.unapprovedExpenseCount} expense(s) are still in draft — approve or reject them first`,
      );
    }

    const updated = await db.vehicleJourney.update({
      where: { id },
      data: {
        status: "READY_FOR_LOGSLIP",
        settlementStatus: "READY",
        updatedById: me,
        version: { increment: 1 },
      },
      include: journeyInclude,
    });
    return sendOk(res, { ...updated, totals });
  },
);

/* ------------------------------------------------------------------ */
/* Force close away from the return city (non-base closure)           */
/* ------------------------------------------------------------------ */
router.post("/:id/close", can(PERMS.VEHICLE_JOURNEY.CLOSE), async (req, res) => {
  const id = getParamId(req);
  const me = actorId(req);

  const journey = await db.vehicleJourney.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, vehicleId: true, driverId: true },
  });
  if (!journey) throw new NotFoundError("Journey not found");
  if (journey.status !== "ACTIVE") {
    throw new BadRequestError("Only an active journey can be force-closed");
  }

  const parsed = closeJourneySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const openLegs = await db.vehicleTrip.count({
    where: {
      journeyId: id,
      deletedAt: null,
      status: { notIn: ["Closed", "Cancelled"] },
    },
  });
  if (openLegs > 0) {
    throw new BadRequestError(
      `${openLegs} leg(s) are still open — close or cancel them first`,
    );
  }

  const lastClosed = await db.vehicleTrip.findFirst({
    where: { journeyId: id, deletedAt: null, status: "Closed" },
    orderBy: { sequenceNo: "desc" },
    select: { closingKm: true, endDateTime: true, toCityId: true },
  });
  if (!lastClosed) {
    throw new BadRequestError(
      "Journey has no closed legs — cancel it instead of closing",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.vehicleJourney.update({
      where: { id },
      data: {
        status: "RETURNED",
        settlementStatus: "PENDING_REVIEW",
        closingKm: lastClosed.closingKm,
        closedAt: lastClosed.endDateTime ?? new Date(),
        currentCityId: lastClosed.toCityId ?? undefined,
        closeReason: parsed.data.reason,
        updatedById: me,
        version: { increment: 1 },
      },
    });
    await tx.vehicle.update({
      where: { id: journey.vehicleId },
      data: { status: "AVAILABLE" },
    });
    await tx.driver.update({
      where: { id: journey.driverId },
      data: { status: "AVAILABLE" },
    });
  }, TX_BUDGET);

  const updated = await db.vehicleJourney.findUnique({
    where: { id },
    include: journeyInclude,
  });
  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Cancel journey                                                     */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.VEHICLE_JOURNEY.CANCEL), async (req, res) => {
  const id = getParamId(req);
  const me = actorId(req);

  const journey = await db.vehicleJourney.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, vehicleId: true, driverId: true },
  });
  if (!journey) throw new NotFoundError("Journey not found");
  if (journey.status !== "ACTIVE") {
    throw new BadRequestError("Only an active journey can be cancelled");
  }

  const parsed = cancelJourneySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const progressedLegs = await db.vehicleTrip.count({
    where: {
      journeyId: id,
      deletedAt: null,
      status: { in: ["InTransit", "Closed"] },
    },
  });
  if (progressedLegs > 0) {
    throw new BadRequestError(
      "Journey has dispatched or closed legs — close the journey instead of cancelling",
    );
  }

  const plannedLegs = await db.vehicleTrip.findMany({
    where: { journeyId: id, deletedAt: null, status: "Planned" },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    for (const leg of plannedLegs) {
      await tx.vehicleTrip.update({
        where: { id: leg.id },
        data: {
          status: "Cancelled",
          cancelReason: "Journey cancelled",
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });
      await writeTripStatus(tx, leg.id, me, "Cancelled", parsed.data.reason);
    }
    await tx.vehicleJourney.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: parsed.data.reason,
        updatedById: me,
        version: { increment: 1 },
      },
    });
    await tx.vehicle.update({
      where: { id: journey.vehicleId },
      data: { status: "AVAILABLE" },
    });
    await tx.driver.update({
      where: { id: journey.driverId },
      data: { status: "AVAILABLE" },
    });
  }, TX_BUDGET);

  const updated = await db.vehicleJourney.findUnique({
    where: { id },
    include: journeyInclude,
  });
  return sendOk(res, updated);
});

export default router;
