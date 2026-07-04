import { Router } from "express";
import {
  createTripSchema,
  updateTripSchema,
  closeTripSchema,
  cancelTripSchema,
  closeJourneyLegSchema,
  dispatchJourneyLegSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import {
  fyCodeFor,
  nextSequence,
  formatDocNumber,
} from "../_shared/doc-number.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import {
  buildTripName,
  tripInclude,
  tripListSelect,
  writeTripStatus,
} from "./trip.service.js";
import {
  chainViolations,
  closeLegAndUpdateJourney,
  getHeadOffice,
  TX_BUDGET,
} from "../vehicle-journey/vehicle-journey.service.js";
import {
  Prisma,
  TripStatus,
  TripType,
  type TripLegType,
} from "../../../generated/prisma/index.js";
import { buildTripPdfDocument, tripPdfInclude } from "./trip.pdf.js";
import { generatePdfBuffer } from "../../templetes/pdf/pdf.genertaor..js";
import type { Request, Response } from "express";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* Trips are not branch-scoped — a single global per-FY counter. */
const TRIP_SEQ_KEY = "TRIP";
/* Journeys share the same global-per-FY numbering style. */
const JOURNEY_SEQ_KEY = "JRN";

/** Every trip is a journey leg; its leg type derives from the trip fields. */
const legTypeFor = (data: {
  isTripEmpty: boolean;
  tripType: "lr" | "dc";
}): TripLegType =>
  data.isTripEmpty ? "EMPTY" : data.tripType === "dc" ? "DC" : "LR";

/**
 * Chain breaks are allowed only with an explicit reason and the
 * chain-override permission. Returns the reason to persist (null when the
 * chain is intact).
 */
const requireOverrideForViolations = (
  req: { ctx?: { permissions: Set<string> } },
  violations: string[],
  reason: string | undefined,
): string | null => {
  if (violations.length === 0) return null;
  if (!reason) {
    throw new BadRequestError(
      `Trip breaks journey continuity: ${violations.join("; ")}. Provide an exception reason to override.`,
      "CHAIN_VIOLATION",
    );
  }
  if (!req.ctx!.permissions.has(PERMS.VEHICLE_JOURNEY.OVERRIDE_CHAIN)) {
    throw new ForbiddenError(
      "You need the chain-override permission to break journey continuity",
    );
  }
  return reason;
};

/**
 * Validate the trip's vehicle/route/client and build its auto name plus the
 * journey-leg context (route city ids, vehicle state). Pure reads — run
 * before any transaction opens.
 * `at` is the timestamp baked into the name (creation time; preserved on edit).
 */
