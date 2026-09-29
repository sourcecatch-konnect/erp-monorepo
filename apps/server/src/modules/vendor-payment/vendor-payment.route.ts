import { Router } from "express";
import {
  approveVendorPaymentSlipSchema,
  cancelVendorPaymentSlipSchema,
  createVendorPaymentDisbursementSchema,
  createVendorPaymentSlipSchema,
  eligibleHamaliSourceQuerySchema,
  eligibleTransporterLRQuerySchema,
  rejectVendorPaymentSlipSchema,
  submitVendorPaymentSlipSchema,
  updateVendorPaymentSlipSchema,
  vendorPaymentSlipListQuerySchema,
  type VendorPaymentSlipLineInput,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import {
  Prisma,
  type VendorPaymentType,
} from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { roundPaiseByBps } from "../../lib/money.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import {
  postVendorDisbursement,
  postVendorSlipAccrual,
  reverseVendorSlipAccrual,
} from "../ledger/posting.service.js";
import { recordAuditEntry } from "../audit/audit.service.js";
import {
  decideVendorPaymentApproval,
  vendorPaymentMakerCheckerEnabled,
} from "./approval-decision.js";
import {
  findEligibleTransporterLRs,
  reconcileTransporterLines,
} from "./calculators/transporter.js";
import {
  findEligibleHamaliSources,
  reconcileHamaliLines,
  type HamaliSourceType,
} from "./calculators/hamali.js";
import { SLIP_LIST_ORDER_BY, buildSlipListWhere } from "./slip-list.query.js";

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

const ZERO_LINE_COMPONENTS = {
  freightPaise: 0n,
  detentionPaise: 0n,
  advancePaise: 0n,
  commissionPaise: 0n,
  hamaliPaise: 0n,
  tdsPaise: 0n,
  damagePaise: 0n,
  stationeryPaise: 0n,
};

/**
 * TRANSPORTER: re-fetches each LR and overwrites every component except
 * stationeryPaise with the server's own figures.
 * HAMALI: re-fetches each source (GRN/RailBranchGRN/VPWagonLoading) for its
 * gross hamaliPaise, then computes tdsPaise itself via roundPaiseByBps —
 * `tdsRateBps` is the only client input actually used, and even that only
 * feeds a server-side computation, never a submitted amount.
 * Either way: a client cannot inflate/fabricate an amount by sending a
 * different number, and a stale/foreign/already-claimed sourceId fails
 * loudly instead of silently posting.
 */
