import { Router } from "express";
import type { Request } from "express";

import {
  openCashDaySchema,
  upsertCashBalancesSchema,
  createCashPaymentSchema,
  updateCashPaymentSchema,
  cashPaymentStatusUpdateSchema,
  reorderCashPaymentsSchema,
  bulkApproveCashPaymentsSchema,
  closeCashDaySchema,
  createCashReceivableSchema,
  updateCashReceivableSchema,
  markReceivableReceivedSchema,
  createCashAccountAdjustmentSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import {
  accountTotals,
  buildDayView,
  buildLedgerView,
  buildReceivablesView,
  dayInclude,
  findDay,
  poolTotals,
  priorClosings,
} from "./cash-planning.service.js";
import { recordLedgerEntry } from "../ledger/ledger.service.js";

const parseReceivableDate = (value?: string): Date | null =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/** Parse a YYYY-MM-DD path/body value into a UTC-midnight Date. */
const parseDate = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestError("Date must be in YYYY-MM-DD format");
  }
  return new Date(`${value}T00:00:00.000Z`);
};

const loadDayOr404 = async (id: string) => {
  const day = await findDay(id);
  if (!day) throw new NotFoundError("Cash plan day not found");
  return day;
};

const assertOpen = (status: string) => {
  if (status !== "OPEN") {
    throw new BadRequestError("This day is closed and can no longer be edited");
  }
};

/* ───────────────────────── Days ───────────────────────── */

// Recent days (history list)
router.get("/days", can(PERMS.CASH_PLANNING.VIEW), async (req, res) => {
  const days = await db.cashPlanDay.findMany({
    orderBy: { date: "desc" },
    take: 60,
    select: { id: true, date: true, status: true, closedAt: true },
  });
  return sendOk(res, days);
});

// Get one day's full view by date (YYYY-MM-DD)
router.get(
  "/days/:date",
  can(PERMS.CASH_PLANNING.VIEW),
  async (req: Request, res) => {
    const date = parseDate(req.params.date as string);
    const day = await db.cashPlanDay.findUnique({
      where: { date },
      include: dayInclude,
    });
    if (!day) return sendOk(res, null);
    return sendOk(res, buildDayView(day));
  },
);

// Open a day — creates it and seeds opening balances from the prior closing.
router.post("/days", can(PERMS.CASH_PLANNING.ENTER), async (req, res) => {
  const parsed = openCashDaySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const date = parseDate(parsed.data.date);

  const existing = await db.cashPlanDay.findUnique({ where: { date } });
  if (existing) throw new BadRequestError("A plan for this date already exists");

  const accounts = await db.cashAccount.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });
  const carried = await priorClosings(date);

  const created = await db.cashPlanDay.create({
    data: {
      date,
      balances: {
        create: accounts.map((a) => {
          const seed = carried.get(a.id) ?? 0;
          return {
            accountId: a.id,
            openingBalance: BigInt(seed),
            carriedOpening: BigInt(seed),
          };
        }),
      },
    },
    include: dayInclude,
  });

  return sendOk(res, buildDayView(created), undefined, 201);
});

// Upsert opening balances for a day
router.put(
  "/days/:id/balances",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const day = await loadDayOr404(id);
    assertOpen(day.status);

    const parsed = upsertCashBalancesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    await db.$transaction(
      parsed.data.balances.map((b) =>
        db.cashAccountBalance.upsert({
          where: { dayId_accountId: { dayId: id, accountId: b.accountId } },
          update: { openingBalance: BigInt(b.openingBalance) },
          create: {
            dayId: id,
            accountId: b.accountId,
            openingBalance: BigInt(b.openingBalance),
          },
        }),
      ),
    );

    const fresh = await findDay(id);
    return sendOk(res, buildDayView(fresh!));
  },
);

// Close a day
router.post(
  "/days/:id/close",
  can(PERMS.CASH_PLANNING.CLOSE),
  async (req, res) => {
    const id = getParamId(req);
    const day = await loadDayOr404(id);
    assertOpen(day.status);

    const parsed = closeCashDaySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    await db.cashPlanDay.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date(), closedById: actorId(req) },
    });

    const fresh = await findDay(id);
    return sendOk(res, buildDayView(fresh!));
  },
);

/* ───────────────────────── Payments ───────────────────────── */

