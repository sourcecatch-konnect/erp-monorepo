import { Router } from "express";
import {
  createVendorPaymentSlipSchema,
  eligibleTransporterLRQuerySchema,
  submitVendorPaymentSlipSchema,
  updateVendorPaymentSlipSchema,
  type VendorPaymentSlipLineInput,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import {
  Prisma,
  type VendorPaymentStatus,
  type VendorPaymentType,
} from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import { postVendorSlipAccrual } from "../ledger/posting.service.js";
import { decideVendorPaymentApproval } from "./approval-decision.js";
import {
  findEligibleTransporterLRs,
  reconcileTransporterLines,
} from "./calculators/transporter.js";

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
  if (!result.success)
    throw new ValidationError(result.error.flatten().fieldErrors);
  return result.data;
};

const slipDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  transport: { select: { id: true, name: true } },
  labour: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  rejectedBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
  lines: { where: { isActive: true }, orderBy: { createdAt: "asc" as const } },
  disbursements: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.VendorPaymentSlipInclude;

const loadSlipDetail = (id: string) =>
  db.vendorPaymentSlip.findUniqueOrThrow({
    where: { id },
    include: slipDetailInclude,
  });

/* ------------------------------------------------------------------ */
/* Server-authoritative totals. Two stages:                            */
/*  1. buildServerLines re-derives every component from the source      */
/*     document itself (TRANSPORTER) — the client's *Paise fields are   */
/*     prefill-only and never trusted, except stationeryPaise which has */
/*     no stored source anywhere.                                       */
/*  2. recalcSlipTotals recomputes net/gross/deductions from those      */
/*     server-owned components.                                         */
/* ------------------------------------------------------------------ */

/**
 * TRANSPORTER: re-fetches each LR and overwrites every component except
 * stationeryPaise with the server's own figures — a client cannot inflate
 * (or fabricate) a freight/advance/commission/hamali/TDS/damage amount by
 * sending a different number, and a stale/foreign/already-claimed sourceId
 * fails loudly instead of silently posting.
 * HAMALI: passthrough for now — VP-5's calculator (GRN/RailBranchGRN/
 * VPWagonLoading) doesn't exist yet, so there's nothing to reconcile
 * against yet. Wire the same reconciliation in when VP-5 lands.
 */
async function buildServerLines(
  client: typeof db | Prisma.TransactionClient,
  type: VendorPaymentType,
  transportId: string | null,
  lines: VendorPaymentSlipLineInput[],
  excludeSlipId?: string,
): Promise<VendorPaymentSlipLineInput[]> {
  if (type !== "TRANSPORTER") return lines;
  if (!transportId) throw new BadRequestError("A transporter slip needs transportId");

  const sourceIds = lines
    .filter((l) => l.sourceType === "LR")
    .map((l) => l.sourceId);
  const reconciled = await reconcileTransporterLines(
    client,
    transportId,
    sourceIds,
    excludeSlipId,
  );

  return lines.map((line) => {
    const server = reconciled.get(line.sourceId);
    if (!server)
      throw new BadRequestError(`Source ${line.sourceId} is not a valid LR line`);
    return {
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      freightPaise: server.freightPaise,
      detentionPaise: server.detentionPaise,
      advancePaise: server.advancePaise,
      commissionPaise: server.commissionPaise,
      hamaliPaise: server.hamaliPaise,
      tdsPaise: server.tdsPaise,
      damagePaise: server.damagePaise,
      // The one client-owned amount — no stored source to check it against.
      stationeryPaise: line.stationeryPaise,
    };
  });
}

type RecalculatedLine = VendorPaymentSlipLineInput & { netPaise: bigint };

function recalcSlipTotals(type: VendorPaymentType, lines: VendorPaymentSlipLineInput[]) {
  let grossPayablePaise = 0n;
  let totalDeductionsPaise = 0n;
  let netPayablePaise = 0n;

  const netLines: RecalculatedLine[] = lines.map((line) => {
    let gross: bigint;
    let deductions: bigint;
    if (type === "TRANSPORTER") {
      gross = line.freightPaise + line.detentionPaise;
      deductions =
        line.advancePaise +
        line.commissionPaise +
        line.hamaliPaise +
        line.tdsPaise +
        line.damagePaise +
        line.stationeryPaise;
    } else if (type === "HAMALI") {
      // Per VP-5: gross is the claimed hamali amount, net = gross - TDS.
      gross = line.hamaliPaise;
      deductions = line.tdsPaise;
    } else {
      throw new BadRequestError("This vendor payment type is not available yet");
    }
    const net = gross - deductions;
    if (net < 0n)
      throw new BadRequestError(
        `Source ${line.sourceId}: deductions exceed the gross amount`,
      );
    grossPayablePaise += gross;
    totalDeductionsPaise += deductions;
    netPayablePaise += net;
    return { ...line, netPaise: net };
  });

  return { grossPayablePaise, totalDeductionsPaise, netPayablePaise, netLines };
}

