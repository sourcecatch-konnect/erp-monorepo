import { Router } from "express";
import {
  createTripSchema,
  updateTripSchema,
  startTripSchema,
  cancelTripSchema,
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
  Prisma,
  TripStatus,
} from "../../../generated/prisma/index.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* Trips are not branch-scoped — a single global per-FY counter. */
const TRIP_SEQ_KEY = "TRIP";

/**
 * Validate the trip's vehicle/route/client and build its auto name.
 * `at` is the timestamp baked into the name (creation time; preserved on edit).
 */
async function resolveTripName(
  data: {
    vehicleId: string;
    routeId: string;
    tripType: "lr" | "dc";
    consignorId?: string;
    rakeDate?: Date;
  },
  at: Date,
): Promise<{ tripName: string; consignorId: string | null }> {
  const [vehicle, route] = await Promise.all([
    db.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { vehicleNumber: true, ownershipType: true },
    }),
    db.route.findUnique({
      where: { id: data.routeId },
      select: {
        sourceCity: { select: { name: true } },
        destinationCity: { select: { name: true } },
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

  return { tripName, consignorId };
}

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.TRIP.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const search = query.search;

  const where: Prisma.VehicleTripWhereInput = {
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

    ...(query.filter.status
      ? {
        status: query.filter.status as TripStatus,
      }
      : {}),
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
/* Create -> Planned                                                  */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.TRIP.CREATE), async (req, res) => {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);

  const now = new Date();
  const { tripName, consignorId } = await resolveTripName(data, now);

  const trip = await db.$transaction(async (tx) => {
    const fyCode = fyCodeFor(now);
    const seq = await nextSequence(tx, TRIP_SEQ_KEY, fyCode, "TRIP");
    const tripNumber = formatDocNumber(TRIP_SEQ_KEY, fyCode, seq);

    const created = await tx.vehicleTrip.create({
      data: {
        tripNumber,
        tripName,
        status: "Planned",
        tripType: data.tripType,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        routeId: data.routeId,
        consignorId,
        onwardFreight: data.onwardFreight,
        isTripEmpty: data.isTripEmpty,
        rakeDate: data.tripType === "dc" ? (data.rakeDate ?? null) : null,
        fyCode,
        createdById: me,
      },
      include: tripInclude,
    });

    await writeTripStatus(tx, created.id, me, "Planned", "Trip created");
    return created;
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

  // Keep the original creation timestamp in the regenerated name.
  const { tripName, consignorId } = await resolveTripName(
    data,
    existing.createdAt,
  );

  const updated = await db.vehicleTrip.update({
    where: { id },
    data: {
      tripName,
      tripType: data.tripType,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      routeId: data.routeId,
      consignorId,
      onwardFreight: data.onwardFreight,
      isTripEmpty: data.isTripEmpty,
      rakeDate: data.tripType === "dc" ? (data.rakeDate ?? null) : null,
      updatedById: me,
      version: { increment: 1 },
    },
    include: tripInclude,
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Start -> InTransit                                                 */
/* ------------------------------------------------------------------ */
router.post("/:id/start", can(PERMS.TRIP.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.vehicleTrip.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Trip not found");

  if (existing.status !== "Planned") {
    throw new BadRequestError("Only a Planned trip can be started");
  }

  const parsed = startTripSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { openingKm, startDateTime } = parsed.data;
  const me = actorId(req);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.vehicleTrip.update({
      where: { id },
      data: {
        status: "InTransit",
        openingKm,
        startDateTime: startDateTime ?? new Date(),
        updatedById: me,
        version: { increment: 1 },
      },
      include: tripInclude,
    });
    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: { status: "ON_TRIP" },
    });
    await writeTripStatus(tx, id, me, "InTransit", "Trip started");
    return row;
  });

  return sendOk(res, updated);
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

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.vehicleTrip.update({
      where: { id },
      data: {
        status: "Cancelled",
        cancelReason: parsed.data.reason,
        updatedById: me,
        version: { increment: 1 },
      },
      include: tripInclude,
    });
    // Free the vehicle if the trip had taken it on the road.
    if (existing.status === "InTransit") {
      await tx.vehicle.update({
        where: { id: existing.vehicleId },
        data: { status: "AVAILABLE" },
      });
    }
    await writeTripStatus(tx, id, me, "Cancelled", parsed.data.reason);
    return row;
  });

  return sendOk(res, updated);
});

export default router;
