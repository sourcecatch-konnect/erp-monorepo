import { Router } from "express";
import {
  approveVendorPaymentSlipSchema,
  cancelVendorPaymentSlipSchema,
  createVendorPaymentDisbursementSchema,
  createVendorPaymentSlipSchema,
  eligibleHamaliSourceQuerySchema,
  eligibleLDCSourceQuerySchema,
  eligibleTransporterClaimRecoveryQuerySchema,
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
import {
  fyCodeFor,
  formatDocNumber,
  nextSequence,
} from "../_shared/doc-number.js";
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
  findEligibleTransporterTrucks,
  reconcileTransporterTrucks,
} from "./calculators/transporter-truck.js";
import { describeSlipSources, withLineSources } from "./slip-sources.js";
import { loadSlipDetentionDiagnostics } from "./detention-diagnostics.js";
import { resolveApprovedDetention } from "../detention/detention.engine.js";
import {
  findEligibleHamaliSources,
  reconcileHamaliLines,
  type HamaliSourceType,
} from "./calculators/hamali.js";
import {
  findEligibleLDCSources,
  reconcileLDCLines,
} from "./calculators/ldc-broker.js";
import { SLIP_LIST_ORDER_BY, buildSlipListWhere } from "./slip-list.query.js";
import { assertFundingMatchesMode } from "../driver-finance/driver-finance.service.js";
import {
  findEligibleClaimRecoveries,
  reconcileClaimRecoveryLines,
} from "./calculators/claim-recovery.js";
import { receiveSlipRecoveries, releaseSlipRecoveries } from "../claim/claim.slip-deduction.js";

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

const loadSlipDetail = async (id: string) =>
  withLineSources(
    db,
    await db.vendorPaymentSlip.findUniqueOrThrow({
      where: { id },
      include: slipDetailInclude,
    }),
  );

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
 * A line as the server builds it: the validated input plus the detention
 * working, which only LDC_BROKER sets. These are derived here, never taken
 * from the request — a slip must record how its figure was reached, not what
 * the client claimed it was.
 */
