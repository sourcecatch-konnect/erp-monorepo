import { Router } from "express";
import {
  cancelDriverSalaryRunSchema,
  createDriverPayoutSchema,
  createDriverSalaryAdvanceSchema,
  createDriverSalaryRunSchema,
  driverFinanceListQuerySchema,
  driverSalaryRunListQuerySchema,
  driverSalaryRunVersionSchema,
  ledgerQuerySchema,
  payDriverSalaryRunSchema,
  reverseDriverFinanceEntrySchema,
  updateDriverSalaryRunSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { recordAuditEntry } from "../audit/audit.service.js";
import {
  createDriverPayout,
  createDriverSalaryAdvance,
  driverLedgerBalance,
  fundingAccounts,
  leftDriversWithBalance,
  logSlipPayoutStatus,
  reverseDriverPayout,
  reverseDriverSalaryAdvance,
  unpaidApprovedSalary,
  unpaidLogSlipsForDriver,
} from "./driver-finance.service.js";
import { buildDriverStatement } from "./driver-statement.service.js";
import {
  driverFinanceStartDate,
  driverSalaryEarlyApprovalAllowed,
  driverSalaryMakerCheckerEnabled,
} from "./driver-finance.config.js";
import {
  approveSalaryRun,
  cancelSalaryRun,
  createSalaryRun,
  headOfficeBranch,
  monthLabel,
  paySalaryRun,
  salaryRunDetail,
  updateSalaryRun,
} from "./salary-run.service.js";

/**
 * Driver finance — salary advances and payouts (Driver Lifecycle Phase 2).
 * Mounted at /driver-finance. Salary runs (Phase 3) will join this router.
 */
const router: Router = Router();
router.use(authMiddleware);
const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const validate = <T>(
  result:
    | { success: true; data: T }
    | {
        success: false;
        error: { flatten: () => { fieldErrors: Record<string, string[]> } };
      },
) => {
  if (!result.success) throw new ValidationError(result.error.flatten().fieldErrors);
  return result.data;
};

const namedUser = { select: { id: true, firstName: true, lastName: true } } as const;

/* ------------------------------------------------------------------ */
/* Driver balance                                                      */
/* ------------------------------------------------------------------ */

// Signed balance of the driver's ledger: positive = driver owes us,
// negative = we owe the driver. Used by the Pay dialog.
router.get(
  "/drivers/:id/balance",
  can(PERMS.DRIVER_FINANCE.SALARY_VIEW),
  async (req, res) => {
    const driverId = getParamId(req);
    const driver = await db.driver.findUnique({
      where: { id: driverId },
      select: { id: true, name: true },
    });
    if (!driver) throw new NotFoundError("Driver not found");
    const [balance, unpaidLogSlips, salaryDue] = await Promise.all([
      driverLedgerBalance(db, driverId),
      unpaidLogSlipsForDriver(db, driverId),
      unpaidApprovedSalary(db, driverId),
    ]);
    return sendOk(res, {
      driver,
      ...balance,
      unpaidLogSlips,
      salaryDue: { amountPaise: salaryDue.amountPaise, runNumbers: salaryDue.runNumbers },
    });
  },
);

// Driver statement — every voucher on the driver's ledger since the
// driver-finance start date, with a running balance. Ledgers → Driver tab.
router.get(
  "/drivers/:id/statement",
  can(PERMS.LEDGER.VIEW),
  async (req, res) => {
    const range = validate(ledgerQuerySchema.safeParse(req.query));
    return sendOk(res, await buildDriverStatement(getParamId(req), range));
  },
);

/* ------------------------------------------------------------------ */
/* Salary advances                                                     */
/* ------------------------------------------------------------------ */

const salaryAdvanceInclude = {
  driver: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, branchCode: true } },
  fundingLedger: { select: { id: true, name: true } },
  createdBy: namedUser,
  reversedBy: namedUser,
} satisfies Prisma.DriverSalaryAdvanceInclude;

