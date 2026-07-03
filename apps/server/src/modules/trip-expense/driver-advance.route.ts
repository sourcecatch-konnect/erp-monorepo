import { Router } from "express";
import {
  createDriverAdvanceSchema,
  reverseDriverAdvanceSchema,
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
import {
  assertTripInJourney,
  driverAdvanceInclude,
  loadJourneyForMoneyEntry,
} from "./trip-expense.service.js";
import { Prisma } from "../../../generated/prisma/index.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* ------------------------------------------------------------------ */
/* List (filter by journey / driver)                                  */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.TRIP_ADVANCE.VIEW), async (req, res) => {
  const query = parseListQuery(req);

  const where: Prisma.DriverAdvanceWhereInput = {
    ...(query.filter.journeyId ? { journeyId: query.filter.journeyId } : {}),
    ...(query.filter.driverId ? { driverId: query.filter.driverId } : {}),
  };

  const [data, total] = await Promise.all([
    db.driverAdvance.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      include: driverAdvanceInclude,
      orderBy: { paidAt: "desc" },
    }),
    db.driverAdvance.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Create -> POSTED (cash left the drawer when it was handed over)    */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.TRIP_ADVANCE.CREATE), async (req, res) => {
  const parsed = createDriverAdvanceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);

  const journey = await loadJourneyForMoneyEntry(data.journeyId);
  if (data.tripId) await assertTripInJourney(data.tripId, data.journeyId);
  if (data.cashAccountId) {
    const account = await db.cashAccount.findFirst({
      where: { id: data.cashAccountId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!account) throw new BadRequestError("Cash account not found");
  }

  const created = await db.driverAdvance.create({
    data: {
      journeyId: data.journeyId,
      tripId: data.tripId ?? null,
      driverId: journey.driverId,
      vehicleId: journey.vehicleId,
      amountPaise: data.amount,
      paymentMode: data.paymentMode,
      cashAccountId: data.cashAccountId ?? null,
      paidAt: data.paidAt ?? new Date(),
      narration: data.narration ?? null,
      status: "POSTED",
      createdById: me,
    },
    include: driverAdvanceInclude,
  });

  return sendOk(res, created, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Reverse                                                            */
/* ------------------------------------------------------------------ */
router.post("/:id/reverse", can(PERMS.TRIP_ADVANCE.REVERSE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.driverAdvance.findFirst({
    where: { id },
    include: { journey: { select: { settlementStatus: true } } },
  });
  if (!existing) throw new NotFoundError("Advance not found");
  if (existing.status !== "POSTED") {
    throw new BadRequestError("Only a posted advance can be reversed");
  }
  if (
    ["GENERATED", "POSTED", "TALLY_SYNCED"].includes(
      existing.journey.settlementStatus,
    )
  ) {
    throw new BadRequestError(
      "The journey's log slip is already generated — reopen it before reversing advances",
    );
  }

  const parsed = reverseDriverAdvanceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const updated = await db.driverAdvance.update({
    where: { id },
    data: {
      status: "REVERSED",
      reversedById: actorId(req),
      reversedAt: new Date(),
      reverseReason: parsed.data.reason,
    },
    include: driverAdvanceInclude,
  });
  return sendOk(res, updated);
});

export default router;
