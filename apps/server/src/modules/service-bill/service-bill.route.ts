import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createServiceBillSchema,
  serviceBillListQuerySchema,
  serviceBillOutstandingQuerySchema,
  unbilledServiceLinesQuerySchema,
  cancelServiceBillSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { createJobCardPaymentSlipTx } from "../vendor-payment/job-card-payment.service.js";
import { getServiceBillOutstanding } from "./service-bill-report.service.js";
import {
  createServiceBillTx,
  cancelServiceBillTx,
} from "./service-bill.service.js";

const router: Router = Router();
router.use(authMiddleware);

router.get(
  "/reports/outstanding",
  can(PERMS.WORKSHOP.SERVICEBILL_VIEW),
  async (req, res) => {
    const query = serviceBillOutstandingQuerySchema.parse(req.query);
    if (query.branchId) assertBranchAccess(req, query.branchId);
    const branchIds =
      req.ctx?.branchScope === "ALL" ? null : (req.ctx?.branchIds ?? []);
    sendOk(res, await getServiceBillOutstanding(query, branchIds));
  },
);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const serviceBillDetailInclude = {
  paymentSlips: {
    where: { status: { not: "CANCELLED" as const } },
    take: 1,
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    select: { id: true, slipNumber: true, status: true },
  },
  branch: { select: { id: true, name: true, branchCode: true } },
  serviceProvider: { select: { id: true, name: true, shopName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: true,
  journalEntry: {
    select: {
      id: true,
      voucherNumber: true,
      status: true,
      tallySyncStatus: true,
    },
  },
};

/** Read immutable billed values, including after source-line correction. */
function presentServiceBill<
  T extends { lines: { serviceSnapshot: unknown }[] },
>(bill: T | null) {
  if (!bill) return null;
  return {
    ...bill,
    lines: bill.lines.map(({ serviceSnapshot, ...line }) => ({
      ...line,
      jobCardServiceLine: serviceSnapshot,
    })),
  };
}

/**
 * The "up to date" filtered list old ERP shows before billing: completed
 * (Job Card FINALISED) but not-yet-billed service lines for one provider.
 */
router.get(
  "/unbilled-lines",
  can(PERMS.WORKSHOP.SERVICEBILL_VIEW),
  async (req, res) => {
    const query = unbilledServiceLinesQuerySchema.parse(req.query);
    if (query.branchId) assertBranchAccess(req, query.branchId);

    // "uptoDate" is a date picker (midnight UTC) but finalisedAt carries a
    // real time-of-day — without extending to end-of-day, anything
    // finalised later the same day the user picks gets wrongly excluded.
    let uptoDateInclusive: Date | undefined;
    if (query.uptoDate) {
      uptoDateInclusive = new Date(query.uptoDate);
      uptoDateInclusive.setUTCHours(23, 59, 59, 999);
    }

    const where: Prisma.JobCardServiceLineWhereInput = {
      serviceProviderId: query.serviceProviderId,
      billedInServiceBillId: null,
      ...(query.search
        ? {
            OR: [
              {
                jobCard: {
                  jobCardNumber: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                sparePart: {
                  name: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
      jobCard: {
        status: "FINALISED",
        ...(query.branchId ? { branchId: query.branchId } : branchFilter(req)),
        ...(uptoDateInclusive
          ? { finalisedAt: { lte: uptoDateInclusive } }
          : {}),
      },
    };
    const [lines, total] = await Promise.all([
      db.jobCardServiceLine.findMany({
        where,
        include: {
          jobCard: {
            select: {
              id: true,
              jobCardNumber: true,
              vehicleId: true,
              finalisedAt: true,
            },
          },
          sparePart: { select: { id: true, name: true } },
        },
        orderBy: [{ jobCard: { finalisedAt: "asc" } }, { id: "asc" }],
        skip: query.page * query.size,
        take: query.size,
      }),
      db.jobCardServiceLine.count({ where }),
    ]);
    sendOk(res, lines, { page: query.page, size: query.size, total });
  },
);

router.get("/", can(PERMS.WORKSHOP.SERVICEBILL_VIEW), async (req, res) => {
  const query = serviceBillListQuerySchema.parse(req.query);
  if (query.branchId) assertBranchAccess(req, query.branchId);
  const where = {
    ...branchFilter(req),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.serviceProviderId
      ? { serviceProviderId: query.serviceProviderId }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            {
              serviceBillNumber: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              providerInvoiceNo: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
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
      include: {
        branch: serviceBillDetailInclude.branch,
        serviceProvider: serviceBillDetailInclude.serviceProvider,
        journalEntry: serviceBillDetailInclude.journalEntry,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  assertBranchAccess(req, bill.branchId);
  sendOk(res, presentServiceBill(bill));
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
  const bill = await db.$transaction((tx) =>
    createServiceBillTx(tx, input, branch.branchCode, actorId(req)),
  );
  const result = await db.serviceBill.findUnique({
    where: { id: bill.id },
    include: serviceBillDetailInclude,
  });
  sendOk(res, presentServiceBill(result), undefined, 201);
});

router.post(
  "/:id/cancel",
  can(PERMS.WORKSHOP.SERVICEBILL_MANAGE),
  async (req, res) => {
    const input = cancelServiceBillSchema.parse(req.body);
    const bill = await db.serviceBill.findUnique({
      where: { id: getParamId(req) },
    });
    if (!bill) throw new NotFoundError("Service bill not found");
    assertBranchAccess(req, bill.branchId);
    await db.$transaction((tx) =>
      cancelServiceBillTx(tx, bill, input.reason, actorId(req)),
    );
    const result = await db.serviceBill.findUnique({
      where: { id: bill.id },
      include: serviceBillDetailInclude,
    });
    sendOk(res, presentServiceBill(result));
  },
);
router.get(
  "/:id/payments",
  can(PERMS.WORKSHOP.SERVICEBILL_VIEW),
  async (req, res) => {
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
        journalEntry: {
          select: { id: true, voucherNumber: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    sendOk(res, payments);
  },
);

// All new payments use the shared permission/approval/disbursement workflow.
router.post(
  "/:id/payment-slip",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const bill = await db.serviceBill.findUnique({
      where: { id: getParamId(req) },
      select: { id: true, branchId: true },
    });
    if (!bill) throw new NotFoundError("Service bill not found");
    assertBranchAccess(req, bill.branchId);
    const slip = await db.$transaction((tx) =>
      createJobCardPaymentSlipTx(tx, bill.id, bill.branchId, actorId(req)),
    );
    sendOk(res, slip, undefined, 201);
  },
);

router.post(
  "/:id/pay",
  can(PERMS.WORKSHOP.SERVICEBILL_PAY),
  async (_req, _res) => {
    throw new BadRequestError(
      "Direct service-bill payments have been replaced by payment slips. Prepare a payment slip and submit it for approval.",
    );
  },
);
export default router;
