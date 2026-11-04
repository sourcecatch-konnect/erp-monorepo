import {
  claimAssessmentSchema,
  claimReasonSchema,
  createClaimSchema,
  pendingClaimSettlementSchema,
  settleClaimSchema,
} from "@skerp/validators";
import type { ClaimEligibleLr, ClaimSettlementOptions } from "@skerp/types";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../lib/error.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import {
  claimGLLedger,
  postClaimSettlementPayment,
} from "../ledger/posting.service.js";
import {
  assertEnoughMoney,
  assertFundingMatchesMode,
  fundingAccounts,
} from "../driver-finance/driver-finance.service.js";
import { claimSettlementApprovalLimitPaise } from "./claim.config.js";
import { reserveClaimNumber } from "./claim.numbers.js";
import {
  SETTLEMENT_MODE_TEXT,
  claimItemsBlocker,
  needsSettlementApproval,
  rupeesText,
  settleBlocker,
  settlementLinkBlocker,
} from "./claim.settle.compute.js";

/**
 * C4 — claims raised by hand, assessment, settlement with the customer,
 * rejection and cancellation. Every action loads the claim once
 * (loadClaimForAction), the route checks its branch, then the action
 * re-checks status + version and writes one ClaimEvent per transition.
 */

type CreateClaimInput = ReturnType<typeof createClaimSchema.parse>;
type AssessmentInput = ReturnType<typeof claimAssessmentSchema.parse>;
type SettleInput = ReturnType<typeof settleClaimSchema.parse>;
type ReasonInput = ReturnType<typeof claimReasonSchema.parse>;
type PendingSettlement = ReturnType<typeof pendingClaimSettlementSchema.parse>;

const DELIVERED_STATUSES = ["DELIVERED", "ACKNOWLEDGED"] as const;

const PAYMENT_MODE_TEXT: Record<NonNullable<PendingSettlement["paymentMode"]>, string> = {
  CASH: "cash",
  BANK: "bank transfer",
  UPI: "UPI",
  CHEQUE: "cheque",
};

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
export const isStaleUpdate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export const STALE = "This claim was changed by someone else. Refresh and try again.";

/** Turns a lost optimistic-lock race (update where version) into a 409. */
export const withVersionGuard = async <T>(write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (isStaleUpdate(error)) throw new ConflictError(STALE);
    throw error;
  }
};

/* ------------------------------------------------------------------ */
/* Manual claim                                                        */
/* ------------------------------------------------------------------ */

