import { Router, type Request } from "express";
import {
  addClaimRecoverySchema,
  receiveClaimRecoverySchema,
  claimAssessmentSchema,
  claimCostSummaryQuerySchema,
  claimExportQuerySchema,
  claimListQuerySchema,
  claimReasonSchema,
  claimStatusSchema,
  claimVersionSchema,
  createClaimSchema,
  settleClaimSchema,
} from "@skerp/validators";
import { PERMS, type ClaimStatusSummary } from "@skerp/types";
import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { claimDetail } from "./claim.detail.js";
import { notifyIfHighValueClaim } from "./claim.alerts.js";
import {
  claimAgeing,
  claimCostSummary,
  claimListInclude,
  claimsCsv,
  claimsXlsx,
  exportRows,
  toClaimListRow,
} from "./claim.reports.js";
import {
  approveSettlement,
  closeClaim,
  createManualClaim,
  declineSettlement,
  eligibleLrsForClaim,
  loadClaimForAction,
  lrForManualClaim,
  requestSettlement,
  saveAssessment,
  settlementOptions,
} from "./claim.service.js";
import {
  addRecovery,
  approveRecovery,
  receiveRecovery,
  recoveryFundingAccounts,
  rejectRecovery,
} from "./claim.recovery.service.js";

/**
 * Claims / Damage Settlement (docs/CLAIMS_JIRA.md, Epic C). Mounted at /claims.
 * A bespoke router, not createCrudRouter: claims are transactional documents
 * with their own lifecycle. Every query is scoped to the claim's branch.
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

/** The register's order — the export uses the same one. */
const orderByOf = (
  sort: ReturnType<typeof parseListQuery>["sort"],
): Prisma.ClaimOrderByWithRelationInput[] =>
  sort && isSortable(sort.field)
    ? [{ [sort.field]: sort.direction }, { createdAt: "desc" }]
    : [{ claimDate: "desc" }, { createdAt: "desc" }];

/** A date picker sends midnight UTC; claimDate carries a time of day. */
const endOfDayUtc = (date: Date) => {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

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

  const [claims, total] = await Promise.all([
    db.claim.findMany({
      where,
      include: claimListInclude,
      orderBy: orderByOf(query.sort),
      skip: query.page * query.size,
      take: query.size,
    }),
    db.claim.count({ where }),
  ]);

  return sendOk(res, claims.map(toClaimListRow), { page: query.page, size: query.size, total });
});

/* ------------------------------------------------------------------ */
/* Reports (C8) — same filters as the register                        */
/* ------------------------------------------------------------------ */

/** The filtered register, in the register's order, with a totals row. */
router.get("/export", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const { format, ...filters } = validate(claimExportQuerySchema.safeParse(req.query));
  const rows = await exportRows(claimWhere(req, query.search, filters), orderByOf(query.sort));
  const now = new Date();
  const name = `damage-claims-${now.toISOString().slice(0, 10)}`;
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
    // BOM so Excel opens ₹ and other non-ASCII text correctly.
    return res.send(`\uFEFF${claimsCsv(rows)}`);
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${name}.xlsx"`);
  return res.send(await claimsXlsx(rows, now));
});

/** Open claims by days since raised (the status filter is ignored). */
router.get("/ageing", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const filters = validate(claimListQuerySchema.safeParse(req.query));
  const where = claimWhere(req, query.search, { ...filters, status: undefined });
  return sendOk(res, await claimAgeing(where, new Date()));
});

