import { Router } from "express";
import {
  createTripExpenseSchema,
  updateTripExpenseSchema,
  rejectTripExpenseSchema,
  reverseTripExpenseSchema,
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
  loadJourneyForMoneyEntry,
  tripExpenseInclude,
} from "./trip-expense.service.js";
import {
  Prisma,
  type TripExpenseStatus,
} from "../../../generated/prisma/index.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/* ------------------------------------------------------------------ */
/* List (filter by journey / trip / status)                           */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.TRIP_EXPENSE.VIEW), async (req, res) => {
  const query = parseListQuery(req);

  const where: Prisma.TripExpenseWhereInput = {
    deletedAt: null,
    ...(query.filter.journeyId ? { journeyId: query.filter.journeyId } : {}),
    ...(query.filter.tripId ? { tripId: query.filter.tripId } : {}),
    ...(query.filter.status
      ? { status: query.filter.status as TripExpenseStatus }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.tripExpense.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      include: tripExpenseInclude,
      orderBy: { expenseDate: "desc" },
    }),
    db.tripExpense.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Create -> DRAFT                                                    */
/* ------------------------------------------------------------------ */
router.post("/", can(PERMS.TRIP_EXPENSE.CREATE), async (req, res) => {
  const parsed = createTripExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const me = actorId(req);

  await loadJourneyForMoneyEntry(data.journeyId);
  if (data.tripId) await assertTripInJourney(data.tripId, data.journeyId);
  if (data.pumpId) {
    const pump = await db.pump.findUnique({
      where: { id: data.pumpId },
      select: { id: true },
    });
    if (!pump) throw new BadRequestError("Pump not found");
  }

  const created = await db.tripExpense.create({
    data: {
      journeyId: data.journeyId,
      tripId: data.tripId ?? null,
      expenseType: data.expenseType,
      amountPaise: data.amount,
      paymentMode: data.paymentMode,
      cityId: data.cityId ?? null,
      pumpId: data.pumpId ?? null,
      dieselQty: data.dieselQty ?? null,
      dieselRatePaise: data.dieselRate ?? null,
      expenseDate: data.expenseDate ?? new Date(),
      receiptNo: data.receiptNo ?? null,
      paidByDriver: data.paidByDriver,
      remarks: data.remarks ?? null,
      status: "DRAFT",
      createdById: me,
    },
    include: tripExpenseInclude,
  });

  return sendOk(res, created, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Edit (DRAFT only)                                                  */
/* ------------------------------------------------------------------ */
router.patch("/:id", can(PERMS.TRIP_EXPENSE.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.tripExpense.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Expense not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft expense can be edited");
  }

  const parsed = updateTripExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  if (data.journeyId !== existing.journeyId) {
    throw new BadRequestError("An expense cannot move to another journey");
  }
  await loadJourneyForMoneyEntry(data.journeyId);
  if (data.tripId) await assertTripInJourney(data.tripId, data.journeyId);

  const updated = await db.tripExpense.update({
    where: { id },
    data: {
      tripId: data.tripId ?? null,
      expenseType: data.expenseType,
      amountPaise: data.amount,
      paymentMode: data.paymentMode,
      cityId: data.cityId ?? null,
      pumpId: data.pumpId ?? null,
      dieselQty: data.dieselQty ?? null,
      dieselRatePaise: data.dieselRate ?? null,
      expenseDate: data.expenseDate ?? existing.expenseDate,
      receiptNo: data.receiptNo ?? null,
      paidByDriver: data.paidByDriver,
      remarks: data.remarks ?? null,
    },
    include: tripExpenseInclude,
  });

  return sendOk(res, updated);
});

/* ------------------------------------------------------------------ */
/* Delete (DRAFT only, soft)                                          */
/* ------------------------------------------------------------------ */
router.delete("/:id", can(PERMS.TRIP_EXPENSE.UPDATE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.tripExpense.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Expense not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError(
      "Only a draft expense can be deleted — reverse it instead",
    );
  }

  const deleted = await db.tripExpense.update({
    where: { id },
    data: { deletedAt: new Date() },
    include: tripExpenseInclude,
  });
  return sendOk(res, deleted);
});

/* ------------------------------------------------------------------ */
/* Approve / Reject / Reverse                                         */
/* ------------------------------------------------------------------ */
router.post("/:id/approve", can(PERMS.TRIP_EXPENSE.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.tripExpense.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Expense not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft expense can be approved");
  }

  const updated = await db.tripExpense.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: actorId(req),
      approvedAt: new Date(),
    },
    include: tripExpenseInclude,
  });
  return sendOk(res, updated);
});

router.post("/:id/reject", can(PERMS.TRIP_EXPENSE.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.tripExpense.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Expense not found");
  if (existing.status !== "DRAFT") {
    throw new BadRequestError("Only a draft expense can be rejected");
  }

  const parsed = rejectTripExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const updated = await db.tripExpense.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: actorId(req),
      approvedAt: new Date(),
      rejectReason: parsed.data.reason,
    },
    include: tripExpenseInclude,
  });
  return sendOk(res, updated);
});

router.post("/:id/reverse", can(PERMS.TRIP_EXPENSE.REVERSE), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.tripExpense.findFirst({
    where: { id, deletedAt: null },
    include: { journey: { select: { settlementStatus: true } } },
  });
  if (!existing) throw new NotFoundError("Expense not found");
  if (!["APPROVED", "POSTED"].includes(existing.status)) {
    throw new BadRequestError(
      "Only an approved or posted expense can be reversed",
    );
  }
  if (
    ["GENERATED", "POSTED", "TALLY_SYNCED"].includes(
      existing.journey.settlementStatus,
    )
  ) {
    throw new BadRequestError(
      "The journey's log slip is already generated — reopen it before reversing expenses",
    );
  }

  const parsed = reverseTripExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const updated = await db.tripExpense.update({
    where: { id },
    data: {
      status: "REVERSED",
      reversedById: actorId(req),
      reversedAt: new Date(),
      reverseReason: parsed.data.reason,
    },
    include: tripExpenseInclude,
  });
  return sendOk(res, updated);
});

export default router;