router.get(
  "/salary-advances",
  can(PERMS.DRIVER_FINANCE.SALARY_VIEW),
  async (req, res) => {
    const query = parseListQuery(req);
    const filters = validate(driverFinanceListQuerySchema.safeParse(req.query));
    const where: Prisma.DriverSalaryAdvanceWhereInput = {
      ...branchFilter(req),
      ...(filters.driverId ? { driverId: filters.driverId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(query.search
        ? {
            OR: [
              { advanceNumber: { contains: query.search, mode: "insensitive" } },
              { driver: { name: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      db.driverSalaryAdvance.findMany({
        where,
        include: salaryAdvanceInclude,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip: query.page * query.size,
        take: query.size,
      }),
      db.driverSalaryAdvance.count({ where }),
    ]);
    return sendOk(res, data, { page: query.page, size: query.size, total });
  },
);

router.post(
  "/salary-advances",
  can(PERMS.DRIVER_FINANCE.ADVANCE_MANAGE),
  async (req, res) => {
    const input = validate(createDriverSalaryAdvanceSchema.safeParse(req.body));
    assertBranchAccess(req, input.branchId);

    const advance = await createDriverSalaryAdvance(input, actorId(req));
    await recordAuditEntry({
      actor: { id: actorId(req) },
      action: "driver_finance.salary_advance.create",
      entity: "DriverSalaryAdvance",
      entityId: advance.id,
      after: { amountPaise: advance.amountPaise.toString(), driverId: advance.driverId },
    });

    const full = await db.driverSalaryAdvance.findUniqueOrThrow({
      where: { id: advance.id },
      include: salaryAdvanceInclude,
    });
    return sendOk(res, full, undefined, 201);
  },
);

router.post(
  "/salary-advances/:id/reverse",
  can(PERMS.DRIVER_FINANCE.ADVANCE_MANAGE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(reverseDriverFinanceEntrySchema.safeParse(req.body));
    const existing = await db.driverSalaryAdvance.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!existing) throw new NotFoundError("Salary advance not found");
    assertBranchAccess(req, existing.branchId);

    await reverseDriverSalaryAdvance(id, input.reason, actorId(req));
    await recordAuditEntry({
      actor: { id: actorId(req) },
      action: "driver_finance.salary_advance.reverse",
      entity: "DriverSalaryAdvance",
      entityId: id,
      after: { reason: input.reason },
    });

    const full = await db.driverSalaryAdvance.findUniqueOrThrow({
      where: { id },
      include: salaryAdvanceInclude,
    });
    return sendOk(res, full);
  },
);

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

const payoutInclude = {
  driver: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, branchCode: true } },
  fundingLedger: { select: { id: true, name: true } },
  logSlip: { select: { id: true, logSlipNumber: true, journeyId: true } },
  salaryRun: { select: { id: true, runNumber: true, month: true } },
  createdBy: namedUser,
  reversedBy: namedUser,
} satisfies Prisma.DriverPayoutInclude;

router.get("/payouts", can(PERMS.DRIVER_FINANCE.SALARY_VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(driverFinanceListQuerySchema.safeParse(req.query));
  const where: Prisma.DriverPayoutWhereInput = {
    ...branchFilter(req),
    ...(filters.driverId ? { driverId: filters.driverId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(query.search
      ? {
          OR: [
            { payoutNumber: { contains: query.search, mode: "insensitive" } },
            { driver: { name: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    db.driverPayout.findMany({
      where,
      include: payoutInclude,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip: query.page * query.size,
      take: query.size,
    }),
    db.driverPayout.count({ where }),
  ]);
  return sendOk(res, data, { page: query.page, size: query.size, total });
});

router.post("/payouts", can(PERMS.DRIVER_FINANCE.PAY), async (req, res) => {
  const input = validate(createDriverPayoutSchema.safeParse(req.body));
  if (input.source === "MANUAL") assertBranchAccess(req, input.branchId!);
  else {
    const status = await logSlipPayoutStatus(db, input.logSlipId!);
    assertBranchAccess(req, status.branchId);
  }

  const payout = await createDriverPayout(input, actorId(req));
  await recordAuditEntry({
    actor: { id: actorId(req) },
    action: "driver_finance.payout.create",
    entity: "DriverPayout",
    entityId: payout.id,
    after: {
      amountPaise: payout.amountPaise.toString(),
      driverId: payout.driverId,
      source: payout.source,
      clientRequestId: payout.clientRequestId,
    },
  });

  const full = await db.driverPayout.findUniqueOrThrow({
    where: { id: payout.id },
    include: payoutInclude,
  });
  return sendOk(res, full, undefined, 201);
});

router.post("/payouts/:id/reverse", can(PERMS.DRIVER_FINANCE.PAY), async (req, res) => {
  const id = getParamId(req);
  const input = validate(reverseDriverFinanceEntrySchema.safeParse(req.body));
  const existing = await db.driverPayout.findUnique({
    where: { id },
    select: { branchId: true },
  });
  if (!existing) throw new NotFoundError("Payment not found");
  assertBranchAccess(req, existing.branchId);

  await reverseDriverPayout(id, input.reason, actorId(req));
  await recordAuditEntry({
    actor: { id: actorId(req) },
    action: "driver_finance.payout.reverse",
    entity: "DriverPayout",
    entityId: id,
    after: { reason: input.reason },
  });

  const full = await db.driverPayout.findUniqueOrThrow({
    where: { id },
    include: payoutInclude,
  });
  return sendOk(res, full);
});

/* ------------------------------------------------------------------ */
/* Salary runs                                                         */
/* ------------------------------------------------------------------ */

// Cash / bank accounts with what each holds now — the pay screens show it
// and refuse a payment bigger than that.
router.get(
  "/funding-accounts",
  can(PERMS.DRIVER_FINANCE.SALARY_VIEW),
  async (_req, res) => sendOk(res, await fundingAccounts()),
);

// Drivers who left with an unsettled account (G9) — shown as a warning on
// the salary run screens so the office recovers or pays it.
router.get(
  "/left-with-balance",
  can(PERMS.DRIVER_FINANCE.SALARY_VIEW),
  async (_req, res) => sendOk(res, await leftDriversWithBalance()),
);

// Go-live date and whether the testing switches are on — the Salary Runs page
// shows the date and warns while testing mode is on.
router.get("/settings", can(PERMS.DRIVER_FINANCE.SALARY_VIEW), async (req, res) => {
  const ho = await headOfficeBranch();
  return sendOk(res, {
    startDate: driverFinanceStartDate().toISOString().slice(0, 10),
    makerChecker: driverSalaryMakerCheckerEnabled(),
    earlyApproval: driverSalaryEarlyApprovalAllowed(),
    headOffice: ho,
    /** Salary runs are done at head office only (G2). */
    canRunSalary: hasBranch(req, ho.id),
  });
});

/** True when the user can work in this branch (all-branch users always can). */
const hasBranch = (req: Parameters<typeof assertBranchAccess>[0], branchId: string) =>
  req.ctx?.branchScope === "ALL" || Boolean(req.ctx?.branchIds.includes(branchId));

/** Salary runs belong to head office — explain that instead of a bare 403. */
const assertHeadOfficeAccess = (
  req: Parameters<typeof assertBranchAccess>[0],
  ho: { id: string; name: string },
) => {
  if (!hasBranch(req, ho.id))
    throw new ForbiddenError(
      `Driver salary is run at ${ho.name} — your login does not have access to that branch`,
    );
};

router.get("/salary-runs", can(PERMS.DRIVER_FINANCE.SALARY_VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(driverSalaryRunListQuerySchema.safeParse(req.query));
  const where: Prisma.DriverSalaryRunWhereInput = {
    ...branchFilter(req),
    ...(filters.status ? { status: filters.status } : {}),
    ...(query.search
      ? {
          OR: [
            { runNumber: { contains: query.search, mode: "insensitive" } },
            { month: { contains: query.search } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    db.driverSalaryRun.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        _count: { select: { salaries: { where: { isActive: true } } } },
      },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      skip: query.page * query.size,
      take: query.size,
    }),
    db.driverSalaryRun.count({ where }),
  ]);
  return sendOk(
    res,
    data.map((run) => ({ ...run, monthLabel: monthLabel(run.month) })),
    { page: query.page, size: query.size, total },
  );
});

const assertRunAccess = async (req: Parameters<typeof assertBranchAccess>[0], id: string) => {
  const run = await db.driverSalaryRun.findUnique({
    where: { id },
    select: { branch: { select: { id: true, name: true } } },
  });
  if (!run) throw new NotFoundError("Salary run not found");
  assertHeadOfficeAccess(req, run.branch);
};

router.get("/salary-runs/:id", can(PERMS.DRIVER_FINANCE.SALARY_VIEW), async (req, res) => {
  const id = getParamId(req);
  await assertRunAccess(req, id);
  return sendOk(res, await salaryRunDetail(id));
});

router.post("/salary-runs", can(PERMS.DRIVER_FINANCE.SALARY_MANAGE), async (req, res) => {
  const input = validate(createDriverSalaryRunSchema.safeParse(req.body));
  const ho = await headOfficeBranch();
  assertHeadOfficeAccess(req, ho);
  const run = await createSalaryRun(input, actorId(req), ho.id);
  await recordAuditEntry({
    actor: { id: actorId(req) },
    action: "driver_finance.salary_run.create",
    entity: "DriverSalaryRun",
    entityId: run.id,
    after: { month: input.month },
  });
  return sendOk(res, await salaryRunDetail(run.id), undefined, 201);
});

router.patch("/salary-runs/:id", can(PERMS.DRIVER_FINANCE.SALARY_MANAGE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(updateDriverSalaryRunSchema.safeParse(req.body));
  await assertRunAccess(req, id);
  if (input.updateMaster && !req.ctx?.permissions.has(PERMS.MASTERS.DRIVER.UPDATE))
    throw new ForbiddenError("You can change the salary in this run, but not in the Driver master");
  const result = await updateSalaryRun(id, input);
  if (result.masterUpdates.length)
    await recordAuditEntry({
      actor: { id: actorId(req) },
      action: "driver_finance.salary_run.update_master_salary",
      entity: "DriverSalaryRun",
      entityId: id,
      after: { drivers: result.masterUpdates },
    });
  return sendOk(res, await salaryRunDetail(id));
});

router.post(
  "/salary-runs/:id/approve",
  can(PERMS.DRIVER_FINANCE.SALARY_APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(driverSalaryRunVersionSchema.safeParse(req.body));
    await assertRunAccess(req, id);
    await approveSalaryRun(id, input.version, actorId(req));
    await recordAuditEntry({
      actor: { id: actorId(req) },
      action: "driver_finance.salary_run.approve",
      entity: "DriverSalaryRun",
      entityId: id,
    });
    return sendOk(res, await salaryRunDetail(id));
  },
);

router.post("/salary-runs/:id/pay", can(PERMS.DRIVER_FINANCE.PAY), async (req, res) => {
  const id = getParamId(req);
  const input = validate(payDriverSalaryRunSchema.safeParse(req.body));
  await assertRunAccess(req, id);
  await paySalaryRun(id, input, actorId(req));
  await recordAuditEntry({
    actor: { id: actorId(req) },
    action: "driver_finance.salary_run.pay",
    entity: "DriverSalaryRun",
    entityId: id,
    after: { driverIds: input.driverIds, clientRequestId: input.clientRequestId },
  });
  return sendOk(res, await salaryRunDetail(id));
});

router.post(
  "/salary-runs/:id/cancel",
  can(PERMS.DRIVER_FINANCE.SALARY_APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(cancelDriverSalaryRunSchema.safeParse(req.body));
    await assertRunAccess(req, id);
    await cancelSalaryRun(id, input.version, input.reason, actorId(req));
    await recordAuditEntry({
      actor: { id: actorId(req) },
      action: "driver_finance.salary_run.cancel",
      entity: "DriverSalaryRun",
      entityId: id,
      after: { reason: input.reason },
    });
    return sendOk(res, await salaryRunDetail(id));
  },
);

/* ------------------------------------------------------------------ */
/* Log slip payout status                                              */
/* ------------------------------------------------------------------ */

// How much of a log slip's "we owe the driver" balance is still unpaid —
// drives the "Paid in cash" button on the log slip workbench.
router.get(
  "/log-slips/:id/payout-status",
  can(PERMS.DRIVER_FINANCE.SALARY_VIEW),
  async (req, res) => {
    const status = await logSlipPayoutStatus(db, getParamId(req));
    assertBranchAccess(req, status.branchId);
    return sendOk(res, status);
  },
);

export default router;