type BuiltSlipLine = VendorPaymentSlipLineInput & {
  // LDC deduction heads (L4) — always supplied via ZERO_LINE_COMPONENTS.
  parkingPaise: bigint;
  labourPaise: bigint;
  otherPaise: bigint;
  shortagePaise: bigint;
  detentionDays?: number | null;
  detentionSlabId?: string | null;
  detentionSlabName?: string | null;
  claimedDetentionPaise?: bigint | null;
};
const ZERO_LINE_COMPONENTS = {
  freightPaise: 0n,
  detentionPaise: 0n,
  advancePaise: 0n,
  commissionPaise: 0n,
  hamaliPaise: 0n,
  tdsPaise: 0n,
  damagePaise: 0n,
  stationeryPaise: 0n,
  // LDC deduction heads (L4). Zero for every other slip type.
  parkingPaise: 0n,
  labourPaise: 0n,
  otherPaise: 0n,
  shortagePaise: 0n,
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
/** What a transporter slip can carry: trucks, legacy LRs, damage recoveries (C7). */
const TRANSPORTER_SOURCE_TYPES = new Set<VendorPaymentSlipLineInput["sourceType"]>([
  "LR_GROUP",
  "LR",
  "CLAIM_RECOVERY",
]);

async function buildServerLines(
  client: typeof db | Prisma.TransactionClient,
  type: VendorPaymentType,
  payee: { transportId: string | null; labourId: string | null },
  lines: VendorPaymentSlipLineInput[],
  tdsRateBps: number | undefined,
  excludeSlipId?: string,
): Promise<BuiltSlipLine[]> {
  if (type === "TRANSPORTER") {
    if (!payee.transportId)
      throw new BadRequestError("A transporter slip needs transportId");

    const truckIds = lines
      .filter((l) => l.sourceType === "LR_GROUP")
      .map((l) => l.sourceId);
    const lrIds = lines.filter((l) => l.sourceType === "LR").map((l) => l.sourceId);
    const recoveryIds = lines
      .filter((l) => l.sourceType === "CLAIM_RECOVERY")
      .map((l) => l.sourceId);
    if (lines.some((l) => !TRANSPORTER_SOURCE_TYPES.has(l.sourceType)))
      throw new BadRequestError("A transporter slip takes truck lines and damage recoveries only");

    const [trucks, legacyLrs, recoveries] = await Promise.all([
      reconcileTransporterTrucks(client, payee.transportId, truckIds, excludeSlipId),
      reconcileTransporterLines(client, payee.transportId, lrIds, excludeSlipId),
      reconcileClaimRecoveryLines(client, payee.transportId, recoveryIds, excludeSlipId),
    ]);
    // The same truck can't be on this slip both whole and LR-wise.
    const doubled = [...legacyLrs.values()].filter((lr) =>
      trucks.has(lr.groupId),
    );
    if (doubled.length)
      throw new BadRequestError(
        `These LRs' trucks are already on this slip: ${doubled.map((lr) => lr.lrNumber).join(", ")}`,
      );

    return lines.map((line) => {
      // Claims C7: a damage recovery deducts only what the truck line's ack
      // damage doesn't already take — re-derived here, never the client's.
      if (line.sourceType === "CLAIM_RECOVERY") {
        const recovery = recoveries.get(line.sourceId)!;
        return {
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          ...ZERO_LINE_COMPONENTS,
          damagePaise: recovery.damagePaise,
        };
      }
      const server =
        line.sourceType === "LR_GROUP"
          ? trucks.get(line.sourceId)
          : legacyLrs.get(line.sourceId);
      if (!server)
        throw new BadRequestError(
          `Source ${line.sourceId} is not a valid transporter line`,
        );
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
        // LDC-only heads (L4) — a transporter slip never carries them.
        parkingPaise: 0n,
        labourPaise: 0n,
        otherPaise: 0n,
        shortagePaise: 0n,
      };
    });
  }

  if (type === "HAMALI") {
    if (!payee.labourId)
      throw new BadRequestError("A hamali slip needs labourId");
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
        throw new BadRequestError(
          `Source ${line.sourceId} is not a valid hamali line`,
        );
      return {
        sourceType: line.sourceType,
        sourceId: line.sourceId,
        ...ZERO_LINE_COMPONENTS,
        hamaliPaise: grossPaise,
        tdsPaise: roundPaiseByBps(grossPaise, tdsRateBps),
      };
    });
  }

  if (type === "LDC_BROKER") {
    if (!payee.transportId)
      throw new BadRequestError("An LDC broker slip needs transportId");
    if (tdsRateBps === undefined)
      throw new BadRequestError("An LDC broker slip needs a TDS percentage");
    if (lines.some((l) => l.sourceType !== "DELIVERY_CHALLAN"))
      throw new BadRequestError(
        "An LDC broker slip takes delivery challans only",
      );

    const reconciled = await reconcileLDCLines(
      client,
      payee.transportId,
      lines.map((l) => l.sourceId),
      excludeSlipId,
    );

    return lines.map((line) => {
      const server = reconciled.get(line.sourceId);
      if (!server)
        throw new BadRequestError(
          `Challan ${line.sourceId} is not a valid LDC line`,
        );
      // The broker's claim arrives in its own `claimedDetentionPaise` field,
      // which is nullish — absent means no claim was filed and the slab
      // stands. `detentionPaise` is NOT read here: like every other `*Paise`
      // field on a line it is prefill only (see the schema's own note), and
      // reading it as the claim is what let an omitted field pay the broker
      // zero detention (audit D-14).
      const { approvedPaise, claimFiled } = resolveApprovedDetention(
        line.claimedDetentionPaise,
        server.detentionPaise,
      );
      // TDS is deducted on the gross payable, matching the legacy
      // `NetAmt = TotalFreightPayable - TDS` (ACCOUNTS_MODULE_MAP §2.F).
      // The approved heads the broker charges (parking, labour, other) are
      // part of that gross; the ones recovered from him (damage, shortage)
      // are not — they reduce the net, not the TDS base.
      const gross =
        server.freightPaise +
        approvedPaise +
        server.parkingPaise +
        server.labourPaise +
        server.otherPaise;
      return {
        sourceType: line.sourceType,
        sourceId: line.sourceId,
        ...ZERO_LINE_COMPONENTS,
        freightPaise: server.freightPaise,
        detentionPaise: approvedPaise,
        advancePaise: server.advancePaise,
        tdsPaise: roundPaiseByBps(gross, tdsRateBps),
        parkingPaise: server.parkingPaise,
        labourPaise: server.labourPaise,
        otherPaise: server.otherPaise,
        damagePaise: server.damagePaise,
        shortagePaise: server.shortagePaise,
        detentionDays: server.detentionDays,
        detentionSlabId: server.detentionSlabId,
        detentionSlabName: server.detentionSlabName,
        // Only worth recording when a claim was filed AND it differed from
        // the slab — an unclaimed line has nothing to explain. A filed claim
        // of zero against a non-zero slab differs, so it is stored as 0n and
        // stays distinguishable from "no claim".
        claimedDetentionPaise:
          claimFiled && line.claimedDetentionPaise !== server.detentionPaise
            ? (line.claimedDetentionPaise ?? null)
            : null,
      };
    });
  }

  throw new BadRequestError("This vendor payment type is not available yet");
}

