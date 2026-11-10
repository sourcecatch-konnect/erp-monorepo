import { pendingClaimSettlementSchema } from "@skerp/validators";
import type { ClaimDetail, ClaimPerson } from "@skerp/types";
import type { ClaimOrigin, Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { NotFoundError } from "../../lib/error.js";
import { claimMoneyTotals } from "./claim.compute.js";

/** GET /claims/:id, and the response of every claim action. */

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
      group: {
        select: {
          groupNumber: true,
          consignor: named,
          consignee: named,
          // Who hauled it: an own-fleet LR has no transporter to recover from.
          isMarketVehicle: true,
          marketTransport: named,
        },
      },
    },
  },
  items: { orderBy: { createdAt: "asc" } },
  recoveries: {
    orderBy: { createdAt: "asc" },
    include: {
      transport: named,
      driver: named,
      labour: named,
      receivedIntoLedger: { select: { name: true } },
      journalEntry: { select: { id: true, voucherNumber: true } },
      driverSalary: {
        select: { isActive: true, run: { select: { id: true, runNumber: true, status: true } } },
      },
    },
  },
  events: { orderBy: { createdAt: "asc" }, include: { actor: namedUser } },
  createdBy: namedUser,
  receiptAllocation: {
    select: {
      id: true,
      damageAmountPaise: true,
      receipt: { select: { id: true, receiptNumber: true } },
      bill: { select: { billNumber: true } },
    },
  },
  creditNote: {
    select: {
      id: true,
      noteNumber: true,
      billId: true,
      amountPaise: true,
      bill: { select: { billNumber: true } },
    },
  },
  settlementFundingLedger: { select: { name: true } },
  settlementJournalEntry: { select: { id: true, voucherNumber: true } },
  settledBy: namedUser,
  settlementApprovedBy: namedUser,
  settlementRequestedBy: namedUser,
} satisfies Prisma.ClaimInclude;

export const personName = (user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
}): ClaimPerson => ({
  id: user.id,
  name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "—",
});

const personOrNull = (user: Parameters<typeof personName>[0] | null) =>
  user ? personName(user) : null;

/** GRN number for the source link; the other sources link by id alone. */
const sourceNumberOf = async (origin: ClaimOrigin, originRefId: string | null) => {
  if (origin !== "GRN" || !originRefId) return null;
  const grn = await db.gRN.findUnique({
    where: { id: originRefId },
    select: { grnNumber: true },
  });
  return grn?.grnNumber ?? null;
};

const paise = (value: bigint | null) => (value === null ? null : Number(value));

/** Branch access is the caller's check (it needs the branch id first). */
export const claimDetail = async (id: string): Promise<ClaimDetail> => {
  const claim = await db.claim.findFirst({
    where: { id, deletedAt: null },
    include: claimDetailInclude,
  });
  if (!claim) throw new NotFoundError("Claim not found");

  const totals = claimMoneyTotals(claim);
  const pending = pendingClaimSettlementSchema.safeParse(claim.pendingSettlement);
  // C7: which vendor payment slip each transporter recovery sits on.
  const slipLines = await db.vendorPaymentSlipLine.findMany({
    where: {
      sourceType: "CLAIM_RECOVERY",
      isActive: true,
      sourceId: { in: claim.recoveries.map((recovery) => recovery.id) },
    },
    select: { sourceId: true, slip: { select: { id: true, slipNumber: true, status: true } } },
  });
  const slipOf = new Map(slipLines.map((line) => [line.sourceId, line.slip]));

  return {
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
    goodsValuePaise: paise(claim.goodsValuePaise),
    claimedAmountPaise: Number(claim.claimedAmountPaise),
    settledAmountPaise: paise(claim.settledAmountPaise),
    recoveredAmountPaise: Number(totals.recoveredAmountPaise),
    netLossPaise: paise(totals.netLossPaise),
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
      /** Who hauled it. A transporter recovery is only possible on a
       *  market vehicle, and only from the broker that carried it. */
      isMarketVehicle: claim.lr.group.isMarketVehicle,
      marketTransport: claim.lr.group.marketTransport,
    },
    items: claim.items.map((item) => ({
      id: item.id,
      lrGoodsId: item.lrGoodsId,
      goodsName: item.goodsName,
      damagedQty: item.damagedQty.toNumber(),
      shortageQty: item.shortageQty.toNumber(),
      valuePaise: paise(item.valuePaise),
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
      lineNo: recovery.lineNo,
      rejectedReason: recovery.rejectedReason,
      receivedAt: recovery.receivedAt?.toISOString() ?? null,
      receiptMode: recovery.receiptMode,
      receivedIntoName: recovery.receivedIntoLedger?.name ?? null,
      voucher: recovery.journalEntry,
      salaryRun: recovery.driverSalary?.isActive ? recovery.driverSalary.run : null,
      vendorSlip: slipOf.get(recovery.id) ?? null,
    })),
    events: claim.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      actor: personOrNull(event.actor),
    })),
    settlement: claim.settlementMode
      ? {
        mode: claim.settlementMode,
        receipt: claim.receiptAllocation
          ? {
            id: claim.receiptAllocation.receipt.id,
            receiptNumber: claim.receiptAllocation.receipt.receiptNumber,
            billNumber: claim.receiptAllocation.bill.billNumber,
            damageAmountPaise: Number(claim.receiptAllocation.damageAmountPaise),
          }
          : null,
        creditNote: claim.creditNote
          ? {
            id: claim.creditNote.id,
            noteNumber: claim.creditNote.noteNumber,
            billId: claim.creditNote.billId,
            billNumber: claim.creditNote.bill.billNumber,
            amountPaise: Number(claim.creditNote.amountPaise),
          }
          : null,
        paymentMode: claim.settlementPaymentMode,
        fundingAccountName: claim.settlementFundingLedger?.name ?? null,
        referenceNo: claim.settlementReferenceNo,
        note: claim.settlementNote,
        voucher: claim.settlementJournalEntry,
        settledBy: personOrNull(claim.settledBy),
        approvedBy: personOrNull(claim.settlementApprovedBy),
      }
      : null,
    pendingSettlement: pending.success
      ? {
        amountPaise: pending.data.settledAmountPaise,
        settledAt: pending.data.settledAt.toISOString(),
        mode: pending.data.mode,
        note: pending.data.note ?? null,
        requestedBy: personOrNull(claim.settlementRequestedBy),
        requestedAt: claim.settlementRequestedAt?.toISOString() ?? null,
      }
      : null,
    createdBy: personName(claim.createdBy),
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
};
