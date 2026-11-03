import { Router, type Request } from "express";
import { claimListQuerySchema, claimStatusSchema } from "@skerp/validators";
import {
  PERMS,
  type ClaimDetail,
  type ClaimListRow,
  type ClaimPerson,
  type ClaimStatusSummary,
} from "@skerp/types";
import type { ClaimOrigin, Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { claimMoneyTotals, COUNTED_RECOVERY_STATUSES } from "./claim.compute.js";

/**
 * Claims / Damage Settlement (docs/CLAIMS_JIRA.md, Epic C). Mounted at /claims.
 * A bespoke router, not createCrudRouter: claims are transactional documents
 * with their own lifecycle. Every query is scoped to the claim's branch.
 */
const router: Router = Router();
router.use(authMiddleware);

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

const SORTABLE_FIELDS = [
  "claimNumber",
  "claimDate",
  "claimedAmountPaise",
  "settledAmountPaise",
  "status",
] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];
const isSortable = (field: string): field is SortableField =>
  (SORTABLE_FIELDS as readonly string[]).includes(field);

/** A date picker sends midnight UTC; claimDate carries a time of day. */
const endOfDayUtc = (date: Date) => {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

const personName = (user: { id: string; firstName: string | null; lastName: string | null }): ClaimPerson => ({
  id: user.id,
  name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "—",
});

/**
 * Register filters, shared by the list and the summary strip. Every filter
 * combines (AND); an explicit branch must be one the user can see.
 */
const claimWhere = (
  req: Request,
  search: string | undefined,
  filters: ReturnType<typeof claimListQuerySchema.parse>,
): Prisma.ClaimWhereInput => {
  if (filters.branchId) assertBranchAccess(req, filters.branchId);
  return {
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : branchFilter(req)),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.claimType ? { claimType: filters.claimType } : {}),
    ...(filters.origin ? { origin: filters.origin } : {}),
    ...(filters.causedBy ? { causedBy: filters.causedBy } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.lrId ? { lrId: filters.lrId } : {}),
    ...(filters.lrGroupId ? { lr: { is: { groupId: filters.lrGroupId } } } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
        claimDate: {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { lte: endOfDayUtc(filters.dateTo) } : {}),
        },
      }
      : {}),
    ...(search
      ? {
        OR: [
          { claimNumber: { contains: search, mode: "insensitive" } },
          { lr: { is: { lrNumber: { contains: search, mode: "insensitive" } } } },
        ],
      }
      : {}),
  };
};

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

router.get("/", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(claimListQuerySchema.safeParse(req.query));
  const where = claimWhere(req, query.search, filters);

  const orderBy: Prisma.ClaimOrderByWithRelationInput[] =
    query.sort && isSortable(query.sort.field)
      ? [{ [query.sort.field]: query.sort.direction }, { createdAt: "desc" }]
      : [{ claimDate: "desc" }, { createdAt: "desc" }];

  const [claims, total] = await Promise.all([
    db.claim.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        customer: { select: { id: true, name: true } },
        lr: { select: { id: true, lrNumber: true, groupId: true } },
        recoveries: {
          where: { status: { in: [...COUNTED_RECOVERY_STATUSES] } },
          select: { status: true, amountPaise: true },
        },
      },
      orderBy,
      skip: query.page * query.size,
      take: query.size,
    }),
    db.claim.count({ where }),
  ]);

  const rows: ClaimListRow[] = claims.map((claim) => {
    const totals = claimMoneyTotals(claim);
    return {
      id: claim.id,
      claimNumber: claim.claimNumber,
      claimDate: claim.claimDate.toISOString(),
      claimType: claim.claimType,
      origin: claim.origin,
      causedBy: claim.causedBy,
      status: claim.status,
      damagedQty: claim.damagedQty.toNumber(),
      shortageQty: claim.shortageQty.toNumber(),
      claimedAmountPaise: Number(claim.claimedAmountPaise),
      settledAmountPaise:
        claim.settledAmountPaise === null ? null : Number(claim.settledAmountPaise),
      recoveredAmountPaise: Number(totals.recoveredAmountPaise),
      netLossPaise: totals.netLossPaise === null ? null : Number(totals.netLossPaise),
      branch: claim.branch,
      customer: claim.customer,
      lr: claim.lr,
      createdAt: claim.createdAt.toISOString(),
    };
  });

  return sendOk(res, rows, { page: query.page, size: query.size, total });
});