type RecalculatedLine = BuiltSlipLine & { netPaise: bigint };

function recalcSlipTotals(type: VendorPaymentType, lines: BuiltSlipLine[]) {
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
    } else if (type === "LDC_BROKER") {
      // Challan freight, computed detention and the heads the approver
      // allowed the broker to charge; less the advance already handed over,
      // TDS, and what is recovered from him (damage, shortage).
      gross =
        line.freightPaise +
        line.detentionPaise +
        line.parkingPaise +
        line.labourPaise +
        line.otherPaise;
      deductions =
        line.advancePaise +
        line.tdsPaise +
        line.damagePaise +
        line.shortagePaise;
    } else {
      throw new BadRequestError(
        "This vendor payment type is not available yet",
      );
    }
    const net = gross - deductions;
    // A damage-recovery line (C7) is all deduction; only the slip total must stay >= 0.
    if (net < 0n && line.sourceType !== "CLAIM_RECOVERY")
      throw new BadRequestError(
        `Source ${line.sourceId}: deductions exceed the gross amount`,
      );
    grossPayablePaise += gross;
    totalDeductionsPaise += deductions;
    netPayablePaise += net;
    return { ...line, netPaise: net };
  });

  if (netPayablePaise < 0n)
    throw new BadRequestError(
      "The damage recoveries are more than this slip pays — leave one off and deduct it from a later slip",
    );
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
    parkingPaise: line.parkingPaise,
    labourPaise: line.labourPaise,
    otherPaise: line.otherPaise,
    shortagePaise: line.shortagePaise,
    netPaise: line.netPaise,
    detentionDays: line.detentionDays ?? null,
    detentionSlabId: line.detentionSlabId ?? null,
    detentionSlabName: line.detentionSlabName ?? null,
    claimedDetentionPaise: line.claimedDetentionPaise ?? null,
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
    const input = validate(
      eligibleTransporterLRQuerySchema.safeParse(req.query),
    );
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