async function resolveTripContext(
  data: {
    vehicleId: string;
    routeId: string;
    tripType: "lr" | "dc";
    consignorId?: string;
    rakeDate?: Date;
  },
  at: Date,
) {
  const [vehicle, route] = await Promise.all([
    db.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: {
        id: true,
        vehicleNumber: true,
        ownershipType: true,
        status: true,
        currentKM: true,
        insuranceDueDate: true,
      },
    }),
    db.route.findUnique({
      where: { id: data.routeId },
      select: {
        id: true,
        sourceCityId: true,
        destinationCityId: true,
        sourceCity: { select: { id: true, name: true } },
        destinationCity: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!vehicle) throw new BadRequestError("Vehicle not found");
  if (vehicle.ownershipType !== "Own_Vehicle") {
    throw new BadRequestError("Trips can only be created for own vehicles");
  }
  if (!route) throw new BadRequestError("Route not found");

  // LR trips carry one client; DC trips are identified by their rake.
  let consignorId: string | null = null;
  let shortCode: string | null = null;
  let consignorName: string | null = null;
  if (data.tripType === "lr") {
    const consignor = await db.customer.findUnique({
      where: { id: data.consignorId! },
      select: { shortName: true, name: true },
    });
    if (!consignor) throw new BadRequestError("Client not found");
    consignorId = data.consignorId!;
    shortCode = consignor.shortName;
    consignorName = consignor.name;
  }

  const tripName = buildTripName({
    fromCity: route.sourceCity.name,
    toCity: route.destinationCity.name,
    truckNumber: vehicle.vehicleNumber,
    tripType: data.tripType,
    customerShortCode: shortCode,
    consignorName: consignorName,
    rakeDate: data.rakeDate ?? null,
    at,
  });

  return { vehicle, route, tripName, consignorId };
}

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.TRIP.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const search = query.search;
  const status = query.filter.status;

  const where: Prisma.VehicleTripWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            {
              tripNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              tripName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              vehicle: {
                is: {
                  vehicleNumber: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),

    ...(status
      ? {
          status: status.includes(",")
            ? { in: status.split(",") as TripStatus[] }
            : (status as TripStatus),
        }
      : {}),
    // Trips an LR can attach to (for the LR trip picker). One trip = one LR
    // (full load), so only Planned trips with no live LR are attachable.
    ...(query.filter.unattached === "true"
      ? {
          status: "Planned",
          primaryGroups: {
            none: { deletedAt: null, status: { not: "CANCELLED" } },
          },
          secondaryGroups: {
            none: { deletedAt: null, status: { not: "CANCELLED" } },
          },
        }
      : {}),
    ...(query.filter.tripType
      ? { tripType: query.filter.tripType as TripType }
      : {}),
    ...(query.filter.journeyId ? { journeyId: query.filter.journeyId } : {}),
  };
  const [data, total] = await Promise.all([
    db.vehicleTrip.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: tripListSelect,
      orderBy: query.sort
        ? { [query.sort.field]: query.sort.direction }
        : { createdAt: "desc" },
    }),
    db.vehicleTrip.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Status counts (for list tabs)                                      */
/* ------------------------------------------------------------------ */
router.get("/status-counts", can(PERMS.TRIP.VIEW), async (_req, res) => {
  const grouped = await db.vehicleTrip.groupBy({
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
});

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.TRIP.VIEW), async (req, res) => {
  const id = getParamId(req);
  const trip = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
    include: tripInclude,
  });
  if (!trip) throw new NotFoundError("Trip not found");
  return sendOk(res, trip);
});

/* ------------------------------------------------------------------ */
/* Trip PDF                                                           */
/* ------------------------------------------------------------------ */
router.get(
  "/:id/pdf",
  can(PERMS.TRIP.VIEW),
  async (req: Request<{ id: string }>, res: Response) => {
    const id = getParamId(req);
    const trip = await db.vehicleTrip.findFirst({
      where: { id, deletedAt: null },
      include: tripPdfInclude,
    });
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const pdfDoc = buildTripPdfDocument(trip);
    const buffer = await generatePdfBuffer(pdfDoc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="trip-${trip.tripNumber}.pdf"`,
    );
    return res.send(buffer);
  },
);

/* ------------------------------------------------------------------ */
/* Create -> Planned                                                  */
/*                                                                    */
/* Every trip belongs to a vehicle journey (universal rule). Creating */
/* a trip attaches it as the next leg of the vehicle's ACTIVE journey */
/* or auto-opens a new journey based at the head-office city.         */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.TRIP.CREATE), async (req, res) => {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);
  const now = new Date();

  const { vehicle, route, tripName, consignorId } = await resolveTripContext(
    data,
    now,
  );
  const legType = legTypeFor(data);

  const activeJourney = await db.vehicleJourney.findFirst({
    where: { vehicleId: data.vehicleId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      journeyNumber: true,
      fyCode: true,
      driverId: true,
      returnCityId: true,
      driver: { select: { name: true } },
    },
  });

  let tripId: string;

  if (activeJourney) {
    /* ---- attach as the next leg of the open journey ---- */
    if (data.driverId !== activeJourney.driverId) {
      throw new BadRequestError(
        `This vehicle is on journey ${activeJourney.journeyNumber} with driver ${activeJourney.driver.name} — the trip must use the journey's driver`,
      );
    }

    // Cancelled legs keep their sequence slot, so number from the overall max
    // but validate the chain against the last non-cancelled leg.
    const [maxSeqLeg, prevLeg] = await Promise.all([
      db.vehicleTrip.findFirst({
        where: { journeyId: activeJourney.id, deletedAt: null },
        orderBy: { sequenceNo: "desc" },
        select: { sequenceNo: true },
      }),
      db.vehicleTrip.findFirst({
        where: {
          journeyId: activeJourney.id,
          deletedAt: null,
          status: { not: "Cancelled" },
        },
        orderBy: { sequenceNo: "desc" },
        select: {
          tripNumber: true,
          sequenceNo: true,
          status: true,
          toCityId: true,
          closingKm: true,
          endDateTime: true,
          toCity: { select: { name: true } },
        },
      }),
    ]);

    if (prevLeg && prevLeg.status !== "Closed") {
      throw new BadRequestError(
        `Close the current leg (${prevLeg.tripNumber}) before adding the next one`,
      );
    }

    const violations = prevLeg
      ? chainViolations(
          {
            sequenceNo: prevLeg.sequenceNo,
            toCityId: prevLeg.toCityId,
            toCityName: prevLeg.toCity?.name ?? null,
            closingKm: prevLeg.closingKm,
            endDateTime: prevLeg.endDateTime,
          },
          {
            fromCityId: route.sourceCityId,
            fromCityName: route.sourceCity.name,
            openingKm: data.openingKm,
          },
        )
      : [];
    const exceptionReason = requireOverrideForViolations(
      req,
      violations,
      data.chainExceptionReason,
    );

    const tripSeq = await nextSequence(
      db,
      TRIP_SEQ_KEY,
      activeJourney.fyCode,
      "TRIP",
    );
    const tripNumber = formatDocNumber(
      TRIP_SEQ_KEY,
      activeJourney.fyCode,
      tripSeq,
      "SKV",
    );
    const sequenceNo = (maxSeqLeg?.sequenceNo ?? 0) + 1;

    tripId = await db.$transaction(async (tx) => {
      const created = await tx.vehicleTrip.create({
        data: {
          tripNumber,
          tripName,
          status: "Planned",
          tripType: data.tripType,
          legType,
          journeyId: activeJourney.id,
          sequenceNo,
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          routeId: data.routeId,
          consignorId,
          fromCityId: route.sourceCityId,
          toCityId: route.destinationCityId,
          isReturnLeg: route.destinationCityId === activeJourney.returnCityId,
          onwardFreight: data.onwardFreight,
          openingKm: data.openingKm,
          isTripEmpty: data.isTripEmpty,
          rakeDate: data.tripType === "dc" ? (data.rakeDate ?? null) : null,
          chainExceptionReason: exceptionReason,
          fyCode: activeJourney.fyCode,
          createdById: me,
        },
        select: { id: true },
      });
      await tx.vehicleJourney.update({
        where: { id: activeJourney.id },
        data: { updatedById: me, version: { increment: 1 } },
      });
      await writeTripStatus(
        tx,
        created.id,
        me,
        "Planned",
        `Journey leg ${sequenceNo} created`,
      );
      return created.id;
    }, TX_BUDGET);
  } else {
    /* ---- no open journey: auto-open one based at head office ---- */
    const [driver, ho] = await Promise.all([
      db.driver.findUnique({
        where: { id: data.driverId },
        select: {
          id: true,
          name: true,
          status: true,
          blackListed: true,
          onLeave: true,
        },
      }),
      getHeadOffice(),
    ]);

    if (vehicle.status !== "AVAILABLE") {
      throw new BadRequestError("Vehicle is not available (already on trip)");
    }
    if (vehicle.insuranceDueDate && vehicle.insuranceDueDate < now) {
      throw new BadRequestError(
        `Vehicle insurance expired on ${vehicle.insuranceDueDate.toISOString().slice(0, 10)}`,
      );
    }
    if (!driver) throw new BadRequestError("Driver not found");
    if (driver.blackListed) throw new BadRequestError("Driver is blacklisted");
    if (driver.onLeave) throw new BadRequestError("Driver is on leave");
    if (driver.status !== "AVAILABLE") {
      throw new BadRequestError("Driver is already assigned to a trip");
    }
    if (data.openingKm < vehicle.currentKM) {
      throw new BadRequestError(
        `Opening KM (${data.openingKm}) is below the vehicle's current KM (${vehicle.currentKM})`,
      );
    }

    const driverJourneyClash = await db.vehicleJourney.findFirst({
      where: { driverId: data.driverId, deletedAt: null, status: "ACTIVE" },
      select: { journeyNumber: true },
    });
    if (driverJourneyClash) {
      throw new BadRequestError(
        `Driver already has an open journey (${driverJourneyClash.journeyNumber})`,
      );
    }

    // Journeys universally start from the head-office base; starting
    // elsewhere is the leg-1 chain exception (reason + override permission).
    const hoViolations =
      route.sourceCityId === ho.cityId
        ? []
        : [
            `Journey starts from ${route.sourceCity.name} instead of the head-office base (${ho.cityName})`,
          ];
    const exceptionReason = requireOverrideForViolations(
      req,
      hoViolations,
      data.chainExceptionReason,
    );

    /* ---- number reservation (gap-tolerant, outside the transaction) ---- */
    const fyCode = fyCodeFor(now);
    const journeySeq = await nextSequence(db, JOURNEY_SEQ_KEY, fyCode, "JOURNEY");
    const tripSeq = await nextSequence(db, TRIP_SEQ_KEY, fyCode, "TRIP");
    const journeyNumber = formatDocNumber(
      JOURNEY_SEQ_KEY,
      fyCode,
      journeySeq,
      "SKJ",
    );
    const tripNumber = formatDocNumber(TRIP_SEQ_KEY, fyCode, tripSeq, "SKV");

    tripId = await db.$transaction(async (tx) => {
      const journey = await tx.vehicleJourney.create({
        data: {
          journeyNumber,
          fyCode,
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          homeBranchId: ho.branchId,
          startCityId: route.sourceCityId,
          returnCityId: ho.cityId,
          currentCityId: route.sourceCityId,
          openingKm: data.openingKm,
          startedAt: now,
          status: "ACTIVE",
          settlementStatus: "NOT_READY",
          createdById: me,
        },
        select: { id: true },
      });

      const created = await tx.vehicleTrip.create({
        data: {
          tripNumber,
          tripName,
          status: "Planned",
          tripType: data.tripType,
          legType,
          journeyId: journey.id,
          sequenceNo: 1,
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          routeId: data.routeId,
          consignorId,
          fromCityId: route.sourceCityId,
          toCityId: route.destinationCityId,
          isReturnLeg: route.destinationCityId === ho.cityId,
          onwardFreight: data.onwardFreight,
          openingKm: data.openingKm,
          isTripEmpty: data.isTripEmpty,
          rakeDate: data.tripType === "dc" ? (data.rakeDate ?? null) : null,
          chainExceptionReason: exceptionReason,
          fyCode,
          createdById: me,
        },
        select: { id: true },
      });

      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: { status: "ON_TRIP" },
      });
      await tx.driver.update({
        where: { id: data.driverId },
        data: { status: "ON_TRIP" },
      });
      await writeTripStatus(
        tx,
        created.id,
        me,
        "Planned",
        `Journey ${journeyNumber} opened — leg 1 created`,
      );
      return created.id;
    }, TX_BUDGET);
  }

  const trip = await db.vehicleTrip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  return sendOk(res, trip, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Edit (Planned only)                                                */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.TRIP.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
    include: {
      journey: {
        select: { id: true, journeyNumber: true, returnCityId: true },
      },
    },
  });
  if (!existing) throw new NotFoundError("Trip not found");

  const clientVersion =
    typeof req.body?.version === "number" ? req.body.version : undefined;
  if (clientVersion !== undefined && clientVersion !== existing.version) {
    throw new ConflictError(
      "This trip changed in another tab — reload and retry",
    );
  }

  if (existing.status !== "Planned") {
    throw new BadRequestError("Only a Planned trip can be edited");
  }

  const parsed = updateTripSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);

  // A leg cannot switch vehicle or driver — that would tear it out of its
  // journey. Cancel the trip and create a new one instead.
  if (existing.journeyId) {
    if (data.vehicleId !== existing.vehicleId) {
      throw new BadRequestError(
        "A journey leg cannot change vehicle — cancel the trip and create a new one",
      );
    }
    if (data.driverId !== existing.driverId) {
      throw new BadRequestError(
        "A journey leg cannot change driver — the journey's driver stays for the whole cycle",
      );
    }
  }

  // Keep the original creation timestamp in the regenerated name.
  const { route, tripName, consignorId } = await resolveTripContext(
    data,
    existing.createdAt,
  );

  let exceptionReason: string | null = null;
  const isFirstLeg = existing.journeyId !== null && existing.sequenceNo === 1;

  if (existing.journeyId) {
    // Re-run the continuity rules against the leg's position in the chain.
    const prevLeg = await db.vehicleTrip.findFirst({
      where: {
        journeyId: existing.journeyId,
        deletedAt: null,
        status: { not: "Cancelled" },
        sequenceNo: { lt: existing.sequenceNo! },
      },
      orderBy: { sequenceNo: "desc" },
      select: {
        sequenceNo: true,
        toCityId: true,
        closingKm: true,
        endDateTime: true,
        toCity: { select: { name: true } },
      },
    });

    let violations: string[];
    if (prevLeg) {
      violations = chainViolations(
        {
          sequenceNo: prevLeg.sequenceNo,
          toCityId: prevLeg.toCityId,
          toCityName: prevLeg.toCity?.name ?? null,
          closingKm: prevLeg.closingKm,
          endDateTime: prevLeg.endDateTime,
        },
        {
          fromCityId: route.sourceCityId,
          fromCityName: route.sourceCity.name,
          openingKm: data.openingKm,
        },
      );
    } else {
      // First leg — the journey-start rule applies (head-office base).
      const ho = await getHeadOffice();
      violations =
        route.sourceCityId === ho.cityId
          ? []
          : [
              `Journey starts from ${route.sourceCity.name} instead of the head-office base (${ho.cityName})`,
            ];
    }
    exceptionReason = requireOverrideForViolations(
      req,
      violations,
      data.chainExceptionReason,
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.vehicleTrip.update({
      where: { id },
      data: {
        tripName,
        tripType: data.tripType,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        routeId: data.routeId,
        consignorId,
        onwardFreight: data.onwardFreight,
        openingKm: data.openingKm,
        isTripEmpty: data.isTripEmpty,
        rakeDate: data.tripType === "dc" ? (data.rakeDate ?? null) : null,
        ...(existing.journeyId
          ? {
              legType: legTypeFor(data),
              fromCityId: route.sourceCityId,
              toCityId: route.destinationCityId,
              isReturnLeg:
                route.destinationCityId === existing.journey!.returnCityId,
              chainExceptionReason: exceptionReason,
            }
          : {}),
        updatedById: me,
        version: { increment: 1 },
      },
      select: { id: true },
    });

    // Editing leg 1 moves the journey's starting point with it.
    if (isFirstLeg) {
      await tx.vehicleJourney.update({
        where: { id: existing.journeyId! },
        data: {
          startCityId: route.sourceCityId,
          currentCityId: route.sourceCityId,
          openingKm: data.openingKm,
          updatedById: me,
          version: { increment: 1 },
        },
      });
    } else if (existing.journeyId) {
      await tx.vehicleJourney.update({
        where: { id: existing.journeyId },
        data: { updatedById: me, version: { increment: 1 } },
      });
    }
    return row;
  }, TX_BUDGET);

  const trip = await db.vehicleTrip.findUnique({
    where: { id: updated.id },
    include: tripInclude,
  });
  return sendOk(res, trip);
});