// Add a payment to a day's queue
router.post(
  "/days/:id/payments",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);

    const parsed = createCashPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const body = parsed.data;

    // Read only the scalars we need instead of loading the whole day graph:
    // the day's status, the current max priority, and whether any payment is
    // already approved ("New" flag = raised after review began).
    const [dayRow, priorityAgg, approved] = await Promise.all([
      db.cashPlanDay.findUnique({ where: { id }, select: { status: true } }),
      db.cashPayment.aggregate({ where: { dayId: id }, _max: { priority: true } }),
      db.cashPayment.findFirst({
        where: { dayId: id, status: "APPROVED" },
        select: { id: true },
      }),
    ]);
    if (!dayRow) throw new NotFoundError("Cash plan day not found");
    assertOpen(dayRow.status);

    const hasApproved = !!approved;
    const maxPriority = priorityAgg._max.priority ?? 0;

    const payment = await db.cashPayment.create({
      data: {
        dayId: id,
        creditorId: body.creditorId ?? null,
        payeeName: body.payeeName,
        amount: BigInt(body.amount),
        category: body.category,
        mode: body.mode,
        segment: body.segment ?? null,
        projectCode: body.projectCode ?? null,
        priority: maxPriority + 1,
        branchId: body.branchId ?? null,
        fromAccountId: body.fromAccountId ?? null,
        note: body.note ?? null,
        isLate: hasApproved,
        createdById: actorId(req),
      },
    });

    const fresh = await findDay(id);
    return sendOk(res, { payment: { ...payment, amount: Number(payment.amount) }, day: buildDayView(fresh!) }, undefined, 201);
  },
);

// Edit a pending payment
router.patch(
  "/payments/:id",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const payment = await db.cashPayment.findUnique({
      where: { id },
      include: { day: { select: { status: true } } },
    });
    if (!payment) throw new NotFoundError("Payment not found");
    assertOpen(payment.day.status);
    if (payment.status !== "PENDING") {
      throw new BadRequestError("Only pending payments can be edited");
    }
    const parsed = updateCashPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const b = parsed.data;

    await db.cashPayment.update({
      where: { id },
      data: {
        ...(b.creditorId !== undefined ? { creditorId: b.creditorId ?? null } : {}),
        ...(b.payeeName !== undefined ? { payeeName: b.payeeName } : {}),
        ...(b.amount !== undefined ? { amount: BigInt(b.amount) } : {}),
        ...(b.category !== undefined ? { category: b.category } : {}),
        ...(b.mode !== undefined ? { mode: b.mode } : {}),
        ...(b.segment !== undefined ? { segment: b.segment ?? null } : {}),
        ...(b.projectCode !== undefined
          ? { projectCode: b.projectCode ?? null }
          : {}),
        ...(b.branchId !== undefined ? { branchId: b.branchId ?? null } : {}),
        ...(b.fromAccountId !== undefined
          ? { fromAccountId: b.fromAccountId ?? null }
          : {}),
        ...(b.note !== undefined ? { note: b.note ?? null } : {}),
      },
    });

    const fresh = await findDay(payment.dayId);
    return sendOk(res, buildDayView(fresh!));
  },
);

// Delete a payment (any status while the day is open). If it was approved
// against a creditor, restore that creditor's outstanding balance.
router.delete(
  "/payments/:id",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const payment = await db.cashPayment.findUnique({
      where: { id },
      include: { day: { select: { status: true } } },
    });
    if (!payment) throw new NotFoundError("Payment not found");
    assertOpen(payment.day.status);

    await db.$transaction(async (tx) => {
      if (payment.status === "APPROVED" && payment.creditorId) {
        await tx.creditor.update({
          where: { id: payment.creditorId },
          data: { outstandingBalance: { increment: payment.amount } },
        });
      }
      if (payment.status === "APPROVED") {
        // Mirror-IN row before the hard delete — otherwise the ledger keeps
        // a phantom OUT for a payment that no longer exists anywhere else.
        await recordLedgerEntry(tx, {
          direction: "IN",
          amountPaise: payment.amount,
          cashAccountId: payment.fromAccountId,
          creditorId: payment.creditorId,
          category: payment.category,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          occurredAt: new Date(),
          description: `Reversal: payment to ${payment.payeeName} deleted`,
          createdById: actorId(req),
        });
      }
      await tx.cashPayment.delete({ where: { id } });
    });

    const fresh = await findDay(payment.dayId);
    return sendOk(res, buildDayView(fresh!));
  },
);

