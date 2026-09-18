import { Router } from "express";
import {
  startJourneySchema,
  addJourneyLegSchema,
  closeJourneyLegSchema,
  dispatchJourneyLegSchema,
  cancelJourneySchema,
  closeJourneySchema,
  reopenSettlementReviewSchema,
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
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { buildTripName, writeTripStatus } from "../trip/trip.service.js";
import { undeliveredLRNumbersForTrip } from "../lorry-receipt/lr-delivery.service.js";
import { generatePdfFromHtml } from "../../templetes/pdf/pdf.genertaor..js";
import {
  chainViolations,
  computeJourneyTotals,
  getHeadOffice,
  journeyInclude,
  journeyLegSelect,
  journeyListSelect,
  OPEN_JOURNEY_STATUSES,
} from "./vehicle-journey.service.js";
import {
  buildVehicleJourneyReportHtml,
  vehicleJourneyReportInclude,
} from "./vehicle-journey-report.pdf.js";
import {
  Prisma,
  type JourneySettlementStatus,
  type TripLegType,
  type VehicleJourneyStatus,
} from "../../../generated/prisma/index.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* Journeys are not branch-scoped — a single global per-FY counter. */
const JOURNEY_SEQ_KEY = "JRN";
/* Legs share the trips counter so trip numbers stay continuous. */
const TRIP_SEQ_KEY = "TRIP";

const TX_BUDGET = { timeout: 15000, maxWait: 10000 } as const;

/** Journey leg types map onto the legacy trip type: rail rakes are DC, everything else LR. */
const tripTypeForLeg = (legType: TripLegType): "lr" | "dc" =>
  legType === "DC" ? "dc" : "lr";

type LegInput = {
  legType: TripLegType;
  routeId: string;
  consignorId?: string;
  rakeDate?: Date;
  onwardFreight: number;
  isTripEmpty: boolean;
  openingKm: number;
  startDateTime?: Date;
  chainExceptionReason?: string;
  remarks?: string;
};

/**
 * Validate a leg's route/consignor and build everything needed to create the
 * VehicleTrip row. Pure reads — run before the transaction opens.
 */
async function prepareLeg(leg: LegInput, at: Date) {
  const route = await db.route.findUnique({
    where: { id: leg.routeId },
    select: {
      id: true,
      sourceCityId: true,
      destinationCityId: true,
      sourceCity: { select: { id: true, name: true } },
      destinationCity: { select: { id: true, name: true } },
    },
  });
  if (!route) throw new BadRequestError("Route not found");

  let consignorId: string | null = null;
  let shortCode: string | null = null;
  let consignorName: string | null = null;
  if (leg.legType === "LR") {
    const consignor = await db.customer.findUnique({
      where: { id: leg.consignorId! },
      select: { shortName: true, name: true },
    });
    if (!consignor) throw new BadRequestError("Client not found");
    consignorId = leg.consignorId!;
    shortCode = consignor.shortName;
    consignorName = consignor.name;
  }

  return { route, consignorId, shortCode, consignorName, at };
}

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.VEHICLE_JOURNEY.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const search = query.search;
  const status = query.filter.status;
  const settlementStatus = query.filter.settlementStatus;
  const startedFrom = query.filter.startedFrom;
  const startedTo = query.filter.startedTo;

  const parseBusinessDate = (value: string, endOfDay = false) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestError("Date filters must use YYYY-MM-DD format");
    }
    const [year, month, day] = value.split("-").map(Number);
    const calendarCheck = new Date(Date.UTC(year!, month! - 1, day!));
    if (
      calendarCheck.getUTCFullYear() !== year ||
      calendarCheck.getUTCMonth() !== month! - 1 ||
      calendarCheck.getUTCDate() !== day
    ) {
      throw new BadRequestError("Invalid journey date filter");
    }
    const date = new Date(
      `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`,
    );
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError("Invalid journey date filter");
    }
    return date;
  };

  const startedFromDate = startedFrom
    ? parseBusinessDate(startedFrom)
    : undefined;
  const startedToDate = startedTo
    ? parseBusinessDate(startedTo, true)
    : undefined;
  if (startedFromDate && startedToDate && startedFromDate > startedToDate) {
    throw new BadRequestError("Started From cannot be after Started To");
  }

  const startedAtFilter =
    startedFromDate || startedToDate
      ? {
          ...(startedFromDate ? { gte: startedFromDate } : {}),
          ...(startedToDate ? { lte: startedToDate } : {}),
        }
      : undefined;

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
            {
              driver: {
                is: { name: { contains: search, mode: "insensitive" } },
              },
            },
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
    ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
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
router.get("/trip-vehicle-options", can(PERMS.TRIP.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const forNewJourney = req.query.context === "journey";
  const now = new Date();
  const where: Prisma.VehicleWhereInput = {
    ownershipType: "Own_Vehicle",
    ...(query.search
      ? {
          vehicleNumber: {
            contains: query.search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [vehicles, total] = await Promise.all([
    db.vehicle.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      orderBy: { vehicleNumber: "asc" },
      select: {
        id: true,
        vehicleNumber: true,
        status: true,
        insuranceDueDate: true,
        journeys: {
          where: {
            deletedAt: null,
            status: forNewJourney
              ? { in: [...OPEN_JOURNEY_STATUSES] }
              : "ACTIVE",
          },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            journeyNumber: true,
            currentCity: { select: { name: true } },
            trips: {
              where: { deletedAt: null, status: { not: "Cancelled" } },
              take: 1,
              orderBy: { sequenceNo: "desc" },
              select: {
                tripNumber: true,
                sequenceNo: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    db.vehicle.count({ where }),
  ]);

  const data = vehicles.map((vehicle) => {
    const journey = vehicle.journeys[0] ?? null;
    const lastTrip = journey?.trips[0] ?? null;

    const selectionState =
      journey && lastTrip?.status === "Closed"
        ? ("READY_FOR_NEXT_TRIP" as const)
        : journey && lastTrip?.status === "Planned"
          ? ("TRIP_PLANNED" as const)
          : journey && lastTrip?.status === "InTransit"
            ? ("IN_TRANSIT" as const)
            : !journey &&
                vehicle.insuranceDueDate &&
                vehicle.insuranceDueDate < now
              ? ("INSURANCE_EXPIRED" as const)
              : !journey && vehicle.status === "AVAILABLE"
                ? ("AVAILABLE_FOR_NEW_JOURNEY" as const)
                : ("UNAVAILABLE" as const);

    return {
      id: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      status: vehicle.status,
      selectionState,
      selectable:
        selectionState === "AVAILABLE_FOR_NEW_JOURNEY" ||
        selectionState === "READY_FOR_NEXT_TRIP",
      currentCityName: journey?.currentCity.name ?? null,
      journeyNumber: journey?.journeyNumber ?? null,
      lastTripNumber: lastTrip?.tripNumber ?? null,
      lastTripSequenceNo: lastTrip?.sequenceNo ?? null,
    };
  });

  return sendOk(res, data, {
    page: query.page,
    size: query.size,
    total,
  });
});

router.get("/trip-driver-options", can(PERMS.TRIP.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const forNewJourney = req.query.context === "journey";
  const where: Prisma.DriverWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { mobile: { contains: query.search, mode: "insensitive" } },
          { licenseNo: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [drivers, total] = await Promise.all([
    db.driver.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        onLeave: true,
        blackListed: true,
        journeys: {
          where: {
            deletedAt: null,
            status: forNewJourney
              ? { in: [...OPEN_JOURNEY_STATUSES] }
              : "ACTIVE",
          },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            journeyNumber: true,
            currentCity: { select: { name: true } },
            vehicle: { select: { id: true, vehicleNumber: true } },
            trips: {
              where: { deletedAt: null, status: { not: "Cancelled" } },
              take: 1,
              orderBy: { sequenceNo: "desc" },
              select: {
                tripNumber: true,
                sequenceNo: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    db.driver.count({ where }),
  ]);

  const data = drivers.map((driver) => {
    const journey = driver.journeys[0] ?? null;
    const lastTrip = journey?.trips[0] ?? null;

    const selectionState = driver.blackListed
      ? ("BLACKLISTED" as const)
      : driver.onLeave
        ? ("ON_LEAVE" as const)
        : journey && lastTrip?.status === "Closed"
          ? ("ASSIGNED_READY_FOR_NEXT_TRIP" as const)
          : journey && lastTrip?.status === "Planned"
            ? ("TRIP_PLANNED" as const)
            : journey && lastTrip?.status === "InTransit"
              ? ("IN_TRANSIT" as const)
              : !journey && driver.status === "AVAILABLE"
                ? ("AVAILABLE_FOR_NEW_JOURNEY" as const)
                : ("UNAVAILABLE" as const);

    return {
      id: driver.id,
      name: driver.name,
      status: driver.status,
      selectionState,
      selectable:
        selectionState === "AVAILABLE_FOR_NEW_JOURNEY" ||
        selectionState === "ASSIGNED_READY_FOR_NEXT_TRIP",
      vehicleId: journey?.vehicle.id ?? null,
      currentCityName: journey?.currentCity.name ?? null,
      journeyNumber: journey?.journeyNumber ?? null,
      vehicleNumber: journey?.vehicle.vehicleNumber ?? null,
      lastTripNumber: lastTrip?.tripNumber ?? null,
      lastTripSequenceNo: lastTrip?.sequenceNo ?? null,
    };
  });

  return sendOk(res, data, {
    page: query.page,
    size: query.size,
    total,
  });
});

router.get("/active", can(PERMS.TRIP.VIEW), async (req, res) => {
  const vehicleId =
    typeof req.query.vehicleId === "string" ? req.query.vehicleId : "";
  if (!vehicleId) throw new BadRequestError("vehicleId is required");

  const [headOffice, vehicle, journey] = await Promise.all([
    getHeadOffice(),
    db.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentKM: true },
    }),
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
          toCity: { select: { name: true } },
          closingKm: true,
          endDateTime: true,
        },
      })
    : null;

  return sendOk(res, {
    headOffice,
    // New journeys must open at or above the odometer — surfaced so the form
    // can validate opening KM on blur instead of failing at save time.
    vehicleCurrentKm: vehicle?.currentKM ?? null,
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
                endDateTime: lastLeg.endDateTime?.toISOString() ?? null,
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
/* Detailed journey report PDF (separate from the log-slip PDF)       */
/* ------------------------------------------------------------------ */
router.get("/:id/report-pdf", can(PERMS.LOGSLIP.PRINT), async (req, res) => {
  const id = getParamId(req);
  const journey = await db.vehicleJourney.findFirst({
    where: { id, deletedAt: null },
    include: vehicleJourneyReportInclude,
  });
  if (!journey) throw new NotFoundError("Journey not found");
  if (
    !journey.logSlip ||
    !["GENERATED", "POSTED_TO_ACCOUNTS", "TALLY_SYNCED"].includes(
      journey.logSlip.status,
    )
  ) {
    throw new BadRequestError(
      "Generate the log slip before downloading the journey report",
    );
  }

  const html = buildVehicleJourneyReportHtml(journey);
  const buffer = await generatePdfFromHtml(html);
  const fileNumber = journey.logSlip.logSlipNumber ?? journey.journeyNumber;
  const safeFileNumber = fileNumber.replace(/[^a-zA-Z0-9_-]+/g, "-");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="vehicle-journey-${safeFileNumber}.pdf"`,
  );
  return res.send(buffer);
});

/* ------------------------------------------------------------------ */
/* Start journey -> ACTIVE with leg 1                                 */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.VEHICLE_JOURNEY.CREATE), async (req, res) => {
  const parsed = startJourneySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);
  const now = new Date();
  const startedAt = data.startedAt ?? now;

  /* ---- read-only validation, all outside the transaction ---- */
  const [vehicle, driver, homeBranch, startCity, returnCity] =
    await Promise.all([
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
      db.branch.findUnique({
        where: { id: data.homeBranchId },
        select: { id: true },
      }),
      db.city.findUnique({
        where: { id: data.startCityId },
        select: { id: true, name: true },
      }),
      db.city.findUnique({
        where: { id: data.returnCityId },
        select: { id: true, name: true },
      }),
    ]);

  if (!vehicle) throw new BadRequestError("Vehicle not found");
  if (vehicle.ownershipType !== "Own_Vehicle") {
    throw new BadRequestError("Journeys can only be started for own vehicles");
  }
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
  if (!homeBranch) throw new BadRequestError("Home branch not found");
  if (!startCity) throw new BadRequestError("Start city not found");
  if (!returnCity) throw new BadRequestError("Return city not found");
  if (data.openingKm < vehicle.currentKM) {
    throw new BadRequestError(
      `Opening KM (${data.openingKm}) is below the vehicle's current KM (${vehicle.currentKM})`,
    );
  }

  const [vehicleJourneyClash, driverJourneyClash] = await Promise.all([
    db.vehicleJourney.findFirst({
      where: {
        vehicleId: data.vehicleId,
        deletedAt: null,
        status: { in: [...OPEN_JOURNEY_STATUSES] },
      },
      select: { journeyNumber: true },
    }),
    db.vehicleJourney.findFirst({
      where: {
        driverId: data.driverId,
        deletedAt: null,
        status: { in: [...OPEN_JOURNEY_STATUSES] },
      },
      select: { journeyNumber: true },
    }),
  ]);
  if (vehicleJourneyClash) {
    throw new BadRequestError(
      `Vehicle already has an open journey (${vehicleJourneyClash.journeyNumber})`,
    );
  }
  if (driverJourneyClash) {
    throw new BadRequestError(
      `Driver already has an open journey (${driverJourneyClash.journeyNumber})`,
    );
  }

  const leg = data.firstLeg;
  const prepared = await prepareLeg(leg, now);
  if (prepared.route.sourceCityId !== data.startCityId) {
    throw new BadRequestError(
      "The first leg must start from the journey's start city",
    );
  }

  const tripName = buildTripName({
    fromCity: prepared.route.sourceCity.name,
    toCity: prepared.route.destinationCity.name,
    truckNumber: vehicle.vehicleNumber,
    tripType: tripTypeForLeg(leg.legType),
    customerShortCode: prepared.shortCode,
    consignorName: prepared.consignorName,
    rakeDate: leg.rakeDate ?? null,
    at: now,
  });

  /* ---- number reservation (gap-tolerant, outside the transaction) ---- */
  const fyCode = fyCodeFor(startedAt);
  const [journeySeq, tripSeq] = [
    await nextSequence(db, JOURNEY_SEQ_KEY, fyCode, "JOURNEY"),
    await nextSequence(db, TRIP_SEQ_KEY, fyCode, "TRIP"),
  ];
  const journeyNumber = formatDocNumber(
    JOURNEY_SEQ_KEY,
    fyCode,
    journeySeq,
    "SKJ",
  );
  const tripNumber = formatDocNumber(TRIP_SEQ_KEY, fyCode, tripSeq, "SKV");

  /* ---- writes only ---- */
  const journeyId = await db.$transaction(async (tx) => {
    const journey = await tx.vehicleJourney.create({
      data: {
        journeyNumber,
        fyCode,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        homeBranchId: data.homeBranchId,
        startCityId: data.startCityId,
        returnCityId: data.returnCityId,
        currentCityId: data.startCityId,
        openingKm: data.openingKm,
        startedAt,
        status: "ACTIVE",
        settlementStatus: "NOT_READY",
        remarks: data.remarks ?? null,
        createdById: me,
      },
      select: { id: true },
    });

    const trip = await tx.vehicleTrip.create({
      data: {
        tripNumber,
        tripName,
        status: "Planned",
        tripType: tripTypeForLeg(leg.legType),
        legType: leg.legType,
        journeyId: journey.id,
        sequenceNo: 1,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        routeId: leg.routeId,
        consignorId: prepared.consignorId,
        fromCityId: prepared.route.sourceCityId,
        toCityId: prepared.route.destinationCityId,
        isReturnLeg: prepared.route.destinationCityId === data.returnCityId,
        onwardFreight: leg.onwardFreight,
        // Leg 1 always opens at the journey's opening KM.
        openingKm: data.openingKm,
        isTripEmpty: leg.legType === "EMPTY" ? true : leg.isTripEmpty,
        rakeDate: leg.legType === "DC" ? (leg.rakeDate ?? null) : null,
        // Leg 1 is born Planned like any other leg — it's dispatched
        // explicitly via /dispatch-leg, which is what actually stamps
        // startDateTime. An operator-entered time here is a schedule, not a
        // dispatch, so it belongs in plannedStartDateTime (mirrors the Trips
        // module's own Planned-vs-InTransit convention).
        plannedStartDateTime: leg.startDateTime ?? null,
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
    await writeTripStatus(tx, trip.id, me, "Planned", "Journey leg 1 created");
    return journey.id;
  }, TX_BUDGET);

  // StartJourneyDialog.tsx only reads `.id` / `.journeyNumber` from the
  // created journey (toast + navigation) — no need for journeyInclude here.
  const journey = await db.vehicleJourney.findUnique({
    where: { id: journeyId },
    select: { id: true, journeyNumber: true },
  });
  if (!journey) {
    throw new NotFoundError("Journey was created but could not be loaded");
  }
  return sendOk(res, journey, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Add leg                                                            */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/add-leg",
  can(PERMS.VEHICLE_JOURNEY.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const journey = await db.vehicleJourney.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        returnCityId: true,
        vehicleId: true,
        driverId: true,
        fyCode: true,
        vehicle: { select: { vehicleNumber: true } },
      },
    });
    if (!journey) throw new NotFoundError("Journey not found");
    if (journey.status !== "ACTIVE") {
      throw new BadRequestError("Legs can only be added to an active journey");
    }

    const parsed = addJourneyLegSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const leg = parsed.data;
    const me = actorId(req);
    const now = new Date();

    const prevLeg = await db.vehicleTrip.findFirst({
      where: { journeyId: id, deletedAt: null, status: { not: "Cancelled" } },
      orderBy: { sequenceNo: "desc" },
      select: {
        sequenceNo: true,
        status: true,
        toCityId: true,
        closingKm: true,
        endDateTime: true,
        toCity: { select: { name: true } },
      },
    });
    if (!prevLeg) {
      throw new BadRequestError(
        "Journey has no legs — start a new journey instead",
      );
    }
    if (prevLeg.status !== "Closed") {
      throw new BadRequestError(
        "Close the current leg before adding the next one",
      );
    }

    const prepared = await prepareLeg(leg, now);

    /* ---- backend-enforced chain rules ---- */
    const violations = chainViolations(
      {
        sequenceNo: prevLeg.sequenceNo,
        toCityId: prevLeg.toCityId,
        toCityName: prevLeg.toCity?.name ?? null,
        closingKm: prevLeg.closingKm,
        endDateTime: prevLeg.endDateTime,
      },
      {
        fromCityId: prepared.route.sourceCityId,
        fromCityName: prepared.route.sourceCity.name,
        openingKm: leg.openingKm,
        startDateTime: leg.startDateTime,
      },
    );
    if (violations.length > 0) {
      if (!leg.chainExceptionReason) {
        throw new BadRequestError(
          `Leg breaks journey continuity: ${violations.join("; ")}. Provide an exception reason to override.`,
          "CHAIN_VIOLATION",
        );
      }
      if (!req.ctx!.permissions.has(PERMS.VEHICLE_JOURNEY.OVERRIDE_CHAIN)) {
        throw new ForbiddenError(
          "You need the chain-override permission to break journey continuity",
        );
      }
    }

    const tripSeq = await nextSequence(
      db,
      TRIP_SEQ_KEY,
      journey.fyCode,
      "TRIP",
    );
    const tripNumber = formatDocNumber(
      TRIP_SEQ_KEY,
      journey.fyCode,
      tripSeq,
      "SKV",
    );
    const tripName = buildTripName({
      fromCity: prepared.route.sourceCity.name,
      toCity: prepared.route.destinationCity.name,
      truckNumber: journey.vehicle.vehicleNumber,
      tripType: tripTypeForLeg(leg.legType),
      customerShortCode: prepared.shortCode,
      consignorName: prepared.consignorName,
      rakeDate: leg.rakeDate ?? null,
      at: now,
    });

    const tripId = await db.$transaction(async (tx) => {
      const trip = await tx.vehicleTrip.create({
        data: {
          tripNumber,
          tripName,
          status: "Planned",
          tripType: tripTypeForLeg(leg.legType),
          legType: leg.legType,
          journeyId: id,
          sequenceNo: prevLeg.sequenceNo! + 1,
          vehicleId: journey.vehicleId,
          driverId: journey.driverId,
          routeId: leg.routeId,
          consignorId: prepared.consignorId,
          fromCityId: prepared.route.sourceCityId,
          toCityId: prepared.route.destinationCityId,
          isReturnLeg:
            prepared.route.destinationCityId === journey.returnCityId,
          onwardFreight: leg.onwardFreight,
          openingKm: leg.openingKm,
          isTripEmpty: leg.legType === "EMPTY" ? true : leg.isTripEmpty,
          rakeDate: leg.legType === "DC" ? (leg.rakeDate ?? null) : null,
          // Same reasoning as the first-leg path above: this leg is born
          // Planned and only /dispatch-leg sets the real startDateTime.
          plannedStartDateTime: leg.startDateTime ?? null,
          chainExceptionReason:
            violations.length > 0 ? (leg.chainExceptionReason ?? null) : null,
          fyCode: journey.fyCode,
          createdById: me,
        },
        select: { id: true },
      });
      await tx.vehicleJourney.update({
        where: { id },
        data: { updatedById: me, version: { increment: 1 } },
      });
      await writeTripStatus(
        tx,
        trip.id,
        me,
        "Planned",
        `Journey leg ${prevLeg.sequenceNo! + 1} created`,
      );
      return trip.id;
    }, TX_BUDGET);

    const created = await db.vehicleTrip.findUnique({
      where: { id: tripId },
      select: journeyLegSelect,
    });
    return sendOk(res, created, undefined, 201);
  },
);

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
      select: { id: true, status: true, sequenceNo: true },
    });
    if (!trip) throw new NotFoundError("Journey leg not found");
    if (trip.status !== "Planned") {
      throw new BadRequestError("Only a Planned leg can be dispatched");
    }

    const parsed = dispatchJourneyLegSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Operator-entered start time must not precede the previous leg's close.
    const prevLeg =
      trip.sequenceNo && trip.sequenceNo > 1
        ? await db.vehicleTrip.findFirst({
            where: {
              journeyId: id,
              deletedAt: null,
              status: { not: "Cancelled" },
              sequenceNo: { lt: trip.sequenceNo },
            },
            orderBy: { sequenceNo: "desc" },
            select: { endDateTime: true },
          })
        : null;
    if (
      prevLeg?.endDateTime &&
      parsed.data.startDateTime <= prevLeg.endDateTime
    ) {
      throw new BadRequestError(
        "Start time must be after the previous leg's close time",
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.vehicleTrip.update({
        where: { id: tripId },
        data: {
          status: "InTransit",
          startDateTime: parsed.data.startDateTime,
          updatedById: me,
          version: { increment: 1 },
        },
        select: journeyLegSelect,
      });
      if (trip.sequenceNo === 1) {
        // Leg 1's actual dispatch IS the journey's own start moment — keep
        // startedAt (Total Days, journey PDF/detail) from drifting away from it.
        await tx.vehicleJourney.update({
          where: { id },
          data: {
            startedAt: parsed.data.startDateTime,
            updatedById: me,
            version: { increment: 1 },
          },
        });
      }
      await writeTripStatus(tx, tripId, me, "InTransit", "Leg dispatched");
      return row;
    }, TX_BUDGET);

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Close leg (return-to-base detection lives here)                    */
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

    // Delivery gate ("Way 1", docs/LR_DELIVERY_ACK_PLAN.md §4): a leg that is
    // the FINAL trip of an LR group cannot close while LRs are undelivered.
    const blockers = await undeliveredLRNumbersForTrip(tripId);
    if (blockers.length > 0) {
      throw new BadRequestError(
        `Cannot close leg — ${blockers.length} LR(s) not delivered: ${blockers.join(", ")}. ` +
          "Mark them delivered or hold the group at hub.",
        "TRIP_CLOSE_UNDELIVERED_LRS",
      );
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

    const isReturnToBase = trip.toCityId === journey.returnCityId;

    await db.$transaction(async (tx) => {
      await tx.vehicleTrip.update({
        where: { id: tripId },
        data: {
          status: "Closed",
          closingKm: data.closingKm,
          endDateTime,
          arrivalDateTime: data.arrivalDateTime ?? endDateTime,
          unloadingCompletedAt: data.unloadingCompletedAt ?? null,
          closedById: me,
          closeReason: data.closeReason ?? null,
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true },
      });

      await tx.vehicle.update({
        where: { id: journey.vehicleId },
        data: {
          currentKM: data.closingKm,
          // Physical return releases the vehicle; settlement stays pending.
          ...(isReturnToBase ? { status: "AVAILABLE" as const } : {}),
        },
      });

      if (isReturnToBase) {
        await tx.driver.update({
          where: { id: journey.driverId },
          data: { status: "AVAILABLE" },
        });
      }

      await tx.vehicleJourney.update({
        where: { id },
        data: {
          currentCityId: trip.toCityId!,
          updatedById: me,
          version: { increment: 1 },
          ...(isReturnToBase
            ? {
                status: "RETURNED" as const,
                settlementStatus: "PENDING_REVIEW" as const,
                closingKm: data.closingKm,
                closedAt: endDateTime,
              }
            : {}),
        },
      });

      await writeTripStatus(
        tx,
        tripId,
        me,
        "Closed",
        isReturnToBase ? "Leg closed — vehicle returned to base" : "Leg closed",
      );
    }, TX_BUDGET);

    // CloseLegDialog.tsx doesn't read the response at all (toast + refetch).
    const updated = await db.vehicleJourney.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
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

    // VehicleJourneyDetail.tsx's markReady mutation doesn't read the
    // response (toast + refetch) — no need for journeyInclude/totals here.
    const updated = await db.vehicleJourney.update({
      where: { id },
      data: {
        status: "READY_FOR_LOGSLIP",
        settlementStatus: "READY",
        updatedById: me,
        version: { increment: 1 },
      },
      select: { id: true, status: true, version: true },
    });
    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Reopen settlement review (before log-slip generation)              */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/reopen-settlement-review",
  can(PERMS.VEHICLE_JOURNEY.REOPEN_SETTLEMENT),
  async (req, res) => {
    const id = getParamId(req);
    const me = actorId(req);

    const parsed = reopenSettlementReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const journey = await db.vehicleJourney.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        settlementStatus: true,
        logSlip: { select: { id: true, status: true } },
      },
    });
    if (!journey) throw new NotFoundError("Journey not found");
    if (
      journey.status !== "READY_FOR_LOGSLIP" ||
      journey.settlementStatus !== "READY"
    ) {
      throw new BadRequestError(
        "Only a journey marked ready for log slip can be reopened for settlement review",
      );
    }
    if (
      journey.logSlip &&
      !["DRAFT", "REOPENED"].includes(journey.logSlip.status)
    ) {
      throw new BadRequestError(
        "A log slip has already been generated — use Reopen Log Slip instead",
      );
    }

    // VehicleJourneyDetail.tsx's reopenSettlement mutation doesn't read the
    // response (toast + refetch), so keep this to a minimal select — no
    // journeyInclude materialised while the transaction is open.
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.vehicleJourney.update({
        where: { id },
        data: {
          status: "RETURNED",
          settlementStatus: "PENDING_REVIEW",
          updatedById: me,
          version: { increment: 1 },
        },
        select: { id: true, status: true, version: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: me,
          action: "vehicle_journey.reopen_settlement",
          entity: "VehicleJourney",
          entityId: id,
          before: {
            status: journey.status,
            settlementStatus: journey.settlementStatus,
          },
          after: {
            status: "RETURNED",
            settlementStatus: "PENDING_REVIEW",
            reason: parsed.data.reason,
          },
        },
      });

      return row;
    }, TX_BUDGET);

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Force close away from the return city (non-base closure)           */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/close",
  can(PERMS.VEHICLE_JOURNEY.CLOSE),
  async (req, res) => {
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

    // VehicleJourneyDetail.tsx's forceClose mutation doesn't read the
    // response (toast + refetch).
    const updated = await db.vehicleJourney.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
    });
    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Cancel journey                                                     */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/cancel",
  can(PERMS.VEHICLE_JOURNEY.CANCEL),
  async (req, res) => {
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
      if (plannedLegs.length > 0) {
        const legIds = plannedLegs.map((leg) => leg.id);

        // Bulk update + bulk history insert instead of looping per leg —
        // a journey with several open legs was previously doing 2 sequential
        // writes per leg inside the transaction.
        await tx.vehicleTrip.updateMany({
          where: { id: { in: legIds } },
          data: {
            status: "Cancelled",
            cancelReason: "Journey cancelled",
            updatedById: me,
            version: { increment: 1 },
          },
        });

        await tx.tripStatusHistory.createMany({
          data: legIds.map((legId) => ({
            vehicleTripId: legId,
            userId: me,
            status: "Cancelled" as const,
            note: parsed.data.reason,
          })),
        });
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

    // VehicleJourneyDetail.tsx's cancel mutation doesn't read the response.
    const updated = await db.vehicleJourney.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
    });
    return sendOk(res, updated);
  },
);

export default router;