/* ------------------------------------------------------------------ */
/* Dispatch -> InTransit                                              */
/* ------------------------------------------------------------------ */
router.post("/:id/dispatch", can(PERMS.TRIP.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, startDateTime: true, vehicleId: true },
  });
  if (!existing) throw new NotFoundError("Trip not found");
  if (existing.status !== "Planned") {
    throw new BadRequestError("Only a Planned trip can be dispatched");
  }

  const parsed = dispatchJourneyLegSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.vehicleTrip.update({
      where: { id },
      data: {
        status: "InTransit",
        startDateTime:
          parsed.data.startDateTime ?? existing.startDateTime ?? new Date(),
        updatedById: me,
        version: { increment: 1 },
      },
      select: { id: true },
    });
    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: { status: "ON_TRIP" },
    });
    await writeTripStatus(tx, id, me, "InTransit", "Trip dispatched");
    return row;
  }, TX_BUDGET);

  const trip = await db.vehicleTrip.findUnique({
    where: { id: updated.id },
    include: tripInclude,
  });
  return sendOk(res, trip);
});

/* ------------------------------------------------------------------ */
/* Close -> Closed                                                    */
/* ------------------------------------------------------------------ */
router.post("/:id/close", can(PERMS.TRIP.CLOSE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Trip not found");

  if (existing.status !== "InTransit") {
    throw new BadRequestError("Only an InTransit trip can be closed");
  }
  const me = actorId(req);

  if (existing.journeyId) {
    /* ---- journey leg: one shared close path ---- */
    const journey = await db.vehicleJourney.findFirst({
      where: { id: existing.journeyId, deletedAt: null },
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

    const parsed = closeJourneyLegSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    if (data.closingKm < existing.openingKm) {
      throw new BadRequestError(
        `Closing KM (${data.closingKm}) cannot be less than opening KM (${existing.openingKm})`,
      );
    }
    const endDateTime = data.endDateTime ?? new Date();
    if (existing.startDateTime && endDateTime <= existing.startDateTime) {
      throw new BadRequestError("End time must be after the trip's start time");
    }

    await closeLegAndUpdateJourney({
      journey,
      trip: { id, toCityId: existing.toCityId },
      closingKm: data.closingKm,
      endDateTime,
      arrivalDateTime: data.arrivalDateTime,
      unloadingCompletedAt: data.unloadingCompletedAt,
      closeReason: data.closeReason,
      actorId: me,
    });
  } else {
    /* ---- legacy trip (pre-journey rows): original behaviour ---- */
    const parsed = closeTripSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const { closingKm, endDateTime } = parsed.data;

    if (closingKm < existing.openingKm) {
      throw new BadRequestError(
        `Closing KM (${closingKm}) cannot be less than opening KM (${existing.openingKm})`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.vehicleTrip.update({
        where: { id },
        data: {
          status: "Closed",
          closingKm,
          endDateTime: endDateTime ?? new Date(),
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });
      // Release the vehicle now the trip is done.
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { status: "AVAILABLE" },
      });
      await writeTripStatus(tx, id, me, "Closed", "Trip closed");
    });
  }

  const trip = await db.vehicleTrip.findUnique({
    where: { id },
    include: tripInclude,
  });
  return sendOk(res, trip);
});

/* ------------------------------------------------------------------ */
/* Delete (Planned / Cancelled only)                                  */
/* ------------------------------------------------------------------ */
router.delete("/:id", can(PERMS.TRIP.DELETE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Trip not found");

  // Journey legs keep their sequence slot in the chain — cancel, never delete.
  if (existing.journeyId) {
    throw new BadRequestError(
      "A journey leg cannot be deleted — cancel it instead",
      "TRIP_IS_JOURNEY_LEG",
    );
  }

  if (!["Planned", "Cancelled"].includes(existing.status)) {
    throw new BadRequestError(
      `A ${existing.status} trip cannot be deleted. Please cancel the trip instead.`,
      "TRIP_DELETE_NOT_ALLOWED",
    );
  }

  const deleted = await db.$transaction(async (tx) => {
    const groupCount = await tx.lRGroup.count({
      where: {
        deletedAt: null,
        OR: [{ primaryTripId: id }, { secondaryTripId: id }],
      },
    });

    if (groupCount > 0) {
      throw new BadRequestError(
        `This trip cannot be deleted because ${groupCount} LR group(s) are linked with this trip.`,
        "TRIP_DELETE_BLOCKED",
      );
    }

    return tx.vehicleTrip.delete({
      where: { id },
      include: tripInclude,
    });
  });

  return sendOk(res, deleted);
});

/* ------------------------------------------------------------------ */
/* Cancel -> Cancelled                                                */
/* ------------------------------------------------------------------ */
router.post("/:id/cancel", can(PERMS.TRIP.CANCEL), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Trip not found");

  if (!["Planned", "InTransit"].includes(existing.status)) {
    throw new BadRequestError(
      "Only a Planned or InTransit trip can be cancelled",
    );
  }

  const parsed = cancelTripSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const me = actorId(req);

  // Cancelling the journey's only live leg cancels the journey with it and
  // frees the vehicle/driver; otherwise the journey stays active at the
  // previous leg's city.
  const journey = existing.journeyId
    ? await db.vehicleJourney.findFirst({
        where: { id: existing.journeyId, deletedAt: null },
        select: { id: true, status: true, vehicleId: true, driverId: true },
      })
    : null;

  const remainingLegs = existing.journeyId
    ? await db.vehicleTrip.count({
        where: {
          journeyId: existing.journeyId,
          deletedAt: null,
          status: { not: "Cancelled" },
          id: { not: id },
        },
      })
    : 0;

  await db.$transaction(async (tx) => {
    await tx.vehicleTrip.update({
      where: { id },
      data: {
        status: "Cancelled",
        cancelReason: parsed.data.reason,
        updatedById: me,
        version: { increment: 1 },
      },
      select: { id: true },
    });

    if (journey && journey.status === "ACTIVE") {
      if (remainingLegs === 0) {
        await tx.vehicleJourney.update({
          where: { id: journey.id },
          data: {
            status: "CANCELLED",
            cancelReason: `Last leg cancelled: ${parsed.data.reason}`,
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
      } else {
        await tx.vehicleJourney.update({
          where: { id: journey.id },
          data: { updatedById: me, version: { increment: 1 } },
        });
      }
    } else if (!journey && existing.status === "InTransit") {
      // Legacy trip — free the vehicle if the trip had taken it on the road.
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { status: "AVAILABLE" },
      });
    }

    await writeTripStatus(tx, id, me, "Cancelled", parsed.data.reason);
  }, TX_BUDGET);

  const trip = await db.vehicleTrip.findUnique({
    where: { id },
    include: tripInclude,
  });
  return sendOk(res, trip);
});

export default router;