// Transporter slips are made per truck: one row per LR group with all its LRs
// (see calculators/transporter-truck.ts). Same query as the per-LR list.
router.get(
  "/calculators/transporter-trucks",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const input = validate(
      eligibleTransporterLRQuerySchema.safeParse(req.query),
    );
    if (input.branchId) assertBranchAccess(req, input.branchId);
    const branchWhere: Prisma.LRGroupWhereInput = input.branchId
      ? { originBranchId: input.branchId }
      : branchFilter(req, "originBranchId");

    const page = await findEligibleTransporterTrucks(db, {
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

// Claims C7: approved damage recoveries to deduct on this transporter's slip.
router.get(
  "/calculators/transporter-claim-recoveries",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const input = validate(eligibleTransporterClaimRecoveryQuerySchema.safeParse(req.query));
    const rows = await findEligibleClaimRecoveries(db, input.transportId, branchFilter(req));
    return sendOk(res, rows);
  },
);

router.get(
  "/calculators/hamali",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const input = validate(
      eligibleHamaliSourceQuerySchema.safeParse(req.query),
    );
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

/**
 * Issued delivery challans this broker can be paid for, with detention already
 * computed from the slab so the operator sees the real payable before
 * selecting anything.
 */
router.get(
  "/calculators/ldc-broker",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const input = validate(eligibleLDCSourceQuerySchema.safeParse(req.query));
    if (input.branchId) assertBranchAccess(req, input.branchId);

    const branchIds = input.branchId
      ? [input.branchId]
      : !req.ctx || req.ctx.branchScope === "ALL"
        ? undefined
        : req.ctx.branchIds;

    const page = await findEligibleLDCSources({
      transportId: input.transportId,
      branchIds,
      from: input.from,
      to: input.to,
      search: input.search,
      page: input.page,
      size: input.size,
      mode: input.mode,
    });
    return sendOk(res, page.rows, {
      page: input.page,
      size: input.size,
      total: page.total,
    });
  },
);

/* ------------------------------------------------------------------ */
/* Slip CRUD (DRAFT) + submit                                          */
/* ------------------------------------------------------------------ */

router.post("/slips", can(PERMS.ACCOUNTS.PAYMENT.CREATE), async (req, res) => {
  const input = validate(createVendorPaymentSlipSchema.safeParse(req.body));
  assertBranchAccess(req, input.branchId);
  if (
    input.type === "TRANSPORTER" &&
    input.lines.some((l) => l.sourceType !== "LR_GROUP" && l.sourceType !== "CLAIM_RECOVERY")
  )
    throw new BadRequestError(
      "Transporter slips are made per truck — select trucks, not single LRs",
    );

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new NotFoundError("Branch not found");

  const serverLines = await buildServerLines(
    db,
    input.type,
    {
      transportId: input.transportId ?? null,
      labourId: input.labourId ?? null,
    },
    input.lines,
    input.tdsRateBps,
  );
  const totals = recalcSlipTotals(input.type, serverLines);
  const me = actorId(req);
  const fyCode = fyCodeFor(new Date());
  const sortedSourceIds = [
    ...new Set(input.lines.map((l) => l.sourceId)),
  ].sort();

  // Reserving a number is a single atomic upsert — safe outside the
  // transaction (a rolled-back create just leaves a gap) and one less
  // round trip held under the advisory lock below.
  const seq = await nextSequence(db, branch.branchCode, fyCode, "VPAY");
  // VP-2 spec's literal example is 4 digits (.../<0001>), unlike every
  // other document number in this app (5 digits) — this is the one
  // deliberate exception, not a copy-paste of the app-wide default.
  const slipNumber = formatDocNumber(
    branch.branchCode,
    fyCode,
    seq,
    "SKT/VPAY",
    4,
  );

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

router.patch(
  "/slips/:id",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(updateVendorPaymentSlipSchema.safeParse(req.body));

    const existing = await db.vendorPaymentSlip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Vendor payment slip not found");
    assertBranchAccess(req, existing.branchId);
    if (existing.status !== "DRAFT")
      throw new BadRequestError("Only a draft slip can be edited");
    if (existing.version !== input.version)
      throw new BadRequestError(
        "This draft changed in another session. Refresh and try again.",
      );

    const serverLines = await buildServerLines(
      db,
      existing.type,
      { transportId: existing.transportId, labourId: existing.labourId },
      input.lines,
      input.tdsRateBps,
      id,
    );
    const totals = recalcSlipTotals(existing.type, serverLines);
    const sortedSourceIds = [
      ...new Set(input.lines.map((l) => l.sourceId)),
    ].sort();

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
            throw new BadRequestError(
              "This draft changed in another session. Refresh and try again.",
            );
          throw err;
        }
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return sendOk(res, await loadSlipDetail(id));
  },
);

type ActiveLine = {
  freightPaise: bigint;
  detentionPaise: bigint;
  advancePaise: bigint;
  commissionPaise: bigint;
  hamaliPaise: bigint;
  tdsPaise: bigint;
  damagePaise: bigint;
  stationeryPaise: bigint;
  parkingPaise: bigint;
  labourPaise: bigint;
  otherPaise: bigint;
  shortagePaise: bigint;
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    )
      throw new BadRequestError(
        "This changed in another session. Refresh and try again.",
      );
    throw err;
  }

  const journal = await postVendorSlipAccrual(tx, {
    narrationDetail: await describeSlipSources(tx, approved.id),
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

  // Claims C7: the accrual just credited DAMAGE_RECOVERY for its recovery lines.
  await receiveSlipRecoveries(tx, approved, actorUserId);

  return tx.vendorPaymentSlip.update({
    where: { id },
    data: { accrualJournalEntryId: journal.id },
  });
}

router.post(
  "/slips/:id/submit",
  can(PERMS.ACCOUNTS.PAYMENT.CREATE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(
      submitVendorPaymentSlipSchema.safeParse(req.body ?? {}),
    );

    const existing = await db.vendorPaymentSlip.findUnique({
      where: { id },
      include: { lines: { where: { isActive: true } } },
    });
    if (!existing) throw new NotFoundError("Vendor payment slip not found");
    assertBranchAccess(req, existing.branchId);
    if (existing.status !== "DRAFT")
      throw new BadRequestError("Only a draft slip can be submitted");
    if (existing.version !== input.version)
      throw new BadRequestError(
        "This draft changed in another session. Refresh and try again.",
      );
    if (existing.lines.length === 0)
      throw new BadRequestError(
        "Add at least one source line before submitting",
      );
    if (existing.netPayablePaise <= 0n)
      throw new BadRequestError(
        "Net payable must be greater than zero to submit",
      );

    const decision = decideVendorPaymentApproval(
      existing.type,
      existing.netPayablePaise,
    );
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
              throw new BadRequestError(
                "This draft changed in another session. Refresh and try again.",
              );
            throw err;
          }
          return id;
        }

        const approved = await approveAndAccrue(
          tx,
          id,
          input.version,
          existing.lines,
          me,
        );
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
  },
);