/** Delivered LRs on the given branches, for the "New claim" picker. */
export const eligibleLrsForClaim = async (
  originBranchWhere: Prisma.LRGroupWhereInput,
  search: string | undefined,
): Promise<ClaimEligibleLr[]> => {
  const lrs = await db.lorryReceipt.findMany({
    where: {
      deletedAt: null,
      status: { in: [...DELIVERED_STATUSES] },
      group: { is: originBranchWhere },
      ...(search ? { lrNumber: { contains: search, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      lrNumber: true,
      status: true,
      group: {
        select: {
          groupNumber: true,
          consignor: { select: { id: true, name: true } },
          consignee: { select: { id: true, name: true } },
        },
      },
      goods: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, quantity: true, unit: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return lrs.map((lr) => ({
    id: lr.id,
    lrNumber: lr.lrNumber,
    groupNumber: lr.group.groupNumber,
    status: lr.status,
    consignor: lr.group.consignor,
    consignee: lr.group.consignee,
    goods: lr.goods,
  }));
};

/** The LR a manual claim is raised on; the route checks its origin branch. */
export const lrForManualClaim = async (lrId: string) => {
  const lr = await db.lorryReceipt.findFirst({
    where: { id: lrId, deletedAt: null },
    select: {
      id: true,
      lrNumber: true,
      status: true,
      goods: { select: { id: true, name: true, quantity: true } },
      group: {
        select: {
          originBranchId: true,
          consignorId: true,
          consigneeId: true,
          originBranch: { select: { branchCode: true } },
        },
      },
    },
  });
  if (!lr) throw new NotFoundError("Lorry receipt not found");
  return lr;
};

export const createManualClaim = async (
  input: CreateClaimInput,
  lr: Awaited<ReturnType<typeof lrForManualClaim>>,
  actorId: string,
) => {
  if (!(DELIVERED_STATUSES as readonly string[]).includes(lr.status))
    throw new BadRequestError("A claim can only be raised on a delivered LR");
  if (input.customerId !== lr.group.consignorId && input.customerId !== lr.group.consigneeId)
    throw new BadRequestError("The customer must be the LR's consignor or consignee");
  const itemsProblem = claimItemsBlocker(input.items, lr.goods);
  if (itemsProblem) throw new BadRequestError(itemsProblem);

  const goodsName = new Map(lr.goods.map((line) => [line.id, line.name]));
  const items = input.items
    .filter((item) => item.damagedQty > 0 || item.shortageQty > 0)
    .map((item) => ({
      lrGoodsId: item.lrGoodsId,
      goodsName: goodsName.get(item.lrGoodsId) ?? "",
      damagedQty: round4(item.damagedQty),
      shortageQty: round4(item.shortageQty),
    }));
  const damagedQty = round4(items.reduce((sum, item) => sum + item.damagedQty, 0));
  const shortageQty = round4(items.reduce((sum, item) => sum + item.shortageQty, 0));

  const { claimNumber, fyCode } = await reserveClaimNumber(
    db,
    lr.group.originBranch.branchCode,
    input.claimDate,
  );
  return db.claim.create({
    data: {
      claimNumber,
      fyCode,
      claimDate: input.claimDate,
      branchId: lr.group.originBranchId,
      lrId: lr.id,
      customerId: input.customerId,
      claimType: input.claimType,
      origin: "MANUAL",
      causedBy: input.causedBy ?? null,
      damagedQty,
      shortageQty,
      goodsValuePaise: input.goodsValue === undefined ? null : BigInt(input.goodsValue),
      claimedAmountPaise: BigInt(input.claimedAmount),
      basisDescription: input.basisDescription ?? null,
      createdById: actorId,
      items: { create: items },
      events: {
        create: {
          eventType: "CREATED",
          toStatus: "PENDING",
          note: `Raised by hand: damaged ${damagedQty}, short ${shortageQty}, claimed ${rupeesText(BigInt(input.claimedAmount))}`,
          actorId,
        },
      },
    },
    select: { id: true },
  });
};

/* ------------------------------------------------------------------ */
/* Load for an action                                                  */
/* ------------------------------------------------------------------ */

const actionClaimSelect = {
  id: true,
  claimNumber: true,
  branchId: true,
  lrId: true,
  status: true,
  version: true,
  customerId: true,
  goodsValuePaise: true,
  causedBy: true,
  claimedAmountPaise: true,
  settledAmountPaise: true,
  pendingSettlement: true,
  settlementRequestedById: true,
  customer: { select: { name: true } },
  lr: {
    select: {
      lrNumber: true,
      group: { select: { consignorId: true, consigneeId: true } },
    },
  },
  /** Recoveries still in play (C5); rejected ones don't count against the loss. */
  recoveries: {
    where: { status: { not: "REJECTED" } },
    select: { id: true, amountPaise: true },
  },
} satisfies Prisma.ClaimSelect;
export type ActionClaim = Prisma.ClaimGetPayload<{ select: typeof actionClaimSelect }>;

/** The route checks the returned claim's branch before any action. */
export const loadClaimForAction = async (id: string): Promise<ActionClaim> => {
  const claim = await db.claim.findFirst({
    where: { id, deletedAt: null },
    select: actionClaimSelect,
  });
  if (!claim) throw new NotFoundError("Claim not found");
  return claim;
};

export const assertVersion = (claim: ActionClaim, version: number) => {
  if (claim.version !== version) throw new ConflictError(STALE);
};

/** Filed + approved + received recoveries on the claim. */
export const committedRecoveriesPaise = (claim: ActionClaim) =>
  claim.recoveries.reduce((sum, recovery) => sum + recovery.amountPaise, 0n);

const hasPendingSettlement = (claim: ActionClaim) => claim.pendingSettlement !== null;

/* ------------------------------------------------------------------ */
/* Assessment                                                          */
/* ------------------------------------------------------------------ */

/**
 * Assess (activate = true): PENDING → ACTIVE. Edit (activate = false): an
 * ACTIVE claim with no settlement waiting for approval.
 */
export const saveAssessment = async (
  claim: ActionClaim,
  input: AssessmentInput,
  actorId: string,
  { activate }: { activate: boolean },
) => {
  assertVersion(claim, input.version);
  if (activate && claim.status !== "PENDING")
    throw new BadRequestError("Only a pending claim can be assessed");
  if (!activate && claim.status !== "ACTIVE")
    throw new BadRequestError("Only an active claim's assessment can be edited");
  if (hasPendingSettlement(claim))
    throw new BadRequestError("A settlement is waiting for approval — approve or decline it first");
  const { consignorId, consigneeId } = claim.lr.group;
  if (input.customerId !== consignorId && input.customerId !== consigneeId)
    throw new BadRequestError("The customer must be the LR's consignor or consignee");

  const summary = `goods value ${rupeesText(BigInt(input.goodsValue))}, claimed ${rupeesText(BigInt(input.claimedAmount))}, caused by ${input.causedBy.toLowerCase().replace("_", " ")}`;
  await withVersionGuard(() =>
    db.claim.update({
      where: { id: claim.id, version: claim.version },
      data: {
        customerId: input.customerId,
        claimType: input.claimType,
        causedBy: input.causedBy,
        goodsValuePaise: BigInt(input.goodsValue),
        claimedAmountPaise: BigInt(input.claimedAmount),
        basisDescription: input.basisDescription ?? null,
        ...(activate ? { status: "ACTIVE" } : {}),
        updatedById: actorId,
        version: { increment: 1 },
        events: {
          create: activate
            ? {
              eventType: "STATUS_CHANGED",
              fromStatus: "PENDING",
              toStatus: "ACTIVE",
              note: `Assessed: ${summary}`,
              actorId,
            }
            : { eventType: "UPDATED", note: `Assessment edited: ${summary}`, actorId },
        },
      },
      select: { id: true },
    }),
  );
};

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

/** What the settlement is linked to, checked; `text` goes into the timeline. */
type SettlementLink = { text: string };

const checkSettlementLink = async (
  claim: ActionClaim,
  settlement: PendingSettlement,
): Promise<SettlementLink> => {
  const amountPaise = BigInt(settlement.settledAmountPaise);
  const refuse = (problem: string | null) => {
    if (problem) throw new BadRequestError(problem);
  };

  if (settlement.mode === "RECEIPT_DEDUCTION") {
    const allocation = await db.receiptAllocation.findUnique({
      where: { id: settlement.receiptAllocationId! },
      select: {
        damageAmountPaise: true,
        receipt: { select: { receiptNumber: true, status: true, customerId: true } },
        bill: { select: { billNumber: true } },
        claim: { select: { id: true, claimNumber: true } },
      },
    });
    if (!allocation) throw new NotFoundError("Receipt deduction not found");
    if (allocation.receipt.status !== "POSTED")
      throw new BadRequestError("The receipt must be posted before it can settle a claim");
    refuse(
      settlementLinkBlocker({
        kind: "receipt deduction",
        availablePaise: allocation.damageAmountPaise,
        amountPaise,
        sameCustomer: allocation.receipt.customerId === claim.customerId,
        linkedClaimNumber:
          allocation.claim && allocation.claim.id !== claim.id ? allocation.claim.claimNumber : null,
      }),
    );
    return {
      text: `deducted by the customer on receipt ${allocation.receipt.receiptNumber ?? "(no number)"} against bill ${allocation.bill.billNumber ?? "(draft)"}`,
    };
  }

  if (settlement.mode === "CREDIT_NOTE") {
    const note = await db.billCreditNote.findUnique({
      where: { id: settlement.creditNoteId! },
      select: {
        noteNumber: true,
        noteType: true,
        customerId: true,
        amountPaise: true,
        bill: { select: { billNumber: true } },
        claim: { select: { id: true, claimNumber: true } },
      },
    });
    if (!note || note.noteType !== "CREDIT_NOTE") throw new NotFoundError("Credit note not found");
    refuse(
      settlementLinkBlocker({
        kind: "credit note",
        availablePaise: note.amountPaise,
        amountPaise,
        sameCustomer: note.customerId === claim.customerId,
        linkedClaimNumber: note.claim && note.claim.id !== claim.id ? note.claim.claimNumber : null,
      }),
    );
    return { text: `credit note ${note.noteNumber} on bill ${note.bill.billNumber ?? "(draft)"}` };
  }

  const accountName = await assertFundingMatchesMode(
    db,
    settlement.fundingLedgerId!,
    settlement.paymentMode!,
  );
  return { text: `paid from ${accountName} by ${PAYMENT_MODE_TEXT[settlement.paymentMode!]}` };
};

/**
 * Mark the claim SETTLED. A separate payment also posts its voucher
 * (Dr DAMAGE_DEDUCTION / Cr Cash-Bank) in the same transaction; a receipt
 * deduction or credit note already posted its own when it was made.
 */
const applySettlement = async (
  claim: ActionClaim,
  settlement: PendingSettlement,
  link: SettlementLink,
  people: { settledById: string; approvedById: string | null },
  actorId: string,
) => {
  const amountPaise = BigInt(settlement.settledAmountPaise);
  const paid = settlement.mode === "PAID_SEPARATELY";
  // Reads before the transaction (CLAUDE.md "Database transactions").
  const damageLedger = paid ? await claimGLLedger(db, "settlement") : null;
  const narration = `Damage claim ${claim.claimNumber} settled with ${claim.customer.name} — LR ${claim.lr.lrNumber}`;
  const note = `Settled ${rupeesText(amountPaise)}, ${link.text}${settlement.note ? ` — ${settlement.note}` : ""}`;

  try {
    await db.$transaction(
      async (tx) => {
        let journalEntryId: string | null = null;
        if (paid && damageLedger) {
          await assertEnoughMoney(tx, settlement.fundingLedgerId!, amountPaise);
          const journal = await postClaimSettlementPayment(tx, {
            sourceId: claim.id,
            voucherNumber: claim.claimNumber,
            voucherDate: settlement.settledAt,
            fyCode: fyCodeFor(settlement.settledAt),
            branchId: claim.branchId,
            fundingLedgerId: settlement.fundingLedgerId!,
            glLedgerId: damageLedger.id,
            amountPaise,
            narration,
            createdById: actorId,
          });
          journalEntryId = journal.id;
        }

        await tx.claim.update({
          where: { id: claim.id, version: claim.version },
          data: {
            status: "SETTLED",
            settledAmountPaise: amountPaise,
            settledAt: settlement.settledAt,
            settlementMode: settlement.mode,
            receiptAllocationId:
              settlement.mode === "RECEIPT_DEDUCTION" ? settlement.receiptAllocationId : null,
            creditNoteId: settlement.mode === "CREDIT_NOTE" ? settlement.creditNoteId : null,
            settlementPaymentMode: paid ? settlement.paymentMode : null,
            settlementFundingLedgerId: paid ? settlement.fundingLedgerId : null,
            settlementReferenceNo: settlement.referenceNo ?? null,
            settlementNote: settlement.note ?? null,
            settlementJournalEntryId: journalEntryId,
            settledById: people.settledById,
            settlementApprovedById: people.approvedById,
            pendingSettlement: Prisma.DbNull,
            updatedById: actorId,
            version: { increment: 1 },
            events: {
              create: {
                eventType: "STATUS_CHANGED",
                fromStatus: "ACTIVE",
                toStatus: "SETTLED",
                note,
                actorId,
              },
            },
          },
          select: { id: true },
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );
  } catch (error) {
    if (isUniqueViolation(error))
      throw new BadRequestError(
        "That receipt deduction or credit note was just used to settle another claim",
      );
    if (isStaleUpdate(error)) throw new ConflictError(STALE);
    throw error;
  }
};

/**
 * Settle with the customer. Up to the approval limit it's settled now;
 * above it the settlement waits on the claim for a second user.
 */
export const requestSettlement = async (
  claim: ActionClaim,
  input: SettleInput,
  actorId: string,
): Promise<{ awaitingApproval: boolean }> => {
  assertVersion(claim, input.version);
  if (hasPendingSettlement(claim))
    throw new BadRequestError("A settlement is already waiting for approval");
  const amountPaise = BigInt(input.settledAmount);
  const blocker = settleBlocker(claim, amountPaise, committedRecoveriesPaise(claim));
  if (blocker) throw new BadRequestError(blocker);

  const settlement: PendingSettlement = {
    settledAmountPaise: input.settledAmount,
    settledAt: input.settledAt,
    mode: input.mode,
    receiptAllocationId: input.receiptAllocationId,
    creditNoteId: input.creditNoteId,
    paymentMode: input.paymentMode,
    fundingLedgerId: input.fundingLedgerId,
    referenceNo: input.referenceNo,
    note: input.note,
  };
  const link = await checkSettlementLink(claim, settlement);

  const limitPaise = claimSettlementApprovalLimitPaise();
  if (!needsSettlementApproval(amountPaise, limitPaise)) {
    await applySettlement(claim, settlement, link, { settledById: actorId, approvedById: null }, actorId);
    return { awaitingApproval: false };
  }

  await withVersionGuard(() =>
    db.claim.update({
      where: { id: claim.id, version: claim.version },
      data: {
        pendingSettlement: { ...settlement, settledAt: settlement.settledAt.toISOString() },
        settlementRequestedById: actorId,
        settlementRequestedAt: new Date(),
        updatedById: actorId,
        version: { increment: 1 },
        events: {
          create: {
            eventType: "SETTLEMENT_REQUESTED",
            note: `Settlement of ${rupeesText(amountPaise)} (${SETTLEMENT_MODE_TEXT[settlement.mode]}: ${link.text}) sent for approval — above the ${rupeesText(limitPaise)} limit`,
            actorId,
          },
        },
      },
      select: { id: true },
    }),
  );
  return { awaitingApproval: true };
};

const pendingOf = (claim: ActionClaim): PendingSettlement => {
  const parsed = pendingClaimSettlementSchema.safeParse(claim.pendingSettlement);
  if (!parsed.success) throw new BadRequestError("No settlement is waiting for approval");
  return parsed.data;
};

/** A second user with claim.approve approves a settlement above the limit. */
export const approveSettlement = async (claim: ActionClaim, version: number, approverId: string) => {
  assertVersion(claim, version);
  const settlement = pendingOf(claim);
  if (claim.settlementRequestedById === approverId)
    throw new ForbiddenError(
      "You asked for this settlement — another user with approval rights must approve it",
    );
  const blocker = settleBlocker(
    claim,
    BigInt(settlement.settledAmountPaise),
    committedRecoveriesPaise(claim),
  );
  if (blocker) throw new BadRequestError(blocker);
  // The receipt deduction / credit note may have been used since the request.
  const link = await checkSettlementLink(claim, settlement);
  await applySettlement(
    claim,
    settlement,
    link,
    { settledById: claim.settlementRequestedById ?? approverId, approvedById: approverId },
    approverId,
  );
};

/** Decline (or withdraw) a settlement waiting for approval; the claim stays active. */
export const declineSettlement = async (claim: ActionClaim, input: ReasonInput, actorId: string) => {
  assertVersion(claim, input.version);
  const settlement = pendingOf(claim);
  await withVersionGuard(() =>
    db.claim.update({
      where: { id: claim.id, version: claim.version },
      data: {
        pendingSettlement: Prisma.DbNull,
        settlementRequestedById: null,
        settlementRequestedAt: null,
        updatedById: actorId,
        version: { increment: 1 },
        events: {
          create: {
            eventType: "SETTLEMENT_DECLINED",
            note: `Settlement of ${rupeesText(BigInt(settlement.settledAmountPaise))} declined: ${input.reason}`,
            actorId,
          },
        },
      },
      select: { id: true },
    }),
  );
};

/** Receipt deductions, credit notes and cash / bank accounts a settlement can use. */
export const settlementOptions = async (claim: ActionClaim): Promise<ClaimSettlementOptions> => {
  const onThisLr = { where: { lrId: claim.lrId }, select: { lrId: true } } as const;
  const [allocations, notes, accounts] = await Promise.all([
    db.receiptAllocation.findMany({
      where: {
        damageAmountPaise: { gt: 0 },
        claim: { is: null },
        receipt: { is: { customerId: claim.customerId, status: "POSTED" } },
      },
      select: {
        id: true,
        damageAmountPaise: true,
        receipt: { select: { receiptNumber: true, receivedAt: true } },
        bill: { select: { billNumber: true, lrLinks: onThisLr } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.billCreditNote.findMany({
      where: { customerId: claim.customerId, noteType: "CREDIT_NOTE", claim: { is: null } },
      select: {
        id: true,
        noteNumber: true,
        createdAt: true,
        amountPaise: true,
        reason: true,
        bill: { select: { billNumber: true, lrLinks: onThisLr } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    fundingAccounts(),
  ]);

  const thisLrFirst = <T extends { onThisLr: boolean }>(rows: T[]) =>
    [...rows].sort((a, b) => Number(b.onThisLr) - Number(a.onThisLr));

  return {
    approvalLimitPaise: Number(claimSettlementApprovalLimitPaise()),
    receiptAllocations: thisLrFirst(
      allocations.map((row) => ({
        id: row.id,
        receiptNumber: row.receipt.receiptNumber,
        receivedAt: row.receipt.receivedAt.toISOString(),
        billNumber: row.bill.billNumber,
        damageAmountPaise: Number(row.damageAmountPaise),
        onThisLr: row.bill.lrLinks.length > 0,
      })),
    ),
    creditNotes: thisLrFirst(
      notes.map((row) => ({
        id: row.id,
        noteNumber: row.noteNumber,
        createdAt: row.createdAt.toISOString(),
        billNumber: row.bill.billNumber,
        amountPaise: Number(row.amountPaise),
        reason: row.reason,
        onThisLr: row.bill.lrLinks.length > 0,
      })),
    ),
    fundingAccounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      group: account.group,
      balancePaise: Number(account.balancePaise),
    })),
  };
};

/* ------------------------------------------------------------------ */
/* Reject / cancel                                                     */
/* ------------------------------------------------------------------ */

/**
 * Reject (we don't accept the customer's claim) or cancel (raised by
 * mistake). Only before settlement, and not while one waits for approval.
 * A cancel by a person is never undone by the C2 auto-sync.
 */
export const closeClaim = async (
  claim: ActionClaim,
  input: ReasonInput,
  actorId: string,
  outcome: "REJECTED" | "CANCELLED",
) => {
  assertVersion(claim, input.version);
  if (claim.status !== "PENDING" && claim.status !== "ACTIVE")
    throw new BadRequestError(
      outcome === "REJECTED"
        ? "Only a pending or active claim can be rejected"
        : "Only a pending or active claim can be cancelled",
    );
  if (hasPendingSettlement(claim))
    throw new BadRequestError("A settlement is waiting for approval — approve or decline it first");
  if (claim.recoveries.length > 0)
    throw new BadRequestError("Reject this claim's recovery lines first");

  await withVersionGuard(() =>
    db.claim.update({
      where: { id: claim.id, version: claim.version },
      data: {
        status: outcome,
        ...(outcome === "REJECTED"
          ? { rejectedReason: input.reason }
          : { cancelReason: input.reason }),
        updatedById: actorId,
        version: { increment: 1 },
        events: {
          create: {
            eventType: "STATUS_CHANGED",
            fromStatus: claim.status,
            toStatus: outcome,
            note: input.reason,
            actorId,
          },
        },
      },
      select: { id: true },
    }),
  );
};