// Approve / hold / reject a payment (cash guard enforced on approve)
router.post(
  "/payments/:id/status",
  can(PERMS.CASH_PLANNING.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const parsed = cashPaymentStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const { status, note } = parsed.data;

    const dayId = await db.$transaction(async (tx) => {
      const payment = await tx.cashPayment.findUnique({
        where: { id },
        include: { day: { select: { status: true } } },
      });
      if (!payment) throw new NotFoundError("Payment not found");
      assertOpen(payment.day.status);

      const wasApproved = payment.status === "APPROVED";
      const willApprove = status === "APPROVED";

      // Cash guard: approving must not push approved total past available cash —
      // checked both for the pool overall and for the specific account this
      // payment draws from, since one account can run dry while the pool
      // still looks fine on paper.
      if (willApprove && !wasApproved) {
        const pool = await poolTotals(tx, payment.dayId, id);
        if (Number(payment.amount) > pool.availableCash) {
          throw new BadRequestError(
            "Approving this payment would exceed available cash",
          );
        }
        if (payment.fromAccountId) {
          const account = await accountTotals(tx, payment.dayId, payment.fromAccountId, id);
          if (Number(payment.amount) > account.availableCash) {
            const acc = await tx.cashAccount.findUnique({
              where: { id: payment.fromAccountId },
              select: { name: true },
            });
            throw new BadRequestError(
              `Approving this payment would exceed available cash in ${acc?.name ?? "the selected account"}`,
            );
          }
        }
      }

      // Draw down / restore the linked creditor's outstanding on approval edge.
      if (payment.creditorId) {
        if (willApprove && !wasApproved) {
          await tx.creditor.update({
            where: { id: payment.creditorId },
            data: { outstandingBalance: { decrement: payment.amount } },
          });
        } else if (!willApprove && wasApproved) {
          await tx.creditor.update({
            where: { id: payment.creditorId },
            data: { outstandingBalance: { increment: payment.amount } },
          });
        }
      }

      await tx.cashPayment.update({
        where: { id },
        data: {
          status,
          note: note ?? payment.note,
          approvedById: willApprove ? actorId(req) : null,
          approvedAt: willApprove ? new Date() : null,
        },
      });

      if (willApprove && !wasApproved) {
        await recordLedgerEntry(tx, {
          direction: "OUT",
          amountPaise: payment.amount,
          cashAccountId: payment.fromAccountId,
          creditorId: payment.creditorId,
          category: payment.category,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          occurredAt: new Date(),
          description: `Payment to ${payment.payeeName}`,
          createdById: actorId(req),
        });
      } else if (!willApprove && wasApproved) {
        await recordLedgerEntry(tx, {
          direction: "IN",
          amountPaise: payment.amount,
          cashAccountId: payment.fromAccountId,
          creditorId: payment.creditorId,
          category: payment.category,
          sourceType: "PAYMENT",
          sourceId: payment.id,
          occurredAt: new Date(),
          description: `Reversal: payment to ${payment.payeeName} unapproved`,
          createdById: actorId(req),
        });
      }

      return payment.dayId;
    });

    const fresh = await findDay(dayId);
    return sendOk(res, buildDayView(fresh!));
  },
);

