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
import {
  computeLogSlip,
  logSlipInclude,
  logSlipListSelect,
} from "./log-slip.service.js";
import { buildLogSlipPdfHtml } from "./log-slip.pdf.js";
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
      select: { id: true, status: true, journeyId: true },
    });
    if (!slip) throw new NotFoundError("Log slip not found");
    if (slip.status !== "GENERATED") {
      throw new BadRequestError("Only a generated log slip can be posted");
    }

    // NOTE: journal entries are created here once the accounts ledger core
    // (JournalPostingService, plan §7) lands. Until then posting settles the
    // journey operationally; postedJournalEntryId stays null.
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.logSlip.update({
        where: { id },
        data: {
          status: "POSTED_TO_ACCOUNTS",
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
/* Reopen (audited)                                                   */
/* ------------------------------------------------------------------ */
router.post("/:id/reopen", can(PERMS.LOGSLIP.REOPEN), async (req, res) => {
  const id = getParamId(req);
  const me = actorId(req);

  const slip = await db.logSlip.findUnique({
    where: { id },
    select: { id: true, status: true, journeyId: true },
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
    const row = await tx.logSlip.update({
      where: { id },
      data: {
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
