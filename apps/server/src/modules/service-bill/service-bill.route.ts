import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createServiceBillSchema,
  serviceBillListQuerySchema,
  unbilledServiceLinesQuerySchema,
  cancelServiceBillSchema,
  createServiceBillPaymentSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import {
  postServiceBillVoucher,
  postServiceBillPaymentVoucher,
  reverseJournal,
} from "../ledger/posting.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const serviceBillDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  serviceProvider: { select: { id: true, name: true, shopName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include: {
      jobCardServiceLine: {
        include: {
          jobCard: { select: { id: true, jobCardNumber: true, vehicleId: true } },
          sparePart: { select: { id: true, name: true } },
        },
      },
    },
  },
  journalEntry: {
    select: { id: true, voucherNumber: true, status: true, tallySyncStatus: true },
  },
};

/**
 * The "up to date" filtered list old ERP shows before billing: completed
 * (Job Card FINALISED) but not-yet-billed service lines for one provider.
 */
router.get(
  "/unbilled-lines",
  can(PERMS.WORKSHOP.SERVICEBILL_VIEW),
  async (req, res) => {
    const query = unbilledServiceLinesQuerySchema.parse(req.query);

    // "uptoDate" is a date picker (midnight UTC) but finalisedAt carries a
    // real time-of-day — without extending to end-of-day, anything
    // finalised later the same day the user picks gets wrongly excluded.
    let uptoDateInclusive: Date | undefined;
    if (query.uptoDate) {
      uptoDateInclusive = new Date(query.uptoDate);
      uptoDateInclusive.setUTCHours(23, 59, 59, 999);
    }

    const lines = await db.jobCardServiceLine.findMany({
      where: {
        serviceProviderId: query.serviceProviderId,
        billedInServiceBillId: null,
        jobCard: {
          status: "FINALISED",
          ...(query.branchId ? { branchId: query.branchId } : branchFilter(req)),
          ...(uptoDateInclusive ? { finalisedAt: { lte: uptoDateInclusive } } : {}),
        },
      },
      include: {
        jobCard: {
          select: { id: true, jobCardNumber: true, vehicleId: true, finalisedAt: true },
        },
        sparePart: { select: { id: true, name: true } },
      },
      orderBy: { jobCard: { finalisedAt: "asc" } },
    });
    sendOk(res, lines);
  },
);

router.get("/", can(PERMS.WORKSHOP.SERVICEBILL_VIEW), async (req, res) => {
  const query = serviceBillListQuerySchema.parse(req.query);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.serviceProviderId ? { serviceProviderId: query.serviceProviderId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
        OR: [
          { serviceBillNumber: { contains: query.search, mode: "insensitive" as const } },
          { providerInvoiceNo: { contains: query.search, mode: "insensitive" as const } },
          {
            serviceProvider: {
              name: { contains: query.search, mode: "insensitive" as const },
            },
          },
        ],
      }
      : {}),
  };
  const [bills, total] = await Promise.all([
    db.serviceBill.findMany({
      where,
      include: serviceBillDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.serviceBill.count({ where }),
  ]);
  sendOk(res, bills, { page: query.page, size: query.size, total });
});

router.get("/:id", can(PERMS.WORKSHOP.SERVICEBILL_VIEW), async (req, res) => {
  const bill = await db.serviceBill.findUnique({
    where: { id: getParamId(req) },
    include: serviceBillDetailInclude,
  });
  if (!bill) throw new NotFoundError("Service bill not found");
  sendOk(res, bill);
});

/**
 * Old-ERP behaviour: single submit, no separate draft/post step. All
 * selected lines must belong to the same provider and must come from
 * FINALISED, not-yet-billed Job Cards — enforced again inside the
 * transaction to close the race window against a concurrent bill.
 */
