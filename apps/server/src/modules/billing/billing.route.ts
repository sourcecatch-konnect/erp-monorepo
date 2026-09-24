import { Router } from "express";
import {
  addBillChargesSchema,
  approveLRChargeSchema,
  billingTaxRuleSchema,
  cancelBillSchema,
  cancelLRChargeSchema,
  createBillCreditNoteSchema,
  createBillDraftSchema,
  createManualLRChargeSchema,
  eligibleClientQuerySchema,
  eligibleLRQuerySchema,
  evaluateLRBillingSchema,
  returnBillToDraftSchema,
  transitionBillSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import { Prisma, type BillStatus } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import {
  fyCodeFor,
  formatDocNumber,
  nextSequence,
} from "../_shared/doc-number.js";
import {
  billDetailInclude,
  calculateBill,
  evaluateBillingForLR,
  refreshLRBillingStatus,
} from "./billing.service.js";
import {
  postBillCreditNoteVoucher,
  postSalesVoucher,
  reverseJournal,
} from "../ledger/posting.service.js";
import { RECEIVABLE_BILL_STATUSES } from "../ledger/customer-statement.compute.js";
import { buildBillPdfHtml, billPdfInclude } from "./billing.pdf.js";
import { generatePdfFromHtml } from "../../templetes/pdf/pdf.genertaor..js";

const router: Router = Router();
router.use(authMiddleware);
const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const LR_RESERVING_BILL_STATUSES: BillStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
];

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

const servicePartyWhere = (
  partyType: "CONSIGNOR" | "CONSIGNEE",
  customerId: string,
): Prisma.LRGroupWhereInput =>
  partyType === "CONSIGNOR"
    ? { consignorId: customerId }
    : { consigneeId: customerId };

type BillLane = "ROAD" | "ROAD_RAIL" | "ROAD_GTA";

// ROAD is the "to pay" / no-GST lane and accepts any transport mode, so it
// applies no transportType filter (Prisma ignores `undefined`). ROAD_GTA is
// road-only; ROAD_RAIL is rail / road+rail.
const transportWhere = (
  billType: BillLane,
): Prisma.LRGroupWhereInput["transportType"] =>
  billType === "ROAD_RAIL"
    ? { in: ["RoadAndRail", "Rail"] }
    : billType === "ROAD_GTA"
      ? "Road"
      : undefined;

// The bill lane fixes the LR's freight basis: ROAD <-> TO_PAY (no GST),
// ROAD_GTA / ROAD_RAIL <-> TO_BE_BILLED (GST).
const paymentModeForBillType = (
  billType: BillLane,
): Prisma.LRGroupWhereInput["paymentMode"] =>
  billType === "ROAD" ? "TO_PAY" : "TO_BE_BILLED";

