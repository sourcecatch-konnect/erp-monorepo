import { Router } from "express";
import { claimListQuerySchema } from "@skerp/validators";
import { PERMS, type ClaimListRow } from "@skerp/types";
import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
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

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

router.get("/", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(claimListQuerySchema.safeParse(req.query));
  if (filters.branchId) assertBranchAccess(req, filters.branchId);

  const where: Prisma.ClaimWhereInput = {
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : branchFilter(req)),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.claimType ? { claimType: filters.claimType } : {}),
    ...(filters.origin ? { origin: filters.origin } : {}),
    ...(filters.causedBy ? { causedBy: filters.causedBy } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.lrId ? { lrId: filters.lrId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
        claimDate: {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { lte: endOfDayUtc(filters.dateTo) } : {}),
        },
      }
      : {}),
    ...(query.search
      ? {
        OR: [
          { claimNumber: { contains: query.search, mode: "insensitive" } },
          { lr: { is: { lrNumber: { contains: query.search, mode: "insensitive" } } } },
        ],
      }
      : {}),
  };

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
        lr: { select: { id: true, lrNumber: true } },
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

export default router;