router.post(
  "/slips/:id/approve",
  can(PERMS.ACCOUNTS.PAYMENT.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(
      approveVendorPaymentSlipSchema.safeParse(req.body ?? {}),
    );

    const existing = await db.vendorPaymentSlip.findUnique({
      where: { id },
      include: { lines: { where: { isActive: true } } },
    });
    if (!existing) throw new NotFoundError("Vendor payment slip not found");
    assertBranchAccess(req, existing.branchId);
    if (existing.status !== "PENDING_APPROVAL")
      throw new BadRequestError("Only a slip pending approval can be approved");
    if (existing.version !== input.version)
      throw new BadRequestError(
        "This slip changed in another session. Refresh and try again.",
      );

    const me = actorId(req);
    if (vendorPaymentMakerCheckerEnabled() && existing.createdById === me)
      throw new ForbiddenError(
        "Maker-checker is enabled — you cannot approve a slip you submitted yourself",
      );

    const slipId = await db.$transaction(
      (tx) =>
        approveAndAccrue(tx, id, input.version, existing.lines, me).then(
          (s) => s.id,
        ),
      { timeout: 15000, maxWait: 10000 },
    );

    await recordAuditEntry({
      actor: { id: me },
      action: "vendor_payment.approve",
      entity: "VendorPaymentSlip",
      entityId: id,
    });

    return sendOk(res, await loadSlipDetail(slipId));
  },
);