/** Counts and amounts per status under the register's other filters (the status filter is ignored). */
router.get("/summary", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(claimListQuerySchema.safeParse(req.query));
  const groups = await db.claim.groupBy({
    by: ["status"],
    where: claimWhere(req, query.search, { ...filters, status: undefined }),
    _count: { _all: true },
    _sum: { claimedAmountPaise: true, settledAmountPaise: true },
  });

  const summary: ClaimStatusSummary[] = claimStatusSchema.options.map((status) => {
    const group = groups.find((row) => row.status === status);
    return {
      status,
      count: group?._count._all ?? 0,
      claimedAmountPaise: Number(group?._sum.claimedAmountPaise ?? 0n),
      settledAmountPaise: Number(group?._sum.settledAmountPaise ?? 0n),
    };
  });
  return sendOk(res, summary);
});

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

const namedUser = { select: { id: true, firstName: true, lastName: true } } as const;
const named = { select: { id: true, name: true } } as const;

const claimDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  customer: named,
  lr: {
    select: {
      id: true,
      lrNumber: true,
      groupId: true,
      group: { select: { groupNumber: true, consignor: named, consignee: named } },
    },
  },
  items: { orderBy: { createdAt: "asc" } },
  recoveries: {
    orderBy: { createdAt: "asc" },
    include: { transport: named, driver: named, labour: named },
  },
  events: { orderBy: { createdAt: "asc" }, include: { actor: namedUser } },
  createdBy: namedUser,
} satisfies Prisma.ClaimInclude;

/** GRN number for the source link; the other sources link by id alone. */
const sourceNumberOf = async (origin: ClaimOrigin, originRefId: string | null) => {
  if (origin !== "GRN" || !originRefId) return null;
  const grn = await db.gRN.findUnique({
    where: { id: originRefId },
    select: { grnNumber: true },
  });
  return grn?.grnNumber ?? null;
};

router.get("/:id", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const claim = await db.claim.findFirst({
    where: { id: getParamId(req), deletedAt: null },
    include: claimDetailInclude,
  });
  if (!claim) throw new NotFoundError("Claim not found");
  // 403, not 404: the claim exists, it just belongs to another branch.
  assertBranchAccess(req, claim.branchId);

  const totals = claimMoneyTotals(claim);
  const detail: ClaimDetail = {
    id: claim.id,
    claimNumber: claim.claimNumber,
    fyCode: claim.fyCode,
    claimDate: claim.claimDate.toISOString(),
    claimType: claim.claimType,
    origin: claim.origin,
    originRefId: claim.originRefId,
    sourceNumber: await sourceNumberOf(claim.origin, claim.originRefId),
    causedBy: claim.causedBy,
    status: claim.status,
    damagedQty: claim.damagedQty.toNumber(),
    shortageQty: claim.shortageQty.toNumber(),
    goodsValuePaise: claim.goodsValuePaise === null ? null : Number(claim.goodsValuePaise),
    claimedAmountPaise: Number(claim.claimedAmountPaise),
    settledAmountPaise:
      claim.settledAmountPaise === null ? null : Number(claim.settledAmountPaise),
    recoveredAmountPaise: Number(totals.recoveredAmountPaise),
    netLossPaise: totals.netLossPaise === null ? null : Number(totals.netLossPaise),
    basisDescription: claim.basisDescription,
    settledAt: claim.settledAt?.toISOString() ?? null,
    rejectedReason: claim.rejectedReason,
    cancelReason: claim.cancelReason,
    version: claim.version,
    branch: claim.branch,
    customer: claim.customer,
    lr: {
      id: claim.lr.id,
      lrNumber: claim.lr.lrNumber,
      groupId: claim.lr.groupId,
      groupNumber: claim.lr.group.groupNumber,
      consignor: claim.lr.group.consignor,
      consignee: claim.lr.group.consignee,
    },
    items: claim.items.map((item) => ({
      id: item.id,
      lrGoodsId: item.lrGoodsId,
      goodsName: item.goodsName,
      damagedQty: item.damagedQty.toNumber(),
      shortageQty: item.shortageQty.toNumber(),
      valuePaise: item.valuePaise === null ? null : Number(item.valuePaise),
    })),
    recoveries: claim.recoveries.map((recovery) => ({
      id: recovery.id,
      source: recovery.source,
      partyName:
        recovery.transport?.name ??
        recovery.driver?.name ??
        recovery.labour?.name ??
        recovery.partyName,
      amountPaise: Number(recovery.amountPaise),
      status: recovery.status,
      referenceNo: recovery.referenceNo,
      remarks: recovery.remarks,
      createdAt: recovery.createdAt.toISOString(),
    })),
    events: claim.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      actor: event.actor ? personName(event.actor) : null,
    })),
    createdBy: personName(claim.createdBy),
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
  return sendOk(res, detail);
});

export default router;