const lineCreateData = (lines: RecalculatedLine[]) =>
  lines.map((line) => ({
    sourceType: line.sourceType,
    sourceId: line.sourceId,
    freightPaise: line.freightPaise,
    detentionPaise: line.detentionPaise,
    advancePaise: line.advancePaise,
    commissionPaise: line.commissionPaise,
    hamaliPaise: line.hamaliPaise,
    tdsPaise: line.tdsPaise,
    damagePaise: line.damagePaise,
    stationeryPaise: line.stationeryPaise,
    netPaise: line.netPaise,
  }));

// P2002 here is (in practice) always the VendorPaymentSlipLine_active_source_key
// partial unique index — a concurrent request claimed the same source first.
const isUniqueConflict = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/* ------------------------------------------------------------------ */
/* Calculators                                                         */
/* ------------------------------------------------------------------ */

router.get(
  "/calculators/transporter",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const input = validate(eligibleTransporterLRQuerySchema.safeParse(req.query));
    if (input.branchId) assertBranchAccess(req, input.branchId);
    const branchWhere: Prisma.LRGroupWhereInput = input.branchId
      ? { originBranchId: input.branchId }
      : branchFilter(req, "originBranchId");

    const eligible = await findEligibleTransporterLRs(db, {
      transportId: input.transportId,
      branchWhere,
      from: input.from,
      to: input.to,
    });
    return sendOk(res, eligible);
  },
);

/* ------------------------------------------------------------------ */
/* Slip CRUD (DRAFT) + submit                                          */
/* ------------------------------------------------------------------ */

router.post("/slips", can(PERMS.ACCOUNTS.PAYMENT.CREATE), async (req, res) => {
  const input = validate(createVendorPaymentSlipSchema.safeParse(req.body));
  assertBranchAccess(req, input.branchId);

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new NotFoundError("Branch not found");

  const serverLines = await buildServerLines(
    db,
    input.type,
    input.transportId ?? null,
    input.lines,
  );
  const totals = recalcSlipTotals(input.type, serverLines);
  const me = actorId(req);
  const fyCode = fyCodeFor(new Date());
  const sortedSourceIds = [...new Set(input.lines.map((l) => l.sourceId))].sort();

  const slipId = await db.$transaction(
    async (tx) => {
      // Serialize concurrent claims of the same source document(s) — same
      // advisory-lock pattern billing.route.ts uses for LR reservation.
      for (const sourceId of sortedSourceIds)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceId}))`;

      const seq = await nextSequence(tx, branch.branchCode, fyCode, "VPAY");
      const slipNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/VPAY");

      try {
        const created = await tx.vendorPaymentSlip.create({
          data: {
            slipNumber,
            type: input.type,
            branchId: input.branchId,
            fyCode,
            transportId: input.transportId ?? null,
            labourId: input.labourId ?? null,
            grossPayablePaise: totals.grossPayablePaise,
            totalDeductionsPaise: totals.totalDeductionsPaise,
            netPayablePaise: totals.netPayablePaise,
            status: "DRAFT",
            createdById: me,
            lines: { create: lineCreateData(totals.netLines) },
          },
          select: { id: true },
        });
        return created.id;
      } catch (err) {
        if (isUniqueConflict(err))
          throw new BadRequestError(
            "One or more selected sources are already claimed by another vendor payment slip",
          );
        throw err;
      }
    },
    { timeout: 15000, maxWait: 10000 },
  );

  return sendOk(res, await loadSlipDetail(slipId), undefined, 201);
});

router.patch("/slips/:id", can(PERMS.ACCOUNTS.PAYMENT.CREATE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(updateVendorPaymentSlipSchema.safeParse(req.body));

  const existing = await db.vendorPaymentSlip.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, existing.branchId);
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a draft slip can be edited");
  if (existing.version !== input.version)
    throw new BadRequestError("This draft changed in another session. Refresh and try again.");

  const serverLines = await buildServerLines(
    db,
    existing.type,
    existing.transportId,
    input.lines,
    id,
  );
  const totals = recalcSlipTotals(existing.type, serverLines);
  const sortedSourceIds = [...new Set(input.lines.map((l) => l.sourceId))].sort();

  await db.$transaction(
    async (tx) => {
      for (const sourceId of sortedSourceIds)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceId}))`;

      // A draft's own current lines never block its own re-save — release
      // them before re-claiming, all inside this one transaction.
      await tx.vendorPaymentSlipLine.deleteMany({ where: { slipId: id } });

      try {
        await tx.vendorPaymentSlip.update({
          where: { id, version: input.version },
          data: {
            grossPayablePaise: totals.grossPayablePaise,
            totalDeductionsPaise: totals.totalDeductionsPaise,
            netPayablePaise: totals.netPayablePaise,
            version: { increment: 1 },
            lines: { create: lineCreateData(totals.netLines) },
          },
        });
      } catch (err) {
        if (isUniqueConflict(err))
          throw new BadRequestError(
            "One or more selected sources are already claimed by another vendor payment slip",
          );
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        )
          throw new BadRequestError("This draft changed in another session. Refresh and try again.");
        throw err;
      }
    },
    { timeout: 15000, maxWait: 10000 },
  );

  return sendOk(res, await loadSlipDetail(id));
});