router.post(
  "/slips/:id/reject",
  can(PERMS.ACCOUNTS.PAYMENT.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(rejectVendorPaymentSlipSchema.safeParse(req.body));

    const existing = await db.vendorPaymentSlip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Vendor payment slip not found");
    assertBranchAccess(req, existing.branchId);
    if (existing.status !== "PENDING_APPROVAL")
      throw new BadRequestError("Only a slip pending approval can be rejected");
    if (existing.version !== input.version)
      throw new BadRequestError(
        "This slip changed in another session. Refresh and try again.",
      );

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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      )
        throw new BadRequestError(
          "This slip changed in another session. Refresh and try again.",
        );
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
  },
);

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
    const input = validate(
      createVendorPaymentDisbursementSchema.safeParse(req.body),
    );

    const forAccess = await db.vendorPaymentSlip.findUnique({
      where: { id },
      select: { branchId: true },
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

    // Cash must come from a cash account; bank/UPI/cheque from a bank one.
    await assertFundingMatchesMode(db, input.fundingLedgerId, input.mode);

    // The payment voucher belongs to the financial year it is paid in, not
    // the slip's — a March slip paid in April is an April voucher.
    const paymentFyCode = fyCodeFor(input.paidAt);

    // branchId is set once at slip creation and never updated by any route,
    // so it's safe to resolve the branch and reserve a voucher number now,
    // against `db`, rather than inside the lock below — one less round trip
    // held while the advisory lock is open, same as the create route.
    const branch = await db.branch.findUnique({
      where: { id: forAccess.branchId },
      select: { branchCode: true },
    });
    if (!branch) throw new NotFoundError("Branch not found");
    const seq = await nextSequence(
      db,
      branch.branchCode,
      paymentFyCode,
      "VPAY-PMT",
    );
    const voucherNumber = formatDocNumber(
      branch.branchCode,
      paymentFyCode,
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
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            const already = await tx.vendorPaymentDisbursement.findUnique({
              where: { clientRequestId: input.clientRequestId },
            });
            if (already) return already.slipId;
          }
          throw err;
        }

        const journal = await postVendorDisbursement(tx, {
          narrationDetail: await describeSlipSources(tx, slip.id),
          disbursementId: disbursement.id,
          voucherNumber,
          slipId: slip.id,
          slipNumber: slip.slipNumber,
          paidAt: input.paidAt,
          branchId: slip.branchId,
          fyCode: paymentFyCode,
          transportId: slip.transportId,
          labourId: slip.labourId,
          fundingLedgerId: input.fundingLedgerId,
          paidPaise: input.paidPaise,
          existingSettlementJournalEntryId:
            disbursement.settlementJournalEntryId,
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
            status:
              newPaidPaise >= slip.netPayablePaise ? "PAID" : "PARTIALLY_PAID",
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

router.post(
  "/slips/:id/cancel",
  can(PERMS.ACCOUNTS.PAYMENT.CANCEL),
  async (req, res) => {
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
          throw new BadRequestError(
            "This slip changed in another session. Refresh and try again.",
          );
        if (slip.status === "CANCELLED")
          throw new BadRequestError("Slip is already cancelled");
        if (slip.status === "PARTIALLY_PAID" || slip.status === "PAID")
          throw new BadRequestError(
            "A partially or fully paid slip cannot be cancelled here — use the separate refund/payment-reversal flow",
          );

      // Approved-and-unpaid reverses the accrual; DRAFT/PENDING_APPROVAL
      // never touched the ledger, so there's nothing to reverse.
      const wasApproved = slip.status === "APPROVED";
      if (wasApproved) {
        await reverseVendorSlipAccrual(tx, slip, input.reason, me);
        // Claims C7: its damage recoveries go back to APPROVED for the next slip.
        await releaseSlipRecoveries(tx, slip, me);
      }

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
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025"
          )
            throw new BadRequestError(
              "This slip changed in another session. Refresh and try again.",
            );
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
  },
);

router.get("/slips", can(PERMS.ACCOUNTS.PAYMENT.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(
    vendorPaymentSlipListQuerySchema.safeParse(req.query),
  );
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
router.get(
  "/slips/summary",
  can(PERMS.ACCOUNTS.PAYMENT.VIEW),
  async (req, res) => {
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
  },
);

router.get("/slips/:id", can(PERMS.ACCOUNTS.PAYMENT.VIEW), async (req, res) => {
  const id = getParamId(req);
  const slip = await db.vendorPaymentSlip.findUnique({
    where: { id },
    include: slipDetailInclude,
  });
  if (!slip) throw new NotFoundError("Vendor payment slip not found");
  assertBranchAccess(req, slip.branchId);
  return sendOk(res, await withLineSources(db, slip));
});

/**
 * The detention working behind an LDC slip's lines, for the approver (L0-3).
 *
 * Deliberately its own endpoint rather than extra fields on `GET /slips/:id`:
 * a slip may carry up to 200 lines and each diagnostic is a challan read, so
 * this is paid for on a deliberate request instead of on every slip load —
 * and the detail response stays byte-identical, so nothing downstream of it
 * can break.
 *
 * Returns `[]` for a slip with no challan lines. Gated and branch-checked
 * exactly like the detail route it accompanies.
 */
router.get(
  "/slips/:id/detention",
  can(PERMS.ACCOUNTS.PAYMENT.VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const slip = await db.vendorPaymentSlip.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!slip) throw new NotFoundError("Vendor payment slip not found");
    assertBranchAccess(req, slip.branchId);
    return sendOk(res, await loadSlipDetentionDiagnostics(db, slip.id));
  },
);

export default router;