// Bulk approve — approve the given pending payments in one transaction, applying
// the cash guard cumulatively. Replaces the old client-side N round-trip loop.
// Payments are approved in the order given; once the next one would exceed
// available cash, the rest are left untouched (no error — partial approve).
router.post(
  "/days/:id/payments/approve-bulk",
  can(PERMS.CASH_PLANNING.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const day = await loadDayOr404(id);
    assertOpen(day.status);

    const parsed = bulkApproveCashPaymentsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Resolve the requested ids against this day's pending payments, preserving
    // request order. Unknown / non-pending ids are silently skipped.
    const byId = new Map(day.payments.map((p) => [p.id, p]));
    const toApprove = parsed.data.ids
      .map((pid) => byId.get(pid))
      .filter((p): p is NonNullable<typeof p> => !!p && p.status === "PENDING");

    if (toApprove.length > 0) {
      await db.$transaction(async (tx) => {
        const pool = await poolTotals(tx, id);
        let running = pool.approvedTotal;
        const poolCeiling = pool.totalOpening + pool.totalAdjustments;
        const approvedAt = new Date();
        const approvedById = actorId(req);

        // Per-account running totals, seeded from what's already approved
        // today for each account — a payment can be pool-affordable overall
        // but still overdraw the one account it's tagged to. The ceiling per
        // account includes both its opening balance and any adjustments
        // (manual top-ups or receipt credits) posted to it today.
        const adjustedByAccount = new Map<string, number>();
        for (const a of day.adjustments) {
          adjustedByAccount.set(
            a.accountId,
            (adjustedByAccount.get(a.accountId) ?? 0) + Number(a.amountPaise),
          );
        }
        const ceilingByAccount = new Map(
          day.balances.map((b) => [
            b.accountId,
            Number(b.openingBalance) + (adjustedByAccount.get(b.accountId) ?? 0),
          ]),
        );
        const approvedByAccount = new Map<string, number>();
        for (const p of day.payments) {
          if (p.status !== "APPROVED" || !p.fromAccountId) continue;
          approvedByAccount.set(
            p.fromAccountId,
            (approvedByAccount.get(p.fromAccountId) ?? 0) + Number(p.amount),
          );
        }

        for (const p of toApprove) {
          const amount = Number(p.amount);
          // Pool-wide cumulative guard: once the whole pool is out, every
          // later payment is out too (queue is priority-ordered), so a hard
          // stop here is equivalent to checking each one individually.
          if (running + amount > poolCeiling) break;

          // Per-account guard: unlike the pool, one account running dry
          // doesn't mean the next payment (on a different account) won't
          // fit — skip just this one and keep going instead of stopping.
          if (p.fromAccountId) {
            const accCeiling = ceilingByAccount.get(p.fromAccountId) ?? 0;
            const accApproved = approvedByAccount.get(p.fromAccountId) ?? 0;
            if (accApproved + amount > accCeiling) continue;
            approvedByAccount.set(p.fromAccountId, accApproved + amount);
          }
          running += amount;

          if (p.creditorId) {
            await tx.creditor.update({
              where: { id: p.creditorId },
              data: { outstandingBalance: { decrement: p.amount } },
            });
          }
          await tx.cashPayment.update({
            where: { id: p.id },
            data: { status: "APPROVED", approvedById, approvedAt },
          });
          await recordLedgerEntry(tx, {
            direction: "OUT",
            amountPaise: p.amount,
            cashAccountId: p.fromAccountId,
            creditorId: p.creditorId,
            category: p.category,
            sourceType: "PAYMENT",
            sourceId: p.id,
            occurredAt: approvedAt,
            description: `Payment to ${p.payeeName}`,
            createdById: approvedById,
          });
        }
      });
    }

    const fresh = await findDay(id);
    return sendOk(res, buildDayView(fresh!));
  },
);

// Reorder the priority queue (top = pay first)
router.put(
  "/days/:id/payments/reorder",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const day = await loadDayOr404(id);
    assertOpen(day.status);

    const parsed = reorderCashPaymentsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const known = new Set(day.payments.map((p) => p.id));
    if (!parsed.data.orderedIds.every((pid) => known.has(pid))) {
      throw new BadRequestError("orderedIds contains unknown payments");
    }

    // One UPDATE … CASE so reordering is a single round-trip. The previous
    // per-row update loop opened an interactive transaction and blew the 5s
    // budget on larger queues (Transaction API error: expired transaction).
    // Cast each THEN to int: an untyped bind parameter inside CASE is parsed as
    // text, which makes the whole CASE text and fails to assign to the integer
    // "priority" column (Postgres 42804). The ::int pins the type at parse time.
    const cases = parsed.data.orderedIds.map(
      (pid, index) => Prisma.sql`WHEN ${pid} THEN ${index + 1}::int`,
    );
    await db.$executeRaw`
      UPDATE "CashPayment"
      SET "priority" = CASE "id" ${Prisma.join(cases, " ")} END,
          "updatedAt" = NOW()
      WHERE "id" IN (${Prisma.join(parsed.data.orderedIds)})
    `;

    const fresh = await findDay(id);
    return sendOk(res, buildDayView(fresh!));
  },
);

// Manual add-funds / correction against one account for a day — only while
// the day is still OPEN, same rule as editing opening balances. Signed
// amount so it also covers corrections (negative).
router.post(
  "/days/:id/accounts/:accountId/adjustments",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const accountId = req.params.accountId;
    if (!accountId || Array.isArray(accountId)) {
      throw new ValidationError("Invalid account id");
    }
    const day = await loadDayOr404(id);
    assertOpen(day.status);

    if (!day.balances.some((b) => b.accountId === accountId)) {
      throw new BadRequestError("This account isn't part of today's cash position");
    }

    const parsed = createCashAccountAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const me = actorId(req);
    // Wrapped in a transaction (this route previously did a bare create())
    // so the ledger row can never exist without its adjustment, or vice versa.
    await db.$transaction(async (tx) => {
      const adjustment = await tx.cashAccountAdjustment.create({
        data: {
          dayId: id,
          accountId,
          amountPaise: BigInt(parsed.data.amountPaise),
          reason: parsed.data.reason,
          createdById: me,
        },
      });
      await recordLedgerEntry(tx, {
        direction: parsed.data.amountPaise > 0 ? "IN" : "OUT",
        amountPaise: BigInt(Math.abs(parsed.data.amountPaise)),
        cashAccountId: accountId,
        sourceType: "ADJUSTMENT",
        sourceId: adjustment.id,
        occurredAt: new Date(),
        description: parsed.data.reason,
        createdById: me,
      });
    });

    const fresh = await findDay(id);
    return sendOk(res, buildDayView(fresh!));
  },
);