router.post("/slips/:id/submit", can(PERMS.ACCOUNTS.PAYMENT.CREATE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(submitVendorPaymentSlipSchema.safeParse(req.body ?? {}));

  const existing = await db.vendorPaymentSlip.findUnique({
    where: { id },
    include: { lines: { where: { isActive: true } } },
  });
  if (!existing) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, existing.branchId);
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a draft slip can be submitted");
  if (existing.version !== input.version)
    throw new BadRequestError("This draft changed in another session. Refresh and try again.");
  if (existing.lines.length === 0)
    throw new BadRequestError("Add at least one source line before submitting");
  if (existing.netPayablePaise <= 0n)
    throw new BadRequestError("Net payable must be greater than zero to submit");

  const decision = decideVendorPaymentApproval(existing.type, existing.netPayablePaise);
  const me = actorId(req);

  const slipId = await db.$transaction(
    async (tx) => {
      if (decision === "REQUIRE_APPROVAL") {
        try {
          await tx.vendorPaymentSlip.update({
            where: { id, version: input.version },
            data: { status: "PENDING_APPROVAL", version: { increment: 1 } },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025"
          )
            throw new BadRequestError("This draft changed in another session. Refresh and try again.");
          throw err;
        }
        return id;
      }

      // AUTO_APPROVE — approve and post the accrual atomically.
      let approved;
      try {
        approved = await tx.vendorPaymentSlip.update({
          where: { id, version: input.version },
          data: {
            status: "APPROVED",
            approvedById: me,
            approvedAt: new Date(),
            version: { increment: 1 },
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        )
          throw new BadRequestError("This draft changed in another session. Refresh and try again.");
        throw err;
      }

      const journal = await postVendorSlipAccrual(tx, {
        slipId: approved.id,
        slipNumber: approved.slipNumber,
        type: approved.type,
        branchId: approved.branchId,
        fyCode: approved.fyCode,
        voucherDate: new Date(),
        transportId: approved.transportId,
        labourId: approved.labourId,
        lines: existing.lines.map((l) => ({
          freightPaise: l.freightPaise,
          detentionPaise: l.detentionPaise,
          advancePaise: l.advancePaise,
          commissionPaise: l.commissionPaise,
          hamaliPaise: l.hamaliPaise,
          tdsPaise: l.tdsPaise,
          damagePaise: l.damagePaise,
          stationeryPaise: l.stationeryPaise,
        })),
        netPayablePaise: approved.netPayablePaise,
        existingAccrualJournalEntryId: approved.accrualJournalEntryId,
        createdById: me,
      });

      await tx.vendorPaymentSlip.update({
        where: { id },
        data: { accrualJournalEntryId: journal.id },
      });
      return id;
    },
    { timeout: 15000, maxWait: 10000 },
  );

  return sendOk(res, await loadSlipDetail(slipId));
});

router.get("/slips", can(PERMS.ACCOUNTS.PAYMENT.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const type =
    typeof req.query.type === "string" ? (req.query.type as VendorPaymentType) : undefined;
  const status =
    typeof req.query.status === "string"
      ? (req.query.status as VendorPaymentStatus)
      : undefined;
  const where: Prisma.VendorPaymentSlipWhereInput = {
    ...branchFilter(req),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };
  const [data, total] = await Promise.all([
    db.vendorPaymentSlip.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        transport: { select: { id: true, name: true } },
        labour: { select: { id: true, name: true } },
        _count: { select: { lines: true, disbursements: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.vendorPaymentSlip.count({ where }),
  ]);
  return sendOk(res, data, { page: query.page, size: query.size, total });
});

router.get("/slips/:id", can(PERMS.ACCOUNTS.PAYMENT.VIEW), async (req, res) => {
  const id = getParamId(req);
  const slip = await db.vendorPaymentSlip.findUnique({
    where: { id },
    include: slipDetailInclude,
  });
  if (!slip) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, slip.branchId);
  return sendOk(res, slip);
});

export default router;