router.post("/", can(PERMS.WORKSHOP.SERVICEBILL_MANAGE), async (req, res) => {
  const input = createServiceBillSchema.parse(req.body);
  assertBranchAccess(req, input.branchId);

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new BadRequestError("Branch not found");

  const lines = await db.jobCardServiceLine.findMany({
    where: { id: { in: input.jobCardServiceLineIds } },
    include: { jobCard: { select: { status: true } } },
  });
  if (lines.length !== new Set(input.jobCardServiceLineIds).size)
    throw new BadRequestError("One or more service lines not found");
  for (const line of lines) {
    if (line.serviceProviderId !== input.serviceProviderId)
      throw new BadRequestError("All selected lines must belong to the same service provider");
    if (line.jobCard.status !== "FINALISED")
      throw new BadRequestError("A selected line's job card is not finalised yet");
    if (line.billedInServiceBillId)
      throw new BadRequestError("A selected line has already been billed");
  }

  const grossAmountPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0n);
  if (input.discountPaise > grossAmountPaise)
    throw new BadRequestError("Discount cannot exceed the gross amount");
  const netAmountPaise = grossAmountPaise - input.discountPaise;

  const fyCode = fyCodeFor(input.billDate);

  const bill = await db.$transaction(async (tx) => {
    // Re-check under the transaction — someone else may have just billed
    // one of these lines.
    const freshLines = await tx.jobCardServiceLine.findMany({
      where: { id: { in: input.jobCardServiceLineIds } },
      select: { id: true, billedInServiceBillId: true },
    });
    if (freshLines.some((l) => l.billedInServiceBillId))
      throw new BadRequestError(
        "A selected line was just billed by someone else — refresh and try again",
      );

    const seq = await nextSequence(tx, branch.branchCode, fyCode, "SBILL");
    const serviceBillNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/SBILL");

    // Parent row, then lines via createMany — nested `lines: { create: [...]
    // }` issues one INSERT per line instead of a single batched statement.
    // The response re-fetches the full detail separately below, so the
    // created lines don't need to be returned here.
    const created = await tx.serviceBill.create({
      data: {
        serviceBillNumber,
        fyCode,
        branchId: input.branchId,
        serviceProviderId: input.serviceProviderId,
        status: "POSTED",
        billDate: input.billDate,
        providerInvoiceNo: input.providerInvoiceNo,
        providerInvoiceDate: input.providerInvoiceDate,
        grossAmountPaise,
        discountPaise: input.discountPaise,
        netAmountPaise,
        remarks: input.remarks,
        createdById: actorId(req),
        postedById: actorId(req),
        postedAt: new Date(),
      },
      select: { id: true, serviceBillNumber: true },
    });

    await Promise.all([
      tx.serviceBillLine.createMany({
        data: lines.map((line) => ({
          serviceBillId: created.id,
          jobCardServiceLineId: line.id,
          amountPaise: line.amountPaise,
        })),
      }),
      tx.jobCardServiceLine.updateMany({
        where: { id: { in: input.jobCardServiceLineIds } },
        data: { billedInServiceBillId: created.id },
      }),
    ]);

    const voucher = await postServiceBillVoucher(tx, {
      serviceBillId: created.id,
      serviceBillNumber: created.serviceBillNumber!,
      billDate: input.billDate,
      branchId: input.branchId,
      fyCode,
      serviceProviderId: input.serviceProviderId,
      netAmountPaise,
      createdById: actorId(req),
    });

    return tx.serviceBill.update({
      where: { id: created.id },
      data: { journalEntryId: voucher.id },
      select: { id: true },
    });
  });

  const result = await db.serviceBill.findUnique({
    where: { id: bill.id },
    include: serviceBillDetailInclude,
  });
  sendOk(res, result, undefined, 201);
});

router.post("/:id/cancel", can(PERMS.WORKSHOP.SERVICEBILL_MANAGE), async (req, res) => {
  const input = cancelServiceBillSchema.parse(req.body);
  const existing = await db.serviceBill.findUnique({
    where: { id: getParamId(req) },
    include: { lines: true },
  });
  if (!existing) throw new NotFoundError("Service bill not found");
  if (existing.status !== "POSTED")
    throw new BadRequestError("Only a POSTED service bill can be cancelled");
  assertBranchAccess(req, existing.branchId);

  await db.$transaction(async (tx) => {
    await tx.jobCardServiceLine.updateMany({
      where: { id: { in: existing.lines.map((l) => l.jobCardServiceLineId) } },
      data: { billedInServiceBillId: null },
    });

    // ServiceBillLine.jobCardServiceLineId is unique — a cancelled bill's
    // lines must be cleared, or re-billing the same service line later
    // collides with this now-void row (the bug being fixed here).
    await tx.serviceBillLine.deleteMany({ where: { serviceBillId: existing.id } });

    if (existing.journalEntryId)
      await reverseJournal(tx, existing.journalEntryId, input.reason, actorId(req));

    await tx.serviceBill.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
        cancelledById: actorId(req),
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
    });
  });

  const updated = await db.serviceBill.findUnique({
    where: { id: existing.id },
    include: serviceBillDetailInclude,
  });
  sendOk(res, updated);
});

