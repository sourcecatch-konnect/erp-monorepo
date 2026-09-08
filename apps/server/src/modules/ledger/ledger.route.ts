import { Router } from "express";
import { Prisma } from "../../../generated/prisma/index.js";

import {
  chartOfAccountsQuerySchema,
  createGLLedgerSchema,
  createManualJournalSchema,
  dayBookQuerySchema,
  ledgerQuerySchema,
  updateLedgerSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";
import { BadRequestError, NotFoundError, ValidationError } from "../../lib/error.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import {
  ledgerForAccount,
  ledgerForCreditor,
  ledgerForCustomer,
  ledgerForExpenseCategory,
} from "./ledger.service.js";
import { postJournal } from "./posting.service.js";

const router: Router = Router();
router.use(authMiddleware);
const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const parseRange = (query: unknown) => {
  const parsed = ledgerQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
};

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

// Bank / Cash ledger — same read, the account's own `type` says which report it is.
router.get("/cash-accounts/:id", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const view = await ledgerForAccount(id, parseRange(req.query));
  return sendOk(res, view);
});

// Debtor (Customer) ledger.
router.get("/customers/:id", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const view = await ledgerForCustomer(id, parseRange(req.query));
  return sendOk(res, view);
});

// Creditor ledger.
router.get("/creditors/:id", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const view = await ledgerForCreditor(id, parseRange(req.query));
  return sendOk(res, view);
});

// Expense ledger — flat, category-scoped, not tied to one party.
router.get("/expenses", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const view = await ledgerForExpenseCategory(parseRange(req.query));
  return sendOk(res, view);
});

/* ------------------------------------------------------------------ */
/* Chart of accounts — Phase 4                                        */
/* ------------------------------------------------------------------ */

router.get("/accounts", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const input = validate(chartOfAccountsQuerySchema.safeParse(req.query));
  const where: Prisma.LedgerWhereInput = {
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.group ? { group: input.group } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search
      ? {
        OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { code: { contains: input.search, mode: "insensitive" } },
        ],
      }
      : {}),
  };
  const ledgers = await db.ledger.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true, branchCode: true } },
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    take: 500,
  });
  return sendOk(res, ledgers);
});

// Manual GL ledger head — party ledgers are lazy-created by the posting
// service (getOrCreatePartyLedger) and cannot be created through this route.
router.post("/accounts", can(PERMS.LEDGER.MANAGE), async (req, res) => {
  const input = validate(createGLLedgerSchema.safeParse(req.body));
  if (input.branchId) assertBranchAccess(req, input.branchId);
  try {
    const ledger = await db.ledger.create({
      data: {
        kind: "GL",
        name: input.name,
        group: input.group,
        code: input.code ?? null,
        branchId: input.branchId ?? null,
      },
    });
    return sendOk(res, ledger, undefined, 201);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    )
      throw new BadRequestError(`A ledger with code "${input.code}" already exists`);
    throw err;
  }
});

router.patch("/accounts/:id", can(PERMS.LEDGER.MANAGE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(updateLedgerSchema.safeParse(req.body));
  const existing = await db.ledger.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Ledger not found");
  try {
    const ledger = await db.ledger.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.group !== undefined ? { group: input.group } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return sendOk(res, ledger);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    )
      throw new BadRequestError(`A ledger with code "${input.code}" already exists`);
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/* Manual journal — Phase 4                                           */
/* ------------------------------------------------------------------ */

router.post("/journal", can(PERMS.LEDGER.JOURNAL_CREATE), async (req, res) => {
  const input = validate(createManualJournalSchema.safeParse(req.body));
  assertBranchAccess(req, input.branchId);

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new NotFoundError("Branch not found");

  const ledgerIds = [...new Set(input.lines.map((l) => l.ledgerId))];
  const ledgers = await db.ledger.findMany({
    where: { id: { in: ledgerIds } },
    select: { id: true, isActive: true },
  });
  if (ledgers.length !== ledgerIds.length)
    throw new BadRequestError("One or more ledgers were not found");
  if (ledgers.some((l) => !l.isActive))
    throw new BadRequestError("One or more ledgers are inactive");

  const me = actorId(req);
  const fyCode = fyCodeFor(input.voucherDate);
  const seq = await nextSequence(db, branch.branchCode, fyCode, "JV");
  const voucherNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/JV");

  const voucher = await db.$transaction(
    (tx) =>
      postJournal(tx, {
        voucherType: "JOURNAL",
        voucherNumber,
        voucherDate: input.voucherDate,
        fyCode,
        branchId: input.branchId,
        narration: input.narration ?? null,
        sourceType: "MANUAL",
        sourceId: voucherNumber,
        createdById: me,
        lines: input.lines.map((line) => ({
          ledgerId: line.ledgerId,
          debitPaise: line.debitPaise,
          creditPaise: line.creditPaise,
          narration: line.narration ?? null,
        })),
      }),
    { timeout: 15000, maxWait: 10000 },
  );

  return sendOk(res, { id: voucher.id, voucherNumber: voucher.voucherNumber }, undefined, 201);
});

/* ------------------------------------------------------------------ */
/* Day book — Phase 4                                                 */
/* ------------------------------------------------------------------ */

router.get("/day-book", can(PERMS.LEDGER.VOUCHER_VIEW), async (req, res) => {
  const input = validate(dayBookQuerySchema.safeParse(req.query));
  if (input.branchId) assertBranchAccess(req, input.branchId);

  const fromDate = new Date(`${input.from}T00:00:00.000Z`);
  const toDate = new Date(`${input.to ?? input.from}T23:59:59.999Z`);

  const entries = await db.journalEntry.findMany({
    where: {
      voucherDate: { gte: fromDate, lte: toDate },
      ...(input.branchId
        ? { branchId: input.branchId }
        : branchFilter(req, "branchId")),
      ...(input.voucherType ? { voucherType: input.voucherType } : {}),
    },
    include: {
      branch: { select: { id: true, name: true, branchCode: true } },
      lines: { select: { debitPaise: true } },
    },
    orderBy: [{ voucherDate: "asc" }, { voucherNumber: "asc" }],
    take: 500,
  });

  const data = entries.map((entry) => ({
    id: entry.id,
    voucherType: entry.voucherType,
    voucherNumber: entry.voucherNumber,
    voucherDate: entry.voucherDate,
    status: entry.status,
    narration: entry.narration,
    sourceType: entry.sourceType,
    branch: entry.branch,
    totalPaise: entry.lines
      .reduce((sum, line) => sum + line.debitPaise, 0n)
      .toString(),
    lineCount: entry.lines.length,
  }));

  return sendOk(res, data);
});

/* ------------------------------------------------------------------ */
/* Generic voucher view — any JournalEntry, regardless of source.     */
/* Used by the Day Book (click a row) and the Manual Journal screen.  */
/* Bill/Receipt already have their own scoped .../voucher routes;     */
/* this one is for vouchers with no single owning record.             */
/* ------------------------------------------------------------------ */

router.get("/vouchers/:id", can(PERMS.LEDGER.VOUCHER_VIEW), async (req, res) => {
  const id = getParamId(req);
  const voucher = await db.journalEntry.findUnique({
    where: { id },
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
        include: { bill: { select: { id: true, billNumber: true } } },
      },
    },
  });
  if (!voucher) throw new NotFoundError("Voucher not found");
  assertBranchAccess(req, voucher.branchId);
  return sendOk(res, voucher);
});

export default router;
