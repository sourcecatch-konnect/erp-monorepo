import { Router } from "express";
import type { Request, Response } from "express";
import { generateLogSlipSchema, reopenLogSlipSchema } from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { parseListQuery } from "../_shared/list.query.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { nextSequence, formatDocNumber } from "../_shared/doc-number.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { computeVehiclePnl } from "./vehicle-pnl.service.js";
import {
  computeMonthlyVehiclePnl,
  MAX_PERIOD_MONTHS,
  monthRange,
} from "./vehicle-pnl-monthly.service.js";
import { MONTH_RE } from "../vehicle-cost/vehicle-cost.service.js";
import {
  computeLogSlip,
  logSlipInclude,
  logSlipListSelect,
} from "./log-slip.service.js";
import { buildLogSlipPdfHtml } from "./log-slip.pdf.js";
import { postLogSlipVoucher, reverseJournal } from "../ledger/posting.service.js";
import { generatePdfFromHtml } from "../../templetes/pdf/pdf.genertaor..js";
import { Prisma, type LogSlipStatus } from "../../../generated/prisma/index.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const LOGSLIP_SEQ_KEY = "LOG";
const TX_BUDGET = { timeout: 15000, maxWait: 10000 } as const;

/* ------------------------------------------------------------------ */
/* List                                                               */
/* ------------------------------------------------------------------ */
router.get("/", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const search = query.search;
  const status = query.filter.status;

  const where: Prisma.LogSlipWhereInput = {
    ...(search
      ? {
          OR: [
            { logSlipNumber: { contains: search, mode: "insensitive" } },
            {
              journey: {
                is: {
                  journeyNumber: { contains: search, mode: "insensitive" },
                },
              },
            },
            {
              vehicle: {
                is: {
                  vehicleNumber: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
    ...(status
      ? {
          status: status.includes(",")
            ? { in: status.split(",") as LogSlipStatus[] }
            : (status as LogSlipStatus),
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.logSlip.findMany({
      where,
      skip: query.page * query.size,
      take: query.size,
      select: logSlipListSelect,
      orderBy: { createdAt: "desc" },
    }),
    db.logSlip.count({ where }),
  ]);

  return sendOk(res, data, { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Vehicle P&L (Phase 7) — registered before "/:id" so "vehicle-pnl"   */
/* isn't swallowed as a log slip id.                                   */
/* ------------------------------------------------------------------ */
router.get("/vehicle-pnl", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(`${req.query.to}T23:59:59.999Z`) : undefined;
  const vehicleId = typeof req.query.vehicleId === "string" ? req.query.vehicleId : undefined;
  const query = parseListQuery(req);
  const { data, total } = await computeVehiclePnl({
    from,
    to,
    vehicleId,
    search: query.search,
    page: query.page,
    size: query.size,
  });
  return sendOk(res, data, { page: query.page, size: query.size, total });
});

// Performance report: every own vehicle (idle ones included) with fixed and
// variable costs applied — the accountant's month-end sheet. Takes ?month=
// for one month, or ?from=&to= (inclusive) for a quarter, year or custom range.
router.get("/vehicle-pnl/monthly", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const from = text(req.query.from) || text(req.query.month);
  const to = text(req.query.to) || from;
  if (!MONTH_RE.test(from) || !MONTH_RE.test(to))
    throw new ValidationError("month must look like 2026-08");
  if (from > to) throw new ValidationError("from month is after to month");
  if (monthRange(from, to).length > MAX_PERIOD_MONTHS)
    throw new ValidationError(`period can be at most ${MAX_PERIOD_MONTHS} months`);
  return sendOk(res, await computeMonthlyVehiclePnl(from, to));
});

// Totals across every matching vehicle (not just the current page) for the
// summary cards.
router.get("/vehicle-pnl/summary", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(`${req.query.to}T23:59:59.999Z`) : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const { summary } = await computeVehiclePnl({ from, to, search });
  return sendOk(res, summary);
});

/* ------------------------------------------------------------------ */
/* Preview — live settlement computed from the journey                */
/* ------------------------------------------------------------------ */
router.get("/:journeyId/preview", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const journeyId = String(req.params.journeyId);
  const computation = await computeLogSlip(journeyId);
  if (!computation) throw new NotFoundError("Journey not found");

  const { journey, lines, ...totals } = computation;
  return sendOk(res, {
    journeyId,
    openingKm: journey.openingKm,
    closingKm: journey.closingKm,
    journeyStatus: journey.status,
    settlementStatus: journey.settlementStatus,
    logSlip: journey.logSlip,
    ...totals,
    lines,
  });
});

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */
router.get("/:id", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const id = getParamId(req);
  const slip = await db.logSlip.findUnique({
    where: { id },
    include: logSlipInclude,
  });
  if (!slip) throw new NotFoundError("Log slip not found");
  return sendOk(res, slip);
});

/* ------------------------------------------------------------------ */
/* PDF                                                                */
/* ------------------------------------------------------------------ */
router.get(
  "/:id/pdf",
  can(PERMS.LOGSLIP.PRINT),
  async (req: Request<{ id: string }>, res: Response) => {
    const id = getParamId(req);
    const slip = await db.logSlip.findUnique({
      where: { id },
      include: logSlipInclude,
    });
    if (!slip) return res.status(404).json({ message: "Log slip not found" });

    const html = buildLogSlipPdfHtml(slip);
    const buffer = await generatePdfFromHtml(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="log-slip-${slip.logSlipNumber ?? slip.id}.pdf"`,
    );
    return res.send(buffer);
  },
);

/* ------------------------------------------------------------------ */
/* Generate — freeze the snapshot                                     */
/* ------------------------------------------------------------------ */
router.post(
  "/:journeyId/generate",
  can(PERMS.LOGSLIP.GENERATE),
  async (req, res) => {
    const journeyId = String(req.params.journeyId);
    const me = actorId(req);

    const parsed = generateLogSlipSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const input = parsed.data;

    const computation = await computeLogSlip(journeyId);
    if (!computation) throw new NotFoundError("Journey not found");
    const { journey } = computation;

    if (journey.status !== "READY_FOR_LOGSLIP") {
      throw new BadRequestError(
        "Journey must be marked ready for log slip before generating",
      );
    }
    // Non-negotiable: no log slip while open legs exist.
    if (computation.warnings.some((w) => w.includes("still open"))) {
      throw new BadRequestError(
        "Cannot generate a log slip while legs are open",
      );
    }
    if (
      journey.closingKm === null ||
      journey.closedAt === null ||
      computation.totalKm === null ||
      computation.totalDays === null
    ) {
      throw new BadRequestError("Journey closing KM / close time is missing");
    }
    if (
      journey.logSlip &&
      !["DRAFT", "REOPENED"].includes(journey.logSlip.status)
    ) {
      throw new BadRequestError(
        `Log slip is already ${journey.logSlip.status.toLowerCase().replace(/_/g, " ")} — reopen it to regenerate`,
      );
    }

    /* ---- derived diesel figures (plan §4.7) ---- */
    const expectedDieselQty = input.standardAverage
      ? computation.totalKm / input.standardAverage
      : null;
    const shortDieselQty =
      expectedDieselQty !== null
        ? computation.totalDieselQty +
          input.previousDieselQty -
          expectedDieselQty
        : null;

    /* ---- number reservation (kept across regenerations) ---- */
    const fyCode = journey.fyCode;
    let logSlipNumber = journey.logSlip?.logSlipNumber ?? null;
    if (!logSlipNumber) {
      const seq = await nextSequence(db, LOGSLIP_SEQ_KEY, fyCode, "LOGSLIP");
      logSlipNumber = formatDocNumber(LOGSLIP_SEQ_KEY, fyCode, seq, "SKL");
    }

    const now = new Date();
    const slipData = {
      logSlipNumber,
      fyCode,
      logSlipDate: input.logSlipDate ?? now,
      status: "GENERATED" as const,
      vehicleId: journey.vehicleId,
      driverId: journey.driverId,
      openingKm: journey.openingKm,
      closingKm: journey.closingKm,
      totalKm: computation.totalKm,
      totalDays: computation.totalDays,
      totalFreightPaise: computation.totalFreightPaise,
      totalAdvancePaise: computation.totalAdvancePaise,
      totalDieselQty: computation.totalDieselQty,
      totalDieselAmountPaise: computation.totalDieselAmountPaise,
      totalCashExpensePaise: computation.totalCashExpensePaise,
      totalCreditExpensePaise: computation.totalCreditExpensePaise,
      totalExpensePaise: computation.totalExpensePaise,
      netVehicleResultPaise: computation.netVehicleResultPaise,
      driverCashExpensePaise: computation.driverCashExpensePaise,
      driverReceivablePaise: computation.driverReceivablePaise,
      driverPayablePaise: computation.driverPayablePaise,
      previousDieselQty: input.previousDieselQty,
      dieselRatePaise: input.dieselRate ?? null,
      standardAverage: input.standardAverage ?? null,
      actualAverage: computation.actualAverage,
      expectedDieselQty,
      shortDieselQty,
      remarks: input.remarks ?? null,
      generatedById: me,
      generatedAt: now,
    };

    const slipId = await db.$transaction(async (tx) => {
      const slip = journey.logSlip
        ? await tx.logSlip.update({
            where: { id: journey.logSlip.id },
            data: { ...slipData, version: { increment: 1 } },
            select: { id: true },
          })
        : await tx.logSlip.create({
            data: { ...slipData, journeyId },
            select: { id: true },
          });

      // Replace the snapshot wholesale — the old lines belong to a superseded
      // (reopened) generation and the diff lives in the audit trail.
      await tx.logSlipLine.deleteMany({ where: { logSlipId: slip.id } });
      await tx.logSlipLine.createMany({
        data: computation.lines.map((line) => ({
          ...line,
          logSlipId: slip.id,
        })),
      });

      await tx.vehicleJourney.update({
        where: { id: journeyId },
        data: {
          settlementStatus: "GENERATED",
          updatedById: me,
          version: { increment: 1 },
        },
      });
      return slip.id;
    }, TX_BUDGET);

    const slip = await db.logSlip.findUnique({
      where: { id: slipId },
      include: logSlipInclude,
    });
    return sendOk(res, slip, undefined, 201);
  },
);

/* ------------------------------------------------------------------ */
/* Post to accounts                                                   */
/* ------------------------------------------------------------------ */
router.post(
  "/:id/post-accounts",
  can(PERMS.LOGSLIP.POST_ACCOUNTS),
  async (req, res) => {
    const id = getParamId(req);
    const me = actorId(req);

    const slip = await db.logSlip.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        journeyId: true,
        logSlipNumber: true,
        logSlipDate: true,
        fyCode: true,
        driverId: true,
        journey: { select: { homeBranchId: true } },
        totalFreightPaise: true,
        totalExpensePaise: true,
        netVehicleResultPaise: true,
        driverReceivablePaise: true,
        driverPayablePaise: true,
      },
    });
    if (!slip) throw new NotFoundError("Log slip not found");
    if (slip.status !== "GENERATED") {
      throw new BadRequestError("Only a generated log slip can be posted");
    }
    if (!slip.logSlipNumber)
      throw new BadRequestError("Log slip has no number assigned");

    const updated = await db.$transaction(async (tx) => {
      // A reopened slip keeps its number, and the earlier (reversed) voucher
      // already used it — suffix the revision so the unique
      // (voucherType, voucherNumber) constraint holds.
      const priorVouchers = await tx.journalEntry.count({
        where: { sourceType: "LOG_SLIP", sourceId: { startsWith: slip.id } },
      });
      const voucher = await postLogSlipVoucher(tx, {
        logSlipId: slip.id,
        logSlipNumber: slip.logSlipNumber!,
        voucherNumber:
          priorVouchers > 0
            ? `${slip.logSlipNumber}/R${priorVouchers}`
            : undefined,
        sourceId: priorVouchers > 0 ? `${slip.id}:R${priorVouchers}` : undefined,
        logSlipDate: slip.logSlipDate,
        branchId: slip.journey.homeBranchId,
        fyCode: slip.fyCode,
        driverId: slip.driverId,
        totalFreightPaise: slip.totalFreightPaise,
        totalExpensePaise: slip.totalExpensePaise,
        netVehicleResultPaise: slip.netVehicleResultPaise,
        driverReceivablePaise: slip.driverReceivablePaise,
        driverPayablePaise: slip.driverPayablePaise,
        createdById: me,
      });

      const row = await tx.logSlip.update({
        where: { id },
        data: {
          status: "POSTED_TO_ACCOUNTS",
          postedJournalEntryId: voucher.id,
          postedById: me,
          postedAt: new Date(),
          version: { increment: 1 },
        },
        include: logSlipInclude,
      });
      await tx.vehicleJourney.update({
        where: { id: slip.journeyId },
        data: {
          status: "SETTLED",
          settlementStatus: "POSTED",
          updatedById: me,
          version: { increment: 1 },
        },
      });
      return row;
    }, TX_BUDGET);

    return sendOk(res, updated);
  },
);

/* ------------------------------------------------------------------ */
/* Voucher                                                            */
/* ------------------------------------------------------------------ */
router.get(
  "/:id/voucher",
  can(PERMS.LEDGER.VOUCHER_VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const slip = await db.logSlip.findUnique({
      where: { id },
      select: { postedJournalEntryId: true },
    });
    if (!slip) throw new NotFoundError("Log slip not found");
    if (!slip.postedJournalEntryId)
      throw new NotFoundError("No voucher posted for this log slip yet");
    const voucher = await db.journalEntry.findUniqueOrThrow({
      where: { id: slip.postedJournalEntryId },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          orderBy: { lineNumber: "asc" },
          include: {
            ledger: {
              select: { id: true, name: true, code: true, kind: true, group: true },
            },
          },
        },
        // A Log Slip voucher never carries bill allocations — the dialog
        // still expects the array to exist (it does `.length` on it).
        allocations: true,
      },
    });
    return sendOk(res, voucher);
  },
);

/* ------------------------------------------------------------------ */
/* Reopen (audited)                                                   */
/* ------------------------------------------------------------------ */
router.post("/:id/reopen", can(PERMS.LOGSLIP.REOPEN), async (req, res) => {
  const id = getParamId(req);
  const me = actorId(req);

  const slip = await db.logSlip.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      journeyId: true,
      postedJournalEntryId: true,
    },
  });
  if (!slip) throw new NotFoundError("Log slip not found");
  if (!["GENERATED", "POSTED_TO_ACCOUNTS"].includes(slip.status)) {
    throw new BadRequestError(
      "Only a generated or posted log slip can be reopened",
    );
  }

  const parsed = reopenLogSlipSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const updated = await db.$transaction(async (tx) => {
    // Cancel the posted voucher so the books and Vehicle P&L don't count the
    // old amounts once the slip is edited and re-posted.
    if (slip.postedJournalEntryId)
      await reverseJournal(
        tx,
        slip.postedJournalEntryId,
        parsed.data.reason,
        me,
      );
    const row = await tx.logSlip.update({
      where: { id },
      data: {
        postedJournalEntryId: null,
        status: "REOPENED",
        reopenedById: me,
        reopenedAt: new Date(),
        reopenReason: parsed.data.reason,
        version: { increment: 1 },
      },
      include: logSlipInclude,
    });
    await tx.vehicleJourney.update({
      where: { id: slip.journeyId },
      data: {
        status: "READY_FOR_LOGSLIP",
        settlementStatus: "READY",
        updatedById: me,
        version: { increment: 1 },
      },
    });
    return row;
  }, TX_BUDGET);

  return sendOk(res, updated);
});

export default router;