router.get("/options", can(PERMS.BILLING.VIEW), async (req, res) => {
  const [branches, states] = await Promise.all([
    db.branch.findMany({
      where: branchFilter(req, "id"),
      select: {
        id: true,
        name: true,
        branchCode: true,
        gstNo: true,
        companyId: true,
        address: true,
        city: { select: { id: true, name: true, state: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.state.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return sendOk(res, { branches, states });
});

// Page size for the eligible-clients scan below. Kept modest — each row
// carries nested billableCharges/billLines — while still resolving in a
// handful of round trips for realistic volumes.
const ELIGIBLE_CLIENTS_PAGE_SIZE = 1000;
// Circuit breaker only — protects against pathological data growth. At this
// page size that's 200k LRs scanned before giving up on this request.
const ELIGIBLE_CLIENTS_MAX_PAGES = 200;

router.get("/eligible-clients", can(PERMS.BILLING.VIEW), async (req, res) => {
  const input = validate(eligibleClientQuerySchema.safeParse(req.query));
  if (input.branchId) assertBranchAccess(req, input.branchId);

  const where: Prisma.LorryReceiptWhereInput = {
    status: "ACKNOWLEDGED",
    billingStatus: {
      in: ["NOT_BILLABLE", "READY_TO_BILL", "PARTIALLY_BILLED"],
    },
    ...(input.cutoffDate ? { createdAt: { lte: input.cutoffDate } } : {}),
    group: {
      is: {
        ...(input.branchId
          ? { originBranchId: input.branchId }
          : branchFilter(req, "originBranchId")),
        transportType: transportWhere(input.billType),
        paymentMode: paymentModeForBillType(input.billType),
      },
    },
  };

  const unique = new Map<
    string,
    {
      id: string;
      name: string;
      stateId: string;
      splitBillsByChargeType: boolean;
    }
  >();

  // "Eligible" isn't a stored column — it's derived per LR from its charges,
  // so it can't be pushed down to a single DISTINCT query without duplicating
  // that math in raw SQL. Instead, page through *every* matching LR (a plain
  // `take: 1000` with no `orderBy` silently dropped any customer whose only
  // qualifying LRs fell outside that arbitrary window) — eligibility logic
  // per LR is unchanged, only the fetch is now exhaustive and deterministic.
  let cursor: string | undefined;
  for (let page = 0; page < ELIGIBLE_CLIENTS_MAX_PAGES; page++) {
    const lrs = await db.lorryReceipt.findMany({
      where,
      select: {
        id: true,
        billingStatus: true,
        acknowledgement: {
          select: { detentionAmount: true, damageAmount: true },
        },
        delivery: { select: { unloadingCharges: true } },
        billableCharges: {
          where: { status: { in: ["APPROVED", "PARTIALLY_BILLED"] } },
          select: {
            amountPaise: true,
            approvedAmountPaise: true,
            billLines: {
              where: { bill: { status: { not: "CANCELLED" } } },
              select: { amountPaise: true },
            },
          },
        },
        billLines: {
          where: {
            bill: { status: { in: LR_RESERVING_BILL_STATUSES } },
          },
          select: { id: true },
          take: 1,
        },
        group: {
          select: {
            baseFreightAmount: true,
            consignor: {
              select: {
                id: true,
                name: true,
                stateId: true,
                splitBillsByChargeType: true,
              },
            },
            consignee: {
              select: {
                id: true,
                name: true,
                stateId: true,
                splitBillsByChargeType: true,
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: ELIGIBLE_CLIENTS_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    for (const lr of lrs) {
      const hasRemainingCharge = lr.billableCharges.some((charge) => {
        const target = charge.approvedAmountPaise ?? charge.amountPaise;
        const allocated = charge.billLines.reduce(
          (sum, line) => sum + line.amountPaise,
          0n,
        );
        return allocated < target;
      });
      const hasSourceCharge =
        (lr.group.baseFreightAmount ?? 0n) > 0n ||
        (lr.acknowledgement?.detentionAmount ?? 0n) > 0n ||
        (lr.acknowledgement?.damageAmount ?? 0n) > 0n ||
        (lr.delivery?.unloadingCharges ?? 0n) > 0n;
      if (
        !hasRemainingCharge &&
        !(lr.billingStatus === "NOT_BILLABLE" && hasSourceCharge)
      )
        continue;
      const customer =
        input.billingPartyType === "CONSIGNOR"
          ? lr.group.consignor
          : lr.group.consignee;
      if (!customer.splitBillsByChargeType && lr.billLines.length > 0)
        continue;
      if (
        !input.search ||
        customer.name.toLowerCase().includes(input.search.toLowerCase())
      )
        unique.set(customer.id, customer);
    }

    if (lrs.length < ELIGIBLE_CLIENTS_PAGE_SIZE) break;
    cursor = lrs[lrs.length - 1]!.id;
    if (page === ELIGIBLE_CLIENTS_MAX_PAGES - 1)
      console.warn(
        `/billing/eligible-clients: hit the ${ELIGIBLE_CLIENTS_MAX_PAGES}-page scan limit; results may be incomplete`,
      );
  }

  return sendOk(
    res,
    [...unique.values()].sort((a, b) => a.name.localeCompare(b.name)),
  );
});

router.post(
  "/readiness/evaluate",
  can(PERMS.BILLING.CREATE),
  async (req, res) => {
    const input = validate(evaluateLRBillingSchema.safeParse(req.body));
    const lrs = await db.lorryReceipt.findMany({
      where: { id: { in: input.lrIds }, status: "ACKNOWLEDGED" },
      select: { id: true, group: { select: { originBranchId: true } } },
    });
    for (const lr of lrs) assertBranchAccess(req, lr.group.originBranchId);

    const CONCURRENCY = 5;
    const results = [];
    const userId = actorId(req);

    for (
      let index = 0;
      index < lrs.length;
      index += CONCURRENCY
    ) {
      const batchResults = await Promise.all(
        lrs
          .slice(index, index + CONCURRENCY)
          .map((lr) =>
            evaluateBillingForLR(db, lr.id, userId),
          ),
      );

      results.push(...batchResults);
    }
    return sendOk(res, results);
  },
);

router.post(
  "/readiness/evaluate-eligible",
  can(PERMS.BILLING.CREATE),
  async (req, res) => {
    const input = validate(
      eligibleLRQuerySchema.safeParse(req.body),
    );

    if (input.branchId) assertBranchAccess(req, input.branchId);

    const groupWhere: Prisma.LRGroupWhereInput = {
      ...(input.branchId
        ? { originBranchId: input.branchId }
        : branchFilter(req, "originBranchId")),
      transportType: transportWhere(input.billType),
      paymentMode: paymentModeForBillType(input.billType),
      ...servicePartyWhere(
        input.billingPartyType,
        input.customerId,
      ),
    };

    const lrs = await db.lorryReceipt.findMany({
      where: {
        status: "ACKNOWLEDGED",

        billingStatus: {
          in: [
            "NOT_BILLABLE",
            "READY_TO_BILL",
            "PARTIALLY_BILLED",
          ],
        },

        ...(input.cutoffDate
          ? {
            createdAt: {
              lte: input.cutoffDate,
            },
          }
          : {}),

        group: {
          is: groupWhere,
        },
      },

      select: {
        id: true,
      },

      take: 250,
    });

    const CONCURRENCY = 5;
    const results = [];
    const userId = actorId(req);

    for (
      let index = 0;
      index < lrs.length;
      index += CONCURRENCY
    ) {
      const batch = lrs.slice(
        index,
        index + CONCURRENCY,
      );

      const batchResults = await Promise.all(
        batch.map((lr) =>
          evaluateBillingForLR(db, lr.id, userId),
        ),
      );

      results.push(...batchResults);
    }

    return sendOk(res, results);
  },
);

router.get("/eligible-lrs", can(PERMS.BILLING.VIEW), async (req, res) => {
  const input = validate(eligibleLRQuerySchema.safeParse(req.query));
  if (input.branchId) assertBranchAccess(req, input.branchId);
  const customer = await db.customer.findUnique({
    where: { id: input.customerId },
    select: { splitBillsByChargeType: true },
  });
  if (!customer) throw new NotFoundError("Billing client not found");
  const groupWhere: Prisma.LRGroupWhereInput = {
    ...(input.branchId
      ? { originBranchId: input.branchId }
      : branchFilter(req, "originBranchId")),
    transportType: transportWhere(input.billType),
    paymentMode: paymentModeForBillType(input.billType),
    ...servicePartyWhere(input.billingPartyType, input.customerId),
  };
  const lrs = await db.lorryReceipt.findMany({
    where: {
      status: "ACKNOWLEDGED",
      billingStatus: {
        in: ["NOT_BILLABLE", "READY_TO_BILL", "PARTIALLY_BILLED"],
      },
      ...(input.search
        ? { lrNumber: { contains: input.search, mode: "insensitive" } }
        : {}),
      ...(input.cutoffDate ? { createdAt: { lte: input.cutoffDate } } : {}),
      group: { is: groupWhere },
      ...(!customer.splitBillsByChargeType
        ? {
          billLines: {
            none: {
              bill: { status: { in: LR_RESERVING_BILL_STATUSES } },
            },
          },
        }
        : {}),
    },
    include: {
      group: {
        include: {
          originBranch: { include: { city: { include: { state: true } } } },
          destinationBranch: {
            include: { city: { include: { state: true } } },
          },
          consignor: { select: { id: true, name: true, gstNo: true } },
          consignee: { select: { id: true, name: true, gstNo: true } },
        },
      },
      acknowledgement: { select: { receivedAt: true } },
      billableCharges: {
        where: { status: { in: ["APPROVED", "PARTIALLY_BILLED"] } },
        include: {
          billLines: {
            where: { bill: { status: { not: "CANCELLED" } } },
            select: { amountPaise: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const seenSharedFreightGroups = new Set<string>();
  const mappedLRs = lrs.map((lr) => ({
    id: lr.id,
    groupId: lr.groupId,
    groupNumber: lr.group.groupNumber,
    lrNumber: lr.lrNumber,
    lrDate: lr.createdAt,
    billingStatus: lr.billingStatus,
    transportType: lr.group.transportType,
    origin: lr.group.originBranch.name,
    originBranchId: lr.group.originBranch.id,
    destination: lr.group.destinationBranch.name,
    placeOfSupply: lr.group.destinationBranch.city?.state ?? null,
    consignor: lr.group.consignor,
    consignee: lr.group.consignee,
    podReceivedAt: lr.acknowledgement?.receivedAt ?? null,
    charges: lr.billableCharges
      .filter((charge) => {
        if (charge.type !== "FREIGHT") return true;
        if (seenSharedFreightGroups.has(lr.groupId)) return false;
        seenSharedFreightGroups.add(lr.groupId);
        return true;
      })
      .map((charge) => {
        const approved = charge.approvedAmountPaise ?? charge.amountPaise;
        const allocated = charge.billLines.reduce(
          (sum, line) => sum + line.amountPaise,
          0n,
        );
        return {
          id: charge.id,
          type: charge.type,
          effect: charge.effect,
          description: charge.description,
          isTaxable: charge.isTaxable,
          approvedAmountPaise: approved,
          allocatedAmountPaise: allocated,
          remainingAmountPaise: approved - allocated,
        };
      })
      .filter((charge) => charge.remainingAmountPaise > 0n),
  }));
  const eligibleGroupIds = new Set(
    mappedLRs.filter((lr) => lr.charges.length > 0).map((lr) => lr.groupId),
  );
  const freightOwnerByGroup = new Map<string, string>();
  for (const lr of mappedLRs) {
    if (lr.charges.some((charge) => charge.type === "FREIGHT"))
      freightOwnerByGroup.set(lr.groupId, lr.lrNumber);
  }
  const data = mappedLRs
    .filter((lr) => eligibleGroupIds.has(lr.groupId))
    .map((lr) => ({
      ...lr,
      isCompanionOnly: lr.charges.length === 0,
      sharedFreightOwnerLRNumber: freightOwnerByGroup.get(lr.groupId) ?? null,
    }));
  return sendOk(res, data);
});

router.post("/lrs/:id/charges", can(PERMS.BILLING.CREATE), async (req, res) => {
  const lrId = getParamId(req);
  const input = validate(createManualLRChargeSchema.safeParse(req.body));

  const lr = await db.lorryReceipt.findUnique({
    where: { id: lrId },
    select: { status: true, group: { select: { originBranchId: true } } },
  });
  if (!lr) throw new NotFoundError("Lorry receipt not found");
  assertBranchAccess(req, lr.group.originBranchId);
  if (lr.status !== "ACKNOWLEDGED")
    throw new BadRequestError("Only acknowledged LRs can receive bill charges");
  const charge = await db.lRCharge.create({
    data: {
      lrId,
      ...input,
      source: "MANUAL",
      status: "PENDING_APPROVAL",
      createdById: actorId(req),
    },
  });
  return sendOk(res, charge, undefined, 201);
});

router.post(
  "/charges/:id/approve",
  can(PERMS.BILLING.CHARGE_APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(approveLRChargeSchema.safeParse(req.body ?? {}));

    const existing = await db.lRCharge.findUnique({
      where: { id },
      include: {
        lr: { include: { group: { select: { originBranchId: true } } } },
      },
    });
    if (!existing) throw new NotFoundError("LR charge not found");
    assertBranchAccess(req, existing.lr.group.originBranchId);
    if (existing.status !== "PENDING_APPROVAL" && existing.status !== "DRAFT")
      throw new BadRequestError("Charge is not pending approval");

    const approvedAmountPaise =
      input.approvedAmountPaise ?? existing.amountPaise;

    const charge = await db.$transaction(async (tx) => {
      // Conditional update: guards against a concurrent request having
      // already moved this charge out of PENDING_APPROVAL/DRAFT, and avoids
      // relying on the earlier read remaining true under concurrency.
      const result = await tx.lRCharge.updateMany({
        where: {
          id,
          status: { in: ["PENDING_APPROVAL", "DRAFT"] },
        },
        data: {
          status: "APPROVED",
          approvedAmountPaise,
          approvedById: actorId(req),
          approvedAt: new Date(),
          reason: input.reason ?? existing.reason,
        },
      });
      if (result.count === 0) {
        throw new BadRequestError("Charge is not pending approval");
      }

      // Only touch the LR row if it isn't already in the target state.
      // This is the write most likely to collide with a sibling charge's
      // approval on the same LR — skipping it when it's a no-op removes
      // most of the lock contention.
      await tx.lorryReceipt.updateMany({
        where: {
          id: existing.lrId,
          billingStatus: { not: "READY_TO_BILL" },
        },
        data: { billingStatus: "READY_TO_BILL" },
      });

      return tx.lRCharge.findUniqueOrThrow({ where: { id } });
    });

    return sendOk(res, charge);
  },
);

router.post(
  "/charges/:id/cancel",
  can(PERMS.BILLING.CHARGE_APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(cancelLRChargeSchema.safeParse(req.body));
    const existing = await db.lRCharge.findUnique({
      where: { id },
      include: {
        lr: { include: { group: { select: { originBranchId: true } } } },
        billLines: {
          where: { bill: { status: { not: "CANCELLED" } } },
          select: { id: true },
        },
      },
    });
    if (!existing) throw new NotFoundError("LR charge not found");
    assertBranchAccess(req, existing.lr.group.originBranchId);
    if (existing.status === "CANCELLED") return sendOk(res, existing);
    if (existing.source !== "MANUAL")
      throw new BadRequestError(
        "System-generated charges must be corrected at their POD, delivery or freight source",
      );
    if (existing.billLines.length > 0)
      throw new BadRequestError(
        "This charge is already attached to a bill and cannot be cancelled",
      );
    if (["PARTIALLY_BILLED", "BILLED"].includes(existing.status))
      throw new BadRequestError("A billed charge cannot be cancelled");

    const me = actorId(req);
    const charge = await db.$transaction(async (tx) => {
      const cancelled = await tx.lRCharge.update({
        where: { id },
        data: {
          status: "CANCELLED",
          reason: `Cancellation: ${input.reason}`,
          updatedById: me,
          version: { increment: 1 },
        },
      });
      await refreshLRBillingStatus(tx, existing.lrId);
      return cancelled;
    });
    return sendOk(res, charge);
  },
);

const loadDraftContext = async (branchId: string, customerId: string) => {
  const [branch, customer] = await Promise.all([
    db.branch.findUnique({
      where: { id: branchId },
      include: { city: { include: { state: true } }, company: true },
    }),
    db.customer.findUnique({ where: { id: customerId } }),
  ]);
  if (!branch?.city?.state)
    throw new BadRequestError("Supplier branch city/state is incomplete");
  if (!customer) throw new NotFoundError("Billing client not found");
  return { branch, customer };
};

router.post("/bills", can(PERMS.BILLING.CREATE), async (req, res) => {
  const input = validate(createBillDraftSchema.safeParse(req.body));
  assertBranchAccess(req, input.branchId);
  const context = await loadDraftContext(input.branchId, input.customerId);
  // GST is always forward-charged on non-ROAD bills; ROAD carries no GST.
  const chargeMechanism =
    input.billType === "ROAD"
      ? ("NOT_APPLICABLE" as const)
      : ("FORWARD_CHARGE" as const);
  const charges = await db.lRCharge.findMany({
    where: { id: { in: input.lrChargeIds } },
    include: {
      lr: { include: { group: true } },
      billLines: {
        where: { bill: { status: { not: "CANCELLED" } } },
        select: { amountPaise: true },
      },
    },
  });
  if (charges.length !== new Set(input.lrChargeIds).size)
    throw new BadRequestError("One or more LR charges were not found");
  for (const charge of charges) {
    if (charge.lr.status !== "ACKNOWLEDGED")
      throw new BadRequestError("Only acknowledged LRs can be billed");
    if (!["APPROVED", "PARTIALLY_BILLED"].includes(charge.status))
      throw new BadRequestError("Only approved charges can be billed");
    if (charge.lr.group.originBranchId !== input.branchId)
      throw new BadRequestError(
        "All LRs must belong to the selected origin branch",
      );
    const transportMatches =
      input.billType === "ROAD_RAIL"
        ? ["RoadAndRail", "Rail"].includes(charge.lr.group.transportType)
        : input.billType === "ROAD_GTA"
          ? charge.lr.group.transportType === "Road"
          : true; // ROAD (to pay) accepts any transport mode
    if (!transportMatches)
      throw new BadRequestError(
        "An LR does not match the selected transport type",
      );
    if (
      charge.lr.group.paymentMode !== paymentModeForBillType(input.billType)
    )
      throw new BadRequestError(
        input.billType === "ROAD"
          ? "An LR is not a 'to pay' LR — bill it under Road GTA / Road & Rail"
          : "A 'to pay' LR was selected — bill it under the Road bill type",
      );
    const partyMatches =
      input.billingPartyType === "CONSIGNOR"
        ? charge.lr.group.consignorId === input.customerId
        : charge.lr.group.consigneeId === input.customerId;
    if (!partyMatches)
      throw new BadRequestError(
        "An LR does not match the selected client and bill head",
      );
  }
  const selectedFreightGroups = new Set<string>();
  for (const charge of charges) {
    if (charge.type !== "FREIGHT") continue;
    if (selectedFreightGroups.has(charge.lr.groupId))
      throw new BadRequestError(
        "The same truckload freight was selected more than once. Refresh eligible LRs and try again.",
      );
    selectedFreightGroups.add(charge.lr.groupId);
  }
  const allocations = charges.map((charge) => {
    const approved = charge.approvedAmountPaise ?? charge.amountPaise;
    const used = charge.billLines.reduce(
      (sum, line) => sum + line.amountPaise,
      0n,
    );
    const remaining = approved - used;
    if (remaining <= 0n)
      throw new BadRequestError(
        `Charge ${charge.id} is already fully allocated`,
      );
    return { charge, remaining };
  });
  const supplierState = context.branch.city!.state;

  // Place of Supply is operator-chosen on the bill form (defaulting to the
  // client's registered state). A ROAD "to pay" bill carries no GST, so PoS
  // is only informational there — fall back to the supplier state when the
  // form omits it.
  let placeOfSupply = supplierState;
  if (input.placeOfSupplyStateId) {
    const picked = await db.state.findUnique({
      where: { id: input.placeOfSupplyStateId },
    });
    if (!picked) throw new NotFoundError("Place of Supply state not found");
    placeOfSupply = picked;
  } else if (input.billType !== "ROAD") {
    throw new BadRequestError("Select a Place of Supply state");
  }

  const allocationGroups = context.customer.splitBillsByChargeType
    ? [
      allocations.filter(({ charge }) => charge.type === "FREIGHT"),
      allocations.filter(({ charge }) => charge.type !== "FREIGHT"),
    ].filter((group) => group.length > 0)
    : [allocations];
  const preparedBills = await Promise.all(
    allocationGroups.map(async (group) => ({
      allocations: group,
      calculation: await calculateBill({
        billType: input.billType,
        billDate: input.billDate,
        supplierStateId: supplierState.id,
        placeOfSupplyStateId: placeOfSupply.id,
        charges: group.map(({ charge, remaining }) => ({
          ...charge,
          amountPaise: remaining,
          approvedAmountPaise: remaining,
        })),
      }),
    })),
  );
  const me = actorId(req);
  const billIds = await db.$transaction(async (tx) => {
    if (!context.customer.splitBillsByChargeType) {
      const lrIds = [...new Set(charges.map((charge) => charge.lrId))].sort();

      // Serialize draft creation per LR. The eligibility response is only a
      // convenience; this lock and re-check are the authoritative guard
      // against stale tabs and concurrent requests creating duplicate drafts.
      for (const lrId of lrIds)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lrId}))`;

      const reservedLine = await tx.billLine.findFirst({
        where: {
          lrId: { in: lrIds },
          bill: { status: { in: LR_RESERVING_BILL_STATUSES } },
        },
        select: {
          lr: { select: { lrNumber: true } },
          bill: { select: { billNumber: true, status: true } },
        },
      });
      if (reservedLine) {
        const billReference =
          reservedLine.bill.billNumber ?? `${reservedLine.bill.status} bill`;
        throw new BadRequestError(
          `LR ${reservedLine.lr.lrNumber} already belongs to an active ${billReference}. Add charges to that bill or cancel it before creating another draft.`,
        );
      }
    }

    const ids: string[] = [];
    for (const prepared of preparedBills) {
      const { taxLines, ...calculationTotals } = prepared.calculation;

      // Every LR on a billed truck should be visible on the bill, even the
      // companion LRs whose freight is carried by another LR's charge — not
      // just the LRs that happen to own a BillLine.
      const truckLrIds = new Set(
        prepared.allocations.map(({ charge }) => charge.lrId),
      );
      const freightGroupIds = new Set(
        prepared.allocations
          .filter(({ charge }) => charge.type === "FREIGHT")
          .map(({ charge }) => charge.lr.groupId),
      );
      if (freightGroupIds.size > 0) {
        const companions = await tx.lorryReceipt.findMany({
          where: { groupId: { in: [...freightGroupIds] } },
          select: { id: true },
        });
        for (const companion of companions) truckLrIds.add(companion.id);
      }

      const bill = await tx.bill.create({
        data: {
          fyCode: fyCodeFor(input.billDate),
          status: "DRAFT",
          billType: input.billType,
          billingPartyType: input.billingPartyType,
          chargeMechanism,
          taxTreatment: calculationTotals.taxTreatment,
          billDate: input.billDate,
          billingCutoffDate: input.billingCutoffDate,
          dueDate: input.dueDate,
          branchId: input.branchId,
          companyId: context.branch.companyId,
          serviceCustomerId: input.customerId,
          billingCustomerId: input.customerId,
          billingLocationId: null,
          supplierStateId: supplierState.id,
          placeOfSupplyStateId: placeOfSupply.id,
          taxRuleId: calculationTotals.taxRuleId,
          billingPartyNameSnapshot: context.customer.name,
          billingGstinSnapshot: context.customer.gstNo,
          billingAddressSnapshot: context.customer.address,
          supplierNameSnapshot: context.branch.company.name,
          supplierGstinSnapshot: context.branch.gstNo,
          supplierAddressSnapshot: context.branch.address,
          supplierStateNameSnapshot: supplierState.name,
          placeOfSupplyNameSnapshot: placeOfSupply.name,
          subtotalAmountPaise: calculationTotals.subtotalAmountPaise,
          taxableAmountPaise: calculationTotals.taxableAmountPaise,
          taxAmountPaise: calculationTotals.taxAmountPaise,
          roundOffPaise: calculationTotals.roundOffPaise,
          totalAmountPaise: calculationTotals.totalAmountPaise,
          outstandingAmountPaise: calculationTotals.outstandingAmountPaise,
          remarks: input.remarks,
          createdById: me,
          lines: {
            create: prepared.allocations.map(
              ({ charge, remaining }, index) => ({
                lrId: charge.lrId,
                lrChargeId: charge.id,
                lineNumber: index + 1,
                chargeTypeSnapshot: charge.type,
                effectSnapshot: charge.effect,
                descriptionSnapshot: charge.description,
                sacCodeSnapshot: charge.sacCode,
                ratePaise: remaining,
                amountPaise: remaining,
                taxableAmountPaise: charge.isTaxable ? remaining : 0n,
              }),
            ),
          },
          lrLinks: {
            create: [...truckLrIds].map((lrId) => ({ lrId })),
          },
          taxLines: { create: taxLines },
          statusHistory: { create: { toStatus: "DRAFT", changedById: me } },
        },
        select: { id: true },
      });
      ids.push(bill.id);
    }
    return ids;
  });
  const bills = await db.bill.findMany({
    where: { id: { in: billIds } },
    include: billDetailInclude,
  });
  const orderedBills = billIds.map(
    (id) => bills.find((bill) => bill.id === id)!,
  );
  return sendOk(res, orderedBills, undefined, 201);
});

router.get("/bills", can(PERMS.BILLING.VIEW), async (req, res) => {
  const status =
    typeof req.query.status === "string"
      ? (req.query.status as BillStatus)
      : undefined;
  const query = parseListQuery(req);
  const where = { ...branchFilter(req), ...(status ? { status } : {}) };
  const [data, total] = await Promise.all([
    db.bill.findMany({
      where,
      include: {
        branch: { select: { name: true, branchCode: true } },
        billingCustomer: { select: { id: true, name: true } },
        placeOfSupplyState: true,
        journalEntry: {
          select: {
            id: true,
            voucherNumber: true,
            status: true,
            tallySyncStatus: true,
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.bill.count({ where }),
  ]);
  return sendOk(res, data, { page: query.page, size: query.size, total });
});

router.get("/bills/:id", can(PERMS.BILLING.VIEW), async (req, res) => {
  const bill = await db.bill.findUnique({
    where: { id: getParamId(req) },
    include: billDetailInclude,
  });
  if (!bill) throw new NotFoundError("Bill not found");
  assertBranchAccess(req, bill.branchId);
  return sendOk(res, bill);
});

// The SALES voucher posted for this bill at finalisation — header + Dr/Cr
// lines + bill allocations. 404 until the bill is finalised.
router.get(
  "/bills/:id/voucher",
  can(PERMS.LEDGER.VOUCHER_VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const bill = await db.bill.findUnique({
      where: { id },
      select: { branchId: true, journalEntryId: true },
    });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    if (!bill.journalEntryId)
      throw new NotFoundError("No voucher posted for this bill yet");
    const voucher = await db.journalEntry.findUniqueOrThrow({
      where: { id: bill.journalEntryId },
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
        allocations: {
          include: {
            bill: { select: { id: true, billNumber: true } },
          },
        },
      },
    });
    return sendOk(res, voucher);
  },
);

/* ------------------------------------------------------------------ */
/* Bill PDF / print-preview (tax invoice)                              */
/* ------------------------------------------------------------------ */
const loadBillForPdf = async (req: Parameters<typeof assertBranchAccess>[0]) => {
  const bill = await db.bill.findUnique({
    where: { id: getParamId(req) },
    include: billPdfInclude,
  });
  if (!bill) throw new NotFoundError("Bill not found");
  assertBranchAccess(req, bill.branchId);
  return bill;
};

router.get("/bills/:id/pdf", can(PERMS.BILLING.VIEW), async (req, res) => {
  const bill = await loadBillForPdf(req);
  const pdfBuffer = await generatePdfFromHtml(buildBillPdfHtml(bill));
  const name = (bill.billNumber ?? bill.id).replaceAll("/", "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.pdf"`);
  return res.send(pdfBuffer);
});

router.get(
  "/bills/:id/print-preview",
  can(PERMS.BILLING.VIEW),
  async (req, res) => {
    const bill = await loadBillForPdf(req);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buildBillPdfHtml(bill));
  },
);

router.get(
  "/bills/:id/available-charges",
  can(PERMS.BILLING.VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const bill = await db.bill.findUnique({
      where: { id },
      select: {
        branchId: true,
        status: true,
        lines: { select: { lrId: true } },
      },
    });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    if (bill.status !== "DRAFT") return sendOk(res, []);

    const lrIds = [...new Set(bill.lines.map((line) => line.lrId))];
    const charges = await db.lRCharge.findMany({
      where: {
        lrId: { in: lrIds },
        status: { in: ["APPROVED", "PARTIALLY_BILLED"] },
      },
      include: {
        lr: { select: { lrNumber: true } },
        billLines: {
          where: { bill: { status: { not: "CANCELLED" } } },
          select: { amountPaise: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const data = charges
      .map((charge) => {
        const approved = charge.approvedAmountPaise ?? charge.amountPaise;
        const allocated = charge.billLines.reduce(
          (sum, line) => sum + line.amountPaise,
          0n,
        );
        return {
          id: charge.id,
          lrId: charge.lrId,
          lrNumber: charge.lr.lrNumber,
          type: charge.type,
          effect: charge.effect,
          description: charge.description,
          source: charge.source,
          remainingAmountPaise: approved - allocated,
        };
      })
      .filter((charge) => charge.remainingAmountPaise > 0n);
    return sendOk(res, data);
  },
);
router.post(
  "/bills/:id/charges",
  can(PERMS.BILLING.UPDATE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(addBillChargesSchema.safeParse(req.body));
    const me = actorId(req);

    const updatedId = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bill:${id}`}))`;
      const bill = await tx.bill.findUnique({
        where: { id },
        include: {
          serviceCustomer: { select: { splitBillsByChargeType: true } },
          lines: {
            include: { lrCharge: { select: { isTaxable: true } } },
            orderBy: { lineNumber: "asc" },
          },
        },
      });
      if (!bill) throw new NotFoundError("Bill not found");
      assertBranchAccess(req, bill.branchId);
      if (bill.status !== "DRAFT")
        throw new BadRequestError(
          "Only a draft bill can be amended. Return the bill to draft first.",
        );
      if (bill.version !== input.version)
        throw new BadRequestError(
          "This draft changed in another session. Refresh and try again.",
        );

      const allowedLRIds = new Set(bill.lines.map((line) => line.lrId));
      const requestedIds = [...new Set(input.lrChargeIds)];

      // Lightweight precheck — existence/ownership/status only, no billLines.
      const precheck = await tx.lRCharge.findMany({
        where: { id: { in: requestedIds } },
        select: { id: true, lrId: true, status: true, lr: { select: { lrNumber: true } } },
      });
      if (precheck.length !== requestedIds.length)
        throw new BadRequestError("One or more LR charges were not found");
      for (const charge of precheck) {
        if (!allowedLRIds.has(charge.lrId))
          throw new BadRequestError(
            `Charge for LR ${charge.lr.lrNumber} does not belong to this bill`,
          );
        if (!["APPROVED", "PARTIALLY_BILLED"].includes(charge.status))
          throw new BadRequestError("Only approved charges can be added");
      }

      for (const lrId of [...new Set(precheck.map((charge) => charge.lrId))].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lrId}))`;

      // Single full read, post-lock — the only place we need billLines.
      const charges = await tx.lRCharge.findMany({
        where: { id: { in: requestedIds } },
        include: {
          lr: { select: { lrNumber: true } },
          billLines: {
            where: { bill: { status: { not: "CANCELLED" } } },
            select: { amountPaise: true },
          },
        },
      });

      const allocations = charges.map((charge) => {
        const approved = charge.approvedAmountPaise ?? charge.amountPaise;
        const used = charge.billLines.reduce((sum, line) => sum + line.amountPaise, 0n);
        const remaining = approved - used;
        if (remaining <= 0n)
          throw new BadRequestError(
            `Charge for LR ${charge.lr.lrNumber} is already fully allocated`,
          );
        return { charge, remaining };
      });

      if (bill.serviceCustomer.splitBillsByChargeType) {
        const existingKinds = new Set(
          bill.lines.map((line) => (line.chargeTypeSnapshot === "FREIGHT" ? "FREIGHT" : "ADDITIONAL")),
        );
        const incomingKinds = new Set(
          allocations.map(({ charge }) => (charge.type === "FREIGHT" ? "FREIGHT" : "ADDITIONAL")),
        );
        if (
          existingKinds.size !== 1 ||
          incomingKinds.size !== 1 ||
          [...incomingKinds][0] !== [...existingKinds][0]
        )
          throw new BadRequestError(
            "This customer separates freight and additional charges. Add the charge to the matching draft.",
          );
      }

      const calculation = await calculateBill(
        {
          billType: bill.billType,
          billDate: bill.billDate,
          supplierStateId: bill.supplierStateId,
          placeOfSupplyStateId: bill.placeOfSupplyStateId,
          charges: [
            ...bill.lines.map((line) => ({
              amountPaise: line.amountPaise,
              approvedAmountPaise: line.amountPaise,
              effect: line.effectSnapshot,
              isTaxable: line.lrCharge.isTaxable,
            })),
            ...allocations.map(({ charge, remaining }) => ({
              amountPaise: remaining,
              approvedAmountPaise: remaining,
              effect: charge.effect,
              isTaxable: charge.isTaxable,
            })),
          ],
        },
        tx, // CHANGED — stays on this transaction's connection
      );

      const firstLineNumber = Math.max(0, ...bill.lines.map((line) => line.lineNumber)) + 1;

      const updated = await tx.bill.update({
        where: { id, version: input.version },
        data: {
          taxTreatment: calculation.taxTreatment,
          taxRuleId: calculation.taxRuleId,
          subtotalAmountPaise: calculation.subtotalAmountPaise,
          taxableAmountPaise: calculation.taxableAmountPaise,
          taxAmountPaise: calculation.taxAmountPaise,
          roundOffPaise: calculation.roundOffPaise,
          totalAmountPaise: calculation.totalAmountPaise,
          outstandingAmountPaise: calculation.outstandingAmountPaise,
          updatedById: me,
          version: { increment: 1 },
          lines: {
            create: allocations.map(({ charge, remaining }, index) => ({
              lrId: charge.lrId,
              lrChargeId: charge.id,
              lineNumber: firstLineNumber + index,
              chargeTypeSnapshot: charge.type,
              effectSnapshot: charge.effect,
              descriptionSnapshot: charge.description,
              sacCodeSnapshot: charge.sacCode,
              ratePaise: remaining,
              amountPaise: remaining,
              taxableAmountPaise: charge.isTaxable ? remaining : 0n,
            })),
          },
          taxLines: {
            deleteMany: {},
            create: calculation.taxLines,
          },
        },
        select: { id: true }, // CHANGED — no billDetailInclude here anymore
      });
      return updated.id;
    }); // no TX_BUDGET — should now comfortably fit the default 5s

    // CHANGED — the heavy nested read happens after commit, no locks held.
    const bill = await db.bill.findUniqueOrThrow({
      where: { id: updatedId },
      include: billDetailInclude,
    });
    return sendOk(res, bill);
  },
);

router.post(
  "/bills/:id/return-to-draft",
  can(PERMS.BILLING.APPROVE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(returnBillToDraftSchema.safeParse(req.body));
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    if (!["PENDING_REVIEW", "APPROVED"].includes(bill.status))
      throw new BadRequestError(
        "Only a pending-review or approved bill can be returned to draft",
      );
    if (bill.version !== input.version)
      throw new BadRequestError(
        "This bill changed in another session. Refresh and try again.",
      );
    const me = actorId(req);
    const updated = await db.bill.update({
      where: { id, version: input.version },
      data: {
        status: "DRAFT",
        reviewedById: null,
        reviewedAt: null,
        approvedById: null,
        approvedAt: null,
        updatedById: me,
        version: { increment: 1 },
        statusHistory: {
          create: {
            fromStatus: bill.status,
            toStatus: "DRAFT",
            reason: input.reason,
            changedById: me,
          },
        },
      },
      // Slim on purpose: returning to draft doesn't touch lines/LR/group
      // data, only bill-level status fields — the frontend merges this
      // patch onto its existing bill state instead of re-fetching the
      // whole deep detail tree (billDetailInclude) for nothing changed.
      select: { id: true, version: true, status: true },
    });
    return sendOk(res, updated);
  },
);

const transition = (
  path: string,
  permission: Parameters<typeof can>[0],
  from: BillStatus[],
  to: BillStatus,
  stamp?: "approved",
) => {
  router.post(path, can(permission), async (req, res) => {
    const id = getParamId(req);
    const input = validate(transitionBillSchema.safeParse(req.body ?? {}));
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    if (!from.includes(bill.status))
      throw new BadRequestError(
        `Bill cannot move from ${bill.status} to ${to}`,
      );
    const me = actorId(req);
    const updated = await db.bill.update({
      where: { id },
      data: {
        status: to,
        ...(stamp === "approved"
          ? { approvedById: me, approvedAt: new Date() }
          : {}),
        statusHistory: {
          create: {
            fromStatus: bill.status,
            toStatus: to,
            reason: input.reason,
            changedById: me,
          },
        },
      },
      // Slim on purpose — submit/approve are pure status flips, no line/LR/
      // group data changes. The frontend merges this patch onto its existing
      // bill state rather than re-fetching the whole deep detail tree.
      select: { id: true, version: true, status: true },
    });
    return sendOk(res, updated);
  });
};

// Approve goes straight from DRAFT to APPROVED — the old intermediate
// "submit for review" / PENDING_REVIEW step was removed. PENDING_REVIEW is
// still accepted here too, only so any bill already sitting in that status
// from before this change isn't stranded with no way forward.
transition(
  "/bills/:id/approve",
  PERMS.BILLING.APPROVE,
  ["DRAFT", "PENDING_REVIEW"],
  "APPROVED",
  "approved",
);

router.post(
  "/bills/:id/finalise",
  can(PERMS.BILLING.FINALISE),
  async (req, res) => {
    const id = getParamId(req);
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        branch: true,
        lines: {
          include: {
            lrCharge: {
              include: {
                billLines: {
                  where: {
                    bill: { status: { not: "CANCELLED" } },
                    NOT: { billId: id },
                  },
                  select: { amountPaise: true },
                },
              },
            },
          },
        },
      },
    });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    if (["FINALISED", "SENT", "PARTIALLY_PAID", "PAID"].includes(bill.status)) {
      return sendOk(
        res,
        await db.bill.findUniqueOrThrow({
          where: { id },
          include: billDetailInclude,
        }),
      );
    }
    if (bill.status !== "APPROVED")
      throw new BadRequestError("Only an approved bill can be finalised");
    // Ageing buckets by dueDate, falling back to billDate when absent —
    // a bill with no due date silently ages from its bill date instead of
    // its real payment terms. Creation now requires it; this guard catches
    // drafts started before that validation existed.
    if (!bill.dueDate)
      throw new BadRequestError(
        "This bill has no due date and predates the required-due-date rule. Cancel it and recreate the draft with a due date before finalising.",
      );
    for (const line of bill.lines) {
      const approved =
        line.lrCharge.approvedAmountPaise ?? line.lrCharge.amountPaise;
      const otherAllocated = line.lrCharge.billLines.reduce(
        (sum, item) => sum + item.amountPaise,
        0n,
      );
      if (otherAllocated + line.amountPaise > approved)
        throw new BadRequestError(
          "An LR charge is over-allocated by another bill",
        );
    }
    const calculation = await calculateBill({
      billType: bill.billType,
      billDate: bill.billDate,
      supplierStateId: bill.supplierStateId,
      placeOfSupplyStateId: bill.placeOfSupplyStateId,
      charges: bill.lines.map((line) => ({
        amountPaise: line.amountPaise,
        approvedAmountPaise: line.amountPaise,
        effect: line.effectSnapshot,
        isTaxable: line.lrCharge.isTaxable,
      })),
    });
    const seq = await nextSequence(
      db,
      bill.branch.branchCode,
      bill.fyCode,
      "BILL",
    );
    const billNumber = formatDocNumber(
      bill.branch.branchCode,
      bill.fyCode,
      seq,
      "SKT/B",
    );
    const me = actorId(req);
    await db.$transaction(async (tx) => {
      // Post the SALES voucher first — a posting failure (unbalanced, or the
      // chart of accounts not seeded) must roll the whole finalise back so a
      // FINALISED bill always carries a POSTED voucher.
      const voucher = await postSalesVoucher(tx, {
        billId: id,
        billNumber,
        billDate: bill.billDate,
        branchId: bill.branchId,
        fyCode: bill.fyCode,
        customerId: bill.billingCustomerId,
        totalAmountPaise: calculation.totalAmountPaise,
        roundOffPaise: calculation.roundOffPaise,
        lines: bill.lines.map((line) => ({
          chargeType: line.chargeTypeSnapshot,
          effect: line.effectSnapshot,
          amountPaise: line.amountPaise,
        })),
        taxLines: calculation.taxLines.map((line) => ({
          taxType: line.taxType,
          taxAmountPaise: line.taxAmountPaise,
        })),
        createdById: me,
      });
      await tx.bill.update({
        where: { id, version: bill.version },
        data: {
          billNumber,
          status: "FINALISED",
          journalEntryId: voucher.id,
          taxTreatment: calculation.taxTreatment,
          taxRuleId: calculation.taxRuleId,
          subtotalAmountPaise: calculation.subtotalAmountPaise,
          taxableAmountPaise: calculation.taxableAmountPaise,
          taxAmountPaise: calculation.taxAmountPaise,
          roundOffPaise: calculation.roundOffPaise,
          totalAmountPaise: calculation.totalAmountPaise,
          outstandingAmountPaise: calculation.outstandingAmountPaise,
          finalisedById: me,
          finalisedAt: new Date(),
          version: { increment: 1 },
          statusHistory: {
            create: {
              fromStatus: "APPROVED",
              toStatus: "FINALISED",
              changedById: me,
            },
          },
          taxLines: {
            deleteMany: {},
            create: calculation.taxLines,
          },
        },
      });
      for (const lrId of new Set(bill.lines.map((line) => line.lrId)))
        await refreshLRBillingStatus(tx, lrId);
      await tx.cashReceivable.upsert({
        where: { billId: id },
        create: {
          billId: id,
          customerId: bill.billingCustomerId,
          partyName: bill.billingPartyNameSnapshot,
          source: "BILL",
          totalAmount: calculation.outstandingAmountPaise,
          expectedAmount: calculation.outstandingAmountPaise,
          expectedDate: bill.dueDate,
        },
        update: {
          partyName: bill.billingPartyNameSnapshot,
          totalAmount: calculation.outstandingAmountPaise,
          expectedAmount: calculation.outstandingAmountPaise,
          expectedDate: bill.dueDate,
        },
      });
    });
    return sendOk(
      res,
      await db.bill.findUniqueOrThrow({
        where: { id },
        include: billDetailInclude,
      }),
    );
  },
);

router.post(
  "/bills/:id/cancel",
  can(PERMS.BILLING.CANCEL),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(cancelBillSchema.safeParse(req.body));
    const bill = await db.bill.findUnique({
      where: { id },
      include: { lines: { select: { lrId: true } } },
    });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    if (["PARTIALLY_PAID", "PAID"].includes(bill.status))
      throw new BadRequestError("A paid bill cannot be cancelled");
    const me = actorId(req);
    await db.$transaction(async (tx) => {
      // Reverse the SALES voucher, if one was posted (bill reached FINALISED).
      // Posts a contra JOURNAL and closes the bill's outstanding reference.
      if (bill.journalEntryId)
        await reverseJournal(
          tx,
          bill.journalEntryId,
          `Bill ${bill.billNumber ?? id} cancelled: ${input.reason}`,
          me,
        );
      await tx.bill.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancellationReason: input.reason,
          cancelledById: me,
          cancelledAt: new Date(),
          // A cancelled bill owes nothing — the guard above already blocks
          // cancelling a PARTIALLY_PAID/PAID bill, so this is always 0 -> 0
          // in the valid case. Without this, outstandingAmountPaise keeps
          // its pre-cancel value forever, so Ageing/Customer Statement keep
          // counting cancelled bills as real debt.
          outstandingAmountPaise: 0n,
          statusHistory: {
            create: {
              fromStatus: bill.status,
              toStatus: "CANCELLED",
              reason: input.reason,
              changedById: me,
            },
          },
        },
      });
      // Cancelling a bill — including one that was already FINALISED — frees
      // its LRs/charges back to billable. A charge that had reached
      // BILLED/PARTIALLY_BILLED but lost its only allocation reverts to
      // APPROVED (see refreshLRBillingStatus) so it's immediately available
      // for a new bill.
      for (const lrId of new Set(bill.lines.map((line) => line.lrId)))
        await refreshLRBillingStatus(tx, lrId);
      // NEW — remove the linked Cash Planning entry, if one exists.
      // Safe to hard-delete: the guard above already blocks cancelling a
      // PARTIALLY_PAID/PAID bill, so a linked receivable here never had
      // real money received against it.
      await tx.cashReceivable.deleteMany({ where: { billId: id } });
    });
    // Slim on purpose — cancelling doesn't change line/LR/group data on this
    // bill, only its own status fields. The frontend merges this patch onto
    // its existing bill state rather than re-fetching the whole deep detail
    // tree (billDetailInclude) for nothing changed.
    return sendOk(
      res,
      await db.bill.findUniqueOrThrow({
        where: { id },
        select: { id: true, version: true, status: true },
      }),
    );
  },
);

router.get(
  "/bills/:id/credit-notes",
  can(PERMS.BILLING.VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const bill = await db.bill.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    return sendOk(
      res,
      await db.billCreditNote.findMany({
        where: { billId: id },
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
    );
  },
);

router.post(
  "/bills/:id/credit-notes",
  can(PERMS.BILLING.CREDIT_NOTE_CREATE),
  async (req, res) => {
    const id = getParamId(req);
    const input = validate(createBillCreditNoteSchema.safeParse(req.body));
    const bill = await db.bill.findUnique({
      where: { id },
      select: {
        id: true,
        billNumber: true,
        branchId: true,
        billingCustomerId: true,
        status: true,
        outstandingAmountPaise: true,
      },
    });
    if (!bill) throw new NotFoundError("Bill not found");
    assertBranchAccess(req, bill.branchId);
    // GST freezes an invoice once issued — a note only makes sense against a
    // bill that actually reached the customer as a real receivable.
    if (!(RECEIVABLE_BILL_STATUSES as readonly BillStatus[]).includes(bill.status))
      throw new BadRequestError(
        `A ${bill.status} bill cannot carry a credit/debit note`,
      );
    // A credit note can only give back what's still outstanding — it never
    // manufactures a negative debt. A debit note has no such ceiling.
    if (input.noteType === "CREDIT_NOTE" && input.amountPaise > bill.outstandingAmountPaise)
      throw new BadRequestError(
        "Credit note amount exceeds the bill's outstanding amount",
      );
    const me = actorId(req);
    const noteDate = new Date();
    const fyCode = fyCodeFor(noteDate);
    const branch = await db.branch.findUniqueOrThrow({
      where: { id: bill.branchId },
      select: { branchCode: true },
    });

    const note = await db.$transaction(async (tx) => {
      const seq = await nextSequence(
        tx,
        branch.branchCode,
        fyCode,
        input.noteType === "CREDIT_NOTE" ? "CN" : "DN",
      );
      const noteNumber = formatDocNumber(
        branch.branchCode,
        fyCode,
        seq,
        input.noteType === "CREDIT_NOTE" ? "SKT/CN" : "SKT/DN",
      );

      const created = await tx.billCreditNote.create({
        data: {
          noteType: input.noteType,
          noteNumber,
          fyCode,
          branchId: bill.branchId,
          billId: id,
          customerId: bill.billingCustomerId,
          amountPaise: input.amountPaise,
          reason: input.reason,
          createdById: me,
        },
      });

      const voucher = await postBillCreditNoteVoucher(tx, {
        billCreditNoteId: created.id,
        noteType: input.noteType,
        noteNumber,
        noteDate,
        branchId: bill.branchId,
        fyCode,
        customerId: bill.billingCustomerId,
        amountPaise: input.amountPaise,
        createdById: me,
      });
      await tx.billCreditNote.update({
        where: { id: created.id },
        data: { journalEntryId: voucher.id },
      });

      const delta =
        input.noteType === "CREDIT_NOTE" ? -input.amountPaise : input.amountPaise;
      const newOutstanding = bill.outstandingAmountPaise + delta;
      await tx.bill.update({
        where: { id },
        data: {
          outstandingAmountPaise: newOutstanding,
          status:
            input.noteType === "CREDIT_NOTE" && newOutstanding <= 0n
              ? "PAID"
              : bill.status === "PAID" && newOutstanding > 0n
                ? "PARTIALLY_PAID"
                : bill.status,
        },
      });

      return created;
    });
    return sendOk(res, note);
  },
);

router.get("/tax-rules", can(PERMS.BILLING.VIEW), async (_req, res) =>
  sendOk(
    res,
    await db.billingTaxRule.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { name: "asc" }],
    }),
  ),
);

router.post(
  "/tax-rules",
  can(PERMS.BILLING.TAX_RULE_MANAGE),
  async (req, res) => {
    const input = validate(billingTaxRuleSchema.safeParse(req.body));
    const rule = await db.billingTaxRule.create({
      data: { ...input, createdById: actorId(req) },
    });
    return sendOk(res, rule, undefined, 201);
  },
);

export default router;