/** Settled, recovered and net loss of settled claims, grouped (the status filter is ignored). */
router.get("/cost-summary", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const { groupBy, ...filters } = validate(claimCostSummaryQuerySchema.safeParse(req.query));
  const where = claimWhere(req, query.search, { ...filters, status: undefined });
  return sendOk(res, await claimCostSummary(where, groupBy));
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
/* Manual claim (C4)                                                   */
/* ------------------------------------------------------------------ */

/** Delivered LRs of the user's branches, for the "New claim" picker. */
router.get("/eligible-lrs", can(PERMS.CLAIM.CREATE), async (req, res) => {
  const { search } = parseListQuery(req);
  return sendOk(res, await eligibleLrsForClaim(branchFilter(req, "originBranchId"), search));
});

router.post("/", can(PERMS.CLAIM.CREATE), async (req, res) => {
  const input = validate(createClaimSchema.safeParse(req.body));
  const lr = await lrForManualClaim(input.lrId);
  // The claim belongs to the LR's booking branch.
  assertBranchAccess(req, lr.group.originBranchId);
  const claim = await createManualClaim(input, lr, actorId(req));
  await notifyIfHighValueClaim(claim.id, actorId(req));
  return sendOk(res, await claimDetail(claim.id), undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

router.get("/:id", can(PERMS.CLAIM.VIEW), async (req, res) => {
  const detail = await claimDetail(getParamId(req));
  // 403, not 404: the claim exists, it just belongs to another branch.
  assertBranchAccess(req, detail.branch.id);
  return sendOk(res, detail);
});

/* ------------------------------------------------------------------ */
/* Actions (C4) — each loads the claim, checks its branch, then acts   */
/* ------------------------------------------------------------------ */

const claimForAction = async (req: Request) => {
  const claim = await loadClaimForAction(getParamId(req));
  assertBranchAccess(req, claim.branchId);
  return claim;
};

/** PENDING → ACTIVE once goods value, claimed amount and caused-by are in. */
router.post("/:id/assess", can(PERMS.CLAIM.UPDATE), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(claimAssessmentSchema.safeParse(req.body));
  await saveAssessment(claim, input, actorId(req), { activate: true });
  await notifyIfHighValueClaim(claim.id, actorId(req));
  return sendOk(res, await claimDetail(claim.id));
});

/** Edit an active claim's assessment. */
router.patch("/:id", can(PERMS.CLAIM.UPDATE), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(claimAssessmentSchema.safeParse(req.body));
  await saveAssessment(claim, input, actorId(req), { activate: false });
  await notifyIfHighValueClaim(claim.id, actorId(req));
  return sendOk(res, await claimDetail(claim.id));
});

router.get("/:id/settlement-options", can(PERMS.CLAIM.SETTLE), async (req, res) => {
  const claim = await claimForAction(req);
  return sendOk(res, await settlementOptions(claim));
});

/** Settle now, or — above the approval limit — wait for a second user. */
router.post("/:id/settle", can(PERMS.CLAIM.SETTLE), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(settleClaimSchema.safeParse(req.body));
  await requestSettlement(claim, input, actorId(req));
  return sendOk(res, await claimDetail(claim.id));
});

router.post("/:id/settlement/approve", can(PERMS.CLAIM.APPROVE), async (req, res) => {
  const claim = await claimForAction(req);
  const { version } = validate(claimVersionSchema.safeParse(req.body));
  await approveSettlement(claim, version, actorId(req));
  return sendOk(res, await claimDetail(claim.id));
});

router.post("/:id/settlement/decline", can(PERMS.CLAIM.APPROVE), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(claimReasonSchema.safeParse(req.body));
  await declineSettlement(claim, input, actorId(req));
  return sendOk(res, await claimDetail(claim.id));
});

router.post("/:id/reject", can(PERMS.CLAIM.SETTLE), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(claimReasonSchema.safeParse(req.body));
  await closeClaim(claim, input, actorId(req), "REJECTED");
  return sendOk(res, await claimDetail(claim.id));
});

router.post("/:id/cancel", can(PERMS.CLAIM.UPDATE), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(claimReasonSchema.safeParse(req.body));
  await closeClaim(claim, input, actorId(req), "CANCELLED");
  return sendOk(res, await claimDetail(claim.id));
});

/* ------------------------------------------------------------------ */
/* Recovery lines (C5)                                                 */
/* ------------------------------------------------------------------ */

const recoveryIdOf = (req: Request) => {
  const id = req.params.recoveryId;
  if (!id || Array.isArray(id)) throw new ValidationError("Invalid recovery ID");
  return id;
};

/** Cash / bank accounts a recovery can be received into. */
router.get("/:id/funding-accounts", can(PERMS.CLAIM.RECOVERY), async (req, res) => {
  await claimForAction(req);
  return sendOk(res, await recoveryFundingAccounts());
});

router.post("/:id/recoveries", can(PERMS.CLAIM.RECOVERY), async (req, res) => {
  const claim = await claimForAction(req);
  const input = validate(addClaimRecoverySchema.safeParse(req.body));
  await addRecovery(claim, input, actorId(req));
  return sendOk(res, await claimDetail(claim.id), undefined, 201);
});

router.post(
  "/:id/recoveries/:recoveryId/approve",
  can(PERMS.CLAIM.RECOVERY),
  async (req, res) => {
    const claim = await claimForAction(req);
    const { version } = validate(claimVersionSchema.safeParse(req.body));
    await approveRecovery(claim, recoveryIdOf(req), version, actorId(req));
    return sendOk(res, await claimDetail(claim.id));
  },
);

router.post(
  "/:id/recoveries/:recoveryId/receive",
  can(PERMS.CLAIM.RECOVERY),
  async (req, res) => {
    const claim = await claimForAction(req);
    const input = validate(receiveClaimRecoverySchema.safeParse(req.body));
    await receiveRecovery(claim, recoveryIdOf(req), input, actorId(req));
    return sendOk(res, await claimDetail(claim.id));
  },
);

router.post(
  "/:id/recoveries/:recoveryId/reject",
  can(PERMS.CLAIM.RECOVERY),
  async (req, res) => {
    const claim = await claimForAction(req);
    const input = validate(claimReasonSchema.safeParse(req.body));
    await rejectRecovery(claim, recoveryIdOf(req), input, actorId(req));
    return sendOk(res, await claimDetail(claim.id));
  },
);

export default router;