async function buildServerLines(
  client: typeof db | Prisma.TransactionClient,
  type: VendorPaymentType,
  payee: { transportId: string | null; labourId: string | null },
  lines: VendorPaymentSlipLineInput[],
  tdsRateBps: number | undefined,
  excludeSlipId?: string,
): Promise<VendorPaymentSlipLineInput[]> {
  if (type === "TRANSPORTER") {
    if (!payee.transportId)
      throw new BadRequestError("A transporter slip needs transportId");

    const sourceIds = lines
      .filter((l) => l.sourceType === "LR")
      .map((l) => l.sourceId);
    const reconciled = await reconcileTransporterLines(
      client,
      payee.transportId,
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

  if (type === "HAMALI") {
    if (!payee.labourId) throw new BadRequestError("A hamali slip needs labourId");
    if (tdsRateBps === undefined)
      throw new BadRequestError("A hamali slip needs a TDS percentage");

    const refs = lines.map((l) => ({
      sourceType: l.sourceType as HamaliSourceType,
      sourceId: l.sourceId,
    }));
    const reconciled = await reconcileHamaliLines(
      client,
      payee.labourId,
      refs,
      excludeSlipId,
    );

    return lines.map((line) => {
      const grossPaise = reconciled.get(line.sourceId);
      if (grossPaise === undefined)
        throw new BadRequestError(`Source ${line.sourceId} is not a valid hamali line`);
      return {
        sourceType: line.sourceType,
        sourceId: line.sourceId,
        ...ZERO_LINE_COMPONENTS,
        hamaliPaise: grossPaise,
        tdsPaise: roundPaiseByBps(grossPaise, tdsRateBps),
      };
    });
  }

  throw new BadRequestError("This vendor payment type is not available yet");
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

/**
 * Serialize concurrent claims of the same source document(s) in one round
 * trip instead of one `pg_advisory_xact_lock` call per source id — a slip
 * with N lines used to cost N sequential network round trips just to acquire
 * locks, which is real time spent inside the transaction (and against a
 * remote DB, the dominant cost). The inner subquery sorts by key *before*
 * the lock function is evaluated per row, so locks are still taken in the
 * same fixed ascending order every time — that ordering, not the round-trip
 * count, is what actually prevents a deadlock against a concurrent request
 * claiming an overlapping set in reverse order.
 */
async function lockSources(
  tx: Prisma.TransactionClient,
  sortedSourceIds: string[],
): Promise<void> {
  if (sortedSourceIds.length === 0) return;
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(key))
    FROM (SELECT unnest(${sortedSourceIds}::text[]) AS key ORDER BY key) AS ordered
  `;
}

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

    // One chunk per request: `{ items, nextCursor }` — the client keeps asking
    // with `nextCursor` while it is non-null (no row cap, no count).
    const page = await findEligibleTransporterLRs(db, {
      transportId: input.transportId,
      branchWhere,
      from: input.from,
      to: input.to,
      search: input.search,
      cursor: input.cursor,
      size: input.size,
    });
    return sendOk(res, page);
  },
);

router.get(
  "/calculators/hamali",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const input = validate(eligibleHamaliSourceQuerySchema.safeParse(req.query));
    if (input.branchId) assertBranchAccess(req, input.branchId);

    // The three hamali source types don't share one queryable branch field,
    // so the allowed branches (a chosen one, or the caller's scope) are passed
    // down and applied inside each source's query — same rule branchFilter()
    // applies. Filtering afterwards would drop rows from an already-sized chunk.
    const branchIds = input.branchId
      ? [input.branchId]
      : !req.ctx || req.ctx.branchScope === "ALL"
        ? undefined
        : req.ctx.branchIds;

    const page = await findEligibleHamaliSources(db, {
      labourId: input.labourId,
      branchIds,
      from: input.from,
      to: input.to,
      search: input.search,
      cursor: input.cursor,
      size: input.size,
    });
    return sendOk(res, page);
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
    { transportId: input.transportId ?? null, labourId: input.labourId ?? null },
    input.lines,
    input.tdsRateBps,
  );
  const totals = recalcSlipTotals(input.type, serverLines);
  const me = actorId(req);
  const fyCode = fyCodeFor(new Date());
  const sortedSourceIds = [...new Set(input.lines.map((l) => l.sourceId))].sort();

  // Reserving a number is a single atomic upsert — safe outside the
  // transaction (a rolled-back create just leaves a gap) and one less
  // round trip held under the advisory lock below.
  const seq = await nextSequence(db, branch.branchCode, fyCode, "VPAY");
  // VP-2 spec's literal example is 4 digits (.../<0001>), unlike every
  // other document number in this app (5 digits) — this is the one
  // deliberate exception, not a copy-paste of the app-wide default.
  const slipNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/VPAY", 4);

  const slipId = await db.$transaction(
    async (tx) => {
      // Serialize concurrent claims of the same source document(s) — same
      // advisory-lock pattern billing.route.ts uses for LR reservation.
      await lockSources(tx, sortedSourceIds);

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
    { transportId: existing.transportId, labourId: existing.labourId },
    input.lines,
    input.tdsRateBps,
    id,
  );
  const totals = recalcSlipTotals(existing.type, serverLines);
  const sortedSourceIds = [...new Set(input.lines.map((l) => l.sourceId))].sort();

  await db.$transaction(
    async (tx) => {
      await lockSources(tx, sortedSourceIds);

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

type ActiveLine = {
  freightPaise: bigint;
  detentionPaise: bigint;
  advancePaise: bigint;
  commissionPaise: bigint;
  hamaliPaise: bigint;
  tdsPaise: bigint;
  damagePaise: bigint;
  stationeryPaise: bigint;
};

/**
 * Shared by submit's auto-approve path and the standalone /approve endpoint:
 * version-guarded transition to APPROVED, post the accrual, link the
 * resulting journal — all inside the caller's transaction. A version
 * mismatch (concurrent transition) surfaces as a friendly conflict instead
 * of a raw P2025.
 */
async function approveAndAccrue(
  tx: Prisma.TransactionClient,
  id: string,
  version: number,
  lines: ActiveLine[],
  actorUserId: string,
) {
  let approved;
  try {
    approved = await tx.vendorPaymentSlip.update({
      where: { id, version },
      data: {
        status: "APPROVED",
        approvedById: actorUserId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      throw new BadRequestError("This changed in another session. Refresh and try again.");
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
    lines,
    netPayablePaise: approved.netPayablePaise,
    existingAccrualJournalEntryId: approved.accrualJournalEntryId,
    createdById: actorUserId,
  });

  return tx.vendorPaymentSlip.update({
    where: { id },
    data: { accrualJournalEntryId: journal.id },
  });
}

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

      const approved = await approveAndAccrue(tx, id, input.version, existing.lines, me);
      return approved.id;
    },
    { timeout: 15000, maxWait: 10000 },
  );

  await recordAuditEntry({
    actor: { id: me },
    action: "vendor_payment.submit",
    entity: "VendorPaymentSlip",
    entityId: id,
    after: { decision },
  });

  return sendOk(res, await loadSlipDetail(slipId));
});

router.post("/slips/:id/approve", can(PERMS.ACCOUNTS.PAYMENT.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(approveVendorPaymentSlipSchema.safeParse(req.body ?? {}));

  const existing = await db.vendorPaymentSlip.findUnique({
    where: { id },
    include: { lines: { where: { isActive: true } } },
  });
  if (!existing) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, existing.branchId);
  if (existing.status !== "PENDING_APPROVAL")
    throw new BadRequestError("Only a slip pending approval can be approved");
  if (existing.version !== input.version)
    throw new BadRequestError("This slip changed in another session. Refresh and try again.");

  const me = actorId(req);
  if (vendorPaymentMakerCheckerEnabled() && existing.createdById === me)
    throw new ForbiddenError(
      "Maker-checker is enabled — you cannot approve a slip you submitted yourself",
    );

  const slipId = await db.$transaction(
    (tx) => approveAndAccrue(tx, id, input.version, existing.lines, me).then((s) => s.id),
    { timeout: 15000, maxWait: 10000 },
  );

  await recordAuditEntry({
    actor: { id: me },
    action: "vendor_payment.approve",
    entity: "VendorPaymentSlip",
    entityId: id,
  });

  return sendOk(res, await loadSlipDetail(slipId));
});

router.post("/slips/:id/reject", can(PERMS.ACCOUNTS.PAYMENT.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(rejectVendorPaymentSlipSchema.safeParse(req.body));

  const existing = await db.vendorPaymentSlip.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, existing.branchId);
  if (existing.status !== "PENDING_APPROVAL")
    throw new BadRequestError("Only a slip pending approval can be rejected");
  if (existing.version !== input.version)
    throw new BadRequestError("This slip changed in another session. Refresh and try again.");

  const me = actorId(req);

  // Rejection returns the slip to DRAFT — no journal, no reversal needed
  // (nothing was ever posted). Source reservations (the active lines) stay
  // untouched, so the creator can correct and resubmit without re-claiming.
  try {
    await db.vendorPaymentSlip.update({
      where: { id, version: input.version },
      data: {
        status: "DRAFT",
        rejectedById: me,
        rejectedAt: new Date(),
        rejectionReason: input.reason,
        version: { increment: 1 },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      throw new BadRequestError("This slip changed in another session. Refresh and try again.");
    throw err;
  }

  await recordAuditEntry({
    actor: { id: me },
    action: "vendor_payment.reject",
    entity: "VendorPaymentSlip",
    entityId: id,
    after: { reason: input.reason },
  });

  return sendOk(res, await loadSlipDetail(id));
});

/* ------------------------------------------------------------------ */
/* Disbursement                                                        */
/* ------------------------------------------------------------------ */

// NOTE: the ticket also asks to validate "an open accounting period" —
// there is no such concept anywhere in this codebase (no model, no
// service, no config). Not building a whole period-close feature here;
// flagging it as an explicit gap rather than silently skipping it or
// fabricating a fake check.

router.post(
  "/slips/:id/disburse",
  can(PERMS.ACCOUNTS.PAYMENT.DISBURSE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(createVendorPaymentDisbursementSchema.safeParse(req.body));

    const forAccess = await db.vendorPaymentSlip.findUnique({
      where: { id },
      select: { branchId: true, fyCode: true },
    });
    if (!forAccess) throw new NotFoundError("Vendor payment slip not found");
    assertBranchAccess(req, forAccess.branchId);

    // Idempotency fast path — a retried request with the same
    // clientRequestId returns the prior result unchanged: no re-validation,
    // no second disbursement row, no second journal.
    const priorAttempt = await db.vendorPaymentDisbursement.findUnique({
      where: { clientRequestId: input.clientRequestId },
    });
    if (priorAttempt) {
      if (priorAttempt.slipId !== id)
        throw new BadRequestError(
          "This request id was already used for a different vendor payment slip",
        );
      return sendOk(res, await loadSlipDetail(priorAttempt.slipId));
    }

    // branchId/fyCode are set once at slip creation and never updated by any
    // route, so it's safe to resolve the branch and reserve a voucher number
    // now, against `db`, rather than inside the lock below — one less round
    // trip held while the advisory lock is open, same as the create route.
    const branch = await db.branch.findUnique({
      where: { id: forAccess.branchId },
      select: { branchCode: true },
    });
    if (!branch) throw new NotFoundError("Branch not found");
    const seq = await nextSequence(db, branch.branchCode, forAccess.fyCode, "VPAY-PMT");
    const voucherNumber = formatDocNumber(
      branch.branchCode,
      forAccess.fyCode,
      seq,
      "SKT/VPAY/PMT",
    );

    const me = actorId(req);
    const lockKey = `vendor-payment-slip:${id}`;

    const slipId = await db.$transaction(
      async (tx) => {
        // Lock the slip so two concurrent disbursements against it can't
        // both validate against the same stale "outstanding" figure.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const slip = await tx.vendorPaymentSlip.findUnique({ where: { id } });
        if (!slip) throw new NotFoundError("Vendor payment slip not found");
        if (slip.status !== "APPROVED" && slip.status !== "PARTIALLY_PAID")
          throw new BadRequestError(
            "Only an approved or partially paid slip can be disbursed",
          );

        const outstandingPaise = slip.netPayablePaise - slip.paidPaise;
        if (input.paidPaise > outstandingPaise)
          throw new BadRequestError(
            `Amount exceeds outstanding (${outstandingPaise} paise)`,
          );

        let disbursement;
        try {
          disbursement = await tx.vendorPaymentDisbursement.create({
            data: {
              slipId: id,
              paidPaise: input.paidPaise,
              mode: input.mode,
              paidAt: input.paidAt,
              referenceNo: input.referenceNo ?? null,
              fundingLedgerId: input.fundingLedgerId,
              clientRequestId: input.clientRequestId,
              createdById: me,
            },
          });
        } catch (err) {
          // Race: a concurrent request with the same clientRequestId won
          // first — fall back to its row instead of erroring or duplicating.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const already = await tx.vendorPaymentDisbursement.findUnique({
              where: { clientRequestId: input.clientRequestId },
            });
            if (already) return already.slipId;
          }
          throw err;
        }

        const journal = await postVendorDisbursement(tx, {
          disbursementId: disbursement.id,
          voucherNumber,
          slipId: slip.id,
          slipNumber: slip.slipNumber,
          paidAt: input.paidAt,
          branchId: slip.branchId,
          fyCode: slip.fyCode,
          transportId: slip.transportId,
          labourId: slip.labourId,
          fundingLedgerId: input.fundingLedgerId,
          paidPaise: input.paidPaise,
          existingSettlementJournalEntryId: disbursement.settlementJournalEntryId,
          createdById: me,
        });

        await tx.vendorPaymentDisbursement.update({
          where: { id: disbursement.id },
          data: { settlementJournalEntryId: journal.id },
        });

        const newPaidPaise = slip.paidPaise + input.paidPaise;
        await tx.vendorPaymentSlip.update({
          where: { id },
          data: {
            paidPaise: newPaidPaise,
            status: newPaidPaise >= slip.netPayablePaise ? "PAID" : "PARTIALLY_PAID",
            version: { increment: 1 },
          },
        });

        return id;
      },
      { timeout: 15000, maxWait: 10000 },
    );

    await recordAuditEntry({
      actor: { id: me },
      action: "vendor_payment.disburse",
      entity: "VendorPaymentSlip",
      entityId: id,
      after: {
        paidPaise: input.paidPaise.toString(),
        clientRequestId: input.clientRequestId,
      },
    });

    return sendOk(res, await loadSlipDetail(slipId));
  },
);

/* ------------------------------------------------------------------ */
/* Cancellation                                                        */
/* ------------------------------------------------------------------ */

router.post("/slips/:id/cancel", can(PERMS.ACCOUNTS.PAYMENT.CANCEL), async (req, res) => {
  const id = getParamId(req);
  const input = validate(cancelVendorPaymentSlipSchema.safeParse(req.body));

  const forAccess = await db.vendorPaymentSlip.findUnique({
    where: { id },
    select: { branchId: true },
  });
  if (!forAccess) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, forAccess.branchId);

  const me = actorId(req);
  const lockKey = `vendor-payment-slip:${id}`;

  const wasApproved = await db.$transaction(
    async (tx) => {
      // Same lock key disburse takes — cancel and disburse against the same
      // slip can never interleave, so a cancel can't decide to reverse an
      // accrual using paidPaise/status that a concurrent disbursement just
      // changed. Re-read fresh after acquiring the lock, not the pre-tx read.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const slip = await tx.vendorPaymentSlip.findUnique({ where: { id } });
      if (!slip) throw new NotFoundError("Vendor payment slip not found");
      if (slip.version !== input.version)
        throw new BadRequestError("This slip changed in another session. Refresh and try again.");
      if (slip.status === "CANCELLED")
        throw new BadRequestError("Slip is already cancelled");
      if (slip.status === "PARTIALLY_PAID" || slip.status === "PAID")
        throw new BadRequestError(
          "A partially or fully paid slip cannot be cancelled here — use the separate refund/payment-reversal flow",
        );

      // Approved-and-unpaid reverses the accrual; DRAFT/PENDING_APPROVAL
      // never touched the ledger, so there's nothing to reverse.
      const wasApproved = slip.status === "APPROVED";
      if (wasApproved) await reverseVendorSlipAccrual(tx, slip, input.reason, me);

      // Re-guarded by version here too: nothing between the fresh read above
      // and this write takes a row lock (a plain SELECT doesn't), so a
      // concurrent transition that doesn't share this lock — e.g. approve,
      // which only version-guards its own PENDING_APPROVAL -> APPROVED write
      // — could still commit in between. This catches that cleanly instead
      // of silently overwriting it.
      try {
        await tx.vendorPaymentSlip.update({
          where: { id, version: input.version },
          data: {
            status: "CANCELLED",
            cancelledById: me,
            cancelledAt: new Date(),
            cancelReason: input.reason,
            version: { increment: 1 },
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
          throw new BadRequestError("This slip changed in another session. Refresh and try again.");
        throw err;
      }

      // Release every claimed source back to the eligible pool.
      await tx.vendorPaymentSlipLine.updateMany({
        where: { slipId: id, isActive: true },
        data: { isActive: false },
      });

      return wasApproved;
    },
    { timeout: 15000, maxWait: 10000 },
  );

  await recordAuditEntry({
    actor: { id: me },
    action: "vendor_payment.cancel",
    entity: "VendorPaymentSlip",
    entityId: id,
    after: { reason: input.reason, wasApproved },
  });

  return sendOk(res, await loadSlipDetail(id));
});

router.get("/slips", can(PERMS.ACCOUNTS.PAYMENT.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(vendorPaymentSlipListQuerySchema.safeParse(req.query));
  const where = buildSlipListWhere(filters, branchFilter(req));
  const [data, total] = await Promise.all([
    db.vendorPaymentSlip.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        transport: { select: { id: true, name: true } },
        labour: { select: { id: true, name: true } },
        _count: { select: { lines: true, disbursements: true } },
      },
      orderBy: SLIP_LIST_ORDER_BY,
      skip: query.page * query.size,
      take: query.size,
    }),
    db.vendorPaymentSlip.count({ where }),
  ]);
  return sendOk(res, data, { page: query.page, size: query.size, total });
});

// Headline numbers for the register. Computed over every slip in the caller's
// branch scope — not over whichever chunk of the list happens to be loaded.
// Declared before `/slips/:id` so "summary" is never read as a slip id.
router.get("/slips/summary", can(PERMS.ACCOUNTS.PAYMENT.VIEW), async (req, res) => {
  const scope = branchFilter(req);
  const [byStatus, payable] = await Promise.all([
    db.vendorPaymentSlip.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    db.vendorPaymentSlip.aggregate({
      where: { ...scope, status: { in: ["APPROVED", "PARTIALLY_PAID"] } },
      _sum: { netPayablePaise: true, paidPaise: true },
    }),
  ]);
  const countOf = (status: string) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return sendOk(res, {
    draftCount: countOf("DRAFT"),
    pendingApprovalCount: countOf("PENDING_APPROVAL"),
    outstandingPaise:
      (payable._sum.netPayablePaise ?? 0n) - (payable._sum.paidPaise ?? 0n),
  });
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