router.get("/:id/payments", can(PERMS.WORKSHOP.SERVICEBILL_VIEW), async (req, res) => {
  const serviceBillId = getParamId(req);
  const bill = await db.serviceBill.findUnique({
    where: { id: serviceBillId },
    select: { id: true, branchId: true },
  });
  if (!bill) throw new NotFoundError("Service bill not found");
  assertBranchAccess(req, bill.branchId);

  const payments = await db.serviceBillPayment.findMany({
    where: { serviceBillId },
    include: {
      fromAccount: { select: { id: true, name: true, type: true } },
      journalEntry: { select: { id: true, voucherNumber: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  sendOk(res, payments);
});

/**
 * A dedicated, quick payment path — deliberately NOT routed through the
 * Vendor Payment 3-stage primitive (per ACCOUNTS_MODULE_MAP scope: that
 * engine is a separate epic). Partial-pay aware; a bill is settled once
 * Σ payments == netAmountPaise.
 */
router.post("/:id/pay", can(PERMS.WORKSHOP.SERVICEBILL_PAY), async (req, res) => {
  const input = createServiceBillPaymentSchema.parse(req.body);
  const bill = await db.serviceBill.findUnique({
    where: { id: getParamId(req) },
    select: {
      id: true,
      branchId: true,
      fyCode: true,
      status: true,
      serviceProviderId: true,
      netAmountPaise: true,
      paidAmountPaise: true,
      branch: { select: { branchCode: true } },
    },
  });
  if (!bill) throw new NotFoundError("Service bill not found");
  if (bill.status !== "POSTED")
    throw new BadRequestError("Only a POSTED service bill can be paid");
  assertBranchAccess(req, bill.branchId);

  // "Settled" this round = cash paid + TDS withheld — both close out the
  // bill even though only paidPaise actually leaves the bank.
  const settledPaise = input.paidPaise + input.tdsPaise;
  const pendingPaise = bill.netAmountPaise - bill.paidAmountPaise;
  if (pendingPaise <= 0n) throw new BadRequestError("This service bill is already fully paid");
  if (settledPaise > pendingPaise)
    throw new BadRequestError(
      `Paid + TDS exceeds the pending amount (₹${pendingPaise / 100n})`,
    );

  const fyCode = fyCodeFor(input.paymentDate);

  const payment = await db.$transaction(async (tx) => {
    // Re-check under the transaction against a concurrent payment on the
    // same bill.
    const fresh = await tx.serviceBill.findUnique({
      where: { id: bill.id },
      select: { paidAmountPaise: true, netAmountPaise: true },
    });
    const freshPending = fresh!.netAmountPaise - fresh!.paidAmountPaise;
    if (settledPaise > freshPending)
      throw new BadRequestError(
        "Payment now exceeds the pending amount — someone else may have just paid this bill",
      );

    const seq = await nextSequence(tx, bill.branch.branchCode, fyCode, "SBPAY");
    const voucherNumber = formatDocNumber(bill.branch.branchCode, fyCode, seq, "SKT/SBPAY");

    const created = await tx.serviceBillPayment.create({
      data: {
        serviceBillId: bill.id,
        paidPaise: input.paidPaise,
        tdsPaise: input.tdsPaise,
        paymentMode: input.paymentMode,
        paymentDate: input.paymentDate,
        referenceNumber: input.referenceNumber,
        fromAccountId: input.fromAccountId,
        remarks: input.remarks,
        createdById: actorId(req),
      },
    });

    const voucher = await postServiceBillPaymentVoucher(tx, {
      paymentId: created.id,
      voucherNumber,
      paymentDate: input.paymentDate,
      branchId: bill.branchId,
      fyCode,
      serviceProviderId: bill.serviceProviderId,
      cashAccountId: input.fromAccountId,
      paidPaise: input.paidPaise,
      tdsPaise: input.tdsPaise,
      createdById: actorId(req),
    });

    await tx.serviceBillPayment.update({
      where: { id: created.id },
      data: { journalEntryId: voucher.id },
    });

    await tx.serviceBill.update({
      where: { id: bill.id },
      data: { paidAmountPaise: { increment: settledPaise } },
    });

    return created;
  });

  const result = await db.serviceBillPayment.findUnique({
    where: { id: payment.id },
    include: {
      fromAccount: { select: { id: true, name: true, type: true } },
      journalEntry: { select: { id: true, voucherNumber: true, status: true } },
    },
  });
  sendOk(res, result, undefined, 201);
});

export default router;