/* ──────────────────── Receivables (global) ──────────────────── */

// List all receivables with pending / expected subtotals.
router.get("/receivables", can(PERMS.CASH_PLANNING.VIEW), async (_req, res) => {
  return sendOk(res, await buildReceivablesView());
});

router.post("/receivables", can(PERMS.CASH_PLANNING.ENTER), async (req, res) => {
  const parsed = createCashReceivableSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const b = parsed.data;

  await db.cashReceivable.create({
    data: {
      partyName: b.partyName,
      totalAmount: BigInt(b.totalAmount),
      expectedAmount: BigInt(b.expectedAmount),
      expectedDate: parseReceivableDate(b.expectedDate),
      note: b.note ?? null,
    },
  });

  return sendOk(res, await buildReceivablesView(), undefined, 201);
});

router.patch(
  "/receivables/:id",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.cashReceivable.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Receivable not found");
    if (existing.source === "BILL")
      throw new BadRequestError(
        "This receivable is synced from a bill and cannot be edited manually",
      );
    const parsed = updateCashReceivableSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const b = parsed.data;

    await db.cashReceivable.update({
      where: { id },
      data: {
        ...(b.partyName !== undefined ? { partyName: b.partyName } : {}),
        ...(b.totalAmount !== undefined
          ? { totalAmount: BigInt(b.totalAmount) }
          : {}),
        ...(b.expectedAmount !== undefined
          ? { expectedAmount: BigInt(b.expectedAmount) }
          : {}),
        ...(b.expectedDate !== undefined
          ? { expectedDate: parseReceivableDate(b.expectedDate) }
          : {}),
        ...(b.note !== undefined ? { note: b.note ?? null } : {}),
      },
    });

    return sendOk(res, await buildReceivablesView());
  },
);

router.post(
  "/receivables/:id/received",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.cashReceivable.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Receivable not found");
    if (existing.source === "BILL")
      throw new BadRequestError(
        "This receivable is synced from a bill — record payment through a receipt instead",
      );
    const parsed = markReceivableReceivedSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Partial receipt: deduct from the outstanding total, accumulate into the
    // received running total, and consume the expected slice. The receivable
    // closes (ackReceived) only once the outstanding hits zero. Receiving more
    // than what's left is clamped to the outstanding.
    const outstanding = Number(existing.totalAmount);
    const receivedNow = Math.min(parsed.data.receivedAmount, outstanding);
    const newOutstanding = outstanding - receivedNow;
    const newReceived = Number(existing.receivedAmount ?? 0n) + receivedNow;

    // Record the slice in the receipt timeline and roll up the parent totals
    // atomically.
    await db.$transaction(async (tx) => {
      if (receivedNow > 0) {
        await tx.cashReceivableReceipt.create({
          data: { receivableId: id, amount: BigInt(receivedNow) },
        });
      }
      await tx.cashReceivable.update({
        where: { id },
        data: {
          totalAmount: BigInt(newOutstanding),
          receivedAmount: BigInt(newReceived),
          expectedAmount: 0n,
          expectedDate: null,
          ackReceived: newOutstanding === 0,
        },
      });
    });

    return sendOk(res, await buildReceivablesView());
  },
);

router.delete(
  "/receivables/:id",
  can(PERMS.CASH_PLANNING.ENTER),
  async (req, res) => {
    const id = getParamId(req);
    const existing = await db.cashReceivable.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Receivable not found");
    if (existing.source === "BILL")
      throw new BadRequestError(
        "This receivable is synced from a bill and cannot be deleted manually — cancel the bill instead",
      );

    await db.cashReceivable.delete({ where: { id } });

    return sendOk(res, await buildReceivablesView());
  },
);

/* ───────────────────────── Creditor ledger ───────────────────────── */

router.get("/ledger", can(PERMS.CASH_PLANNING.VIEW), async (_req, res) => {
  return sendOk(res, await buildLedgerView());
});

export default router;
