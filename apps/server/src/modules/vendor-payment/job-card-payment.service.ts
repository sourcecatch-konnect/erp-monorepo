import type { Prisma } from "../../../generated/prisma/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import {
  fyCodeFor,
  formatDocNumber,
  nextSequence,
} from "../_shared/doc-number.js";
import { reserveServiceBillPaymentTx } from "../service-bill/service-bill.service.js";

type Tx = Prisma.TransactionClient;

/** One bill reserves one active slip; retried creation returns that slip. */
export async function createJobCardPaymentSlipTx(
  tx: Tx,
  billId: string,
  branchId: string,
  actorId: string,
) {
  const bill = await tx.serviceBill.findUnique({
    where: { id: billId },
    include: { branch: true },
  });
  if (!bill || bill.branchId !== branchId)
    throw new NotFoundError("Service bill not found");
  // Use the bill row to serialize reservation against cancellation/payment.
  const claimed = await tx.serviceBill.updateMany({
    where: { id: billId, status: "POSTED", version: bill.version },
    data: { version: { increment: 1 } },
  });
  if (claimed.count !== 1)
    throw new ConflictError("Bill changed. Refresh before preparing payment.");
  const active = await tx.vendorPaymentSlipLine.findFirst({
    where: { sourceType: "SERVICE_BILL", sourceId: billId, isActive: true },
    select: { slipId: true },
  });
  if (active) return { id: active.slipId };
  const pending = bill.netAmountPaise - bill.paidAmountPaise;
  if (pending <= 0n) throw new BadRequestError("This bill is already settled");
  const fyCode = fyCodeFor(new Date());
  const seq = await nextSequence(tx, bill.branch.branchCode, fyCode, "VPAY");
  return tx.vendorPaymentSlip.create({
    data: {
      type: "JOBCARD",
      branchId,
      serviceBillId: billId,
      fyCode,
      slipNumber: formatDocNumber(
        bill.branch.branchCode,
        fyCode,
        seq,
        "SKT/VPAY",
        4,
      ),
      grossPayablePaise: pending,
      netPayablePaise: pending,
      status: "DRAFT",
      createdById: actorId,
      lines: {
        create: {
          sourceType: "SERVICE_BILL",
          sourceId: billId,
          freightPaise: pending,
          netPaise: pending,
        },
      },
    },
    select: { id: true },
  });
}

/** Used before approval and inside settlement; amounts come from stored bills. */
export async function assertJobCardSlipBalance(
  tx: Tx,
  slip: {
    serviceBillId: string | null;
    netPayablePaise: bigint;
    paidPaise: bigint;
  },
) {
  if (!slip.serviceBillId)
    throw new BadRequestError("Job card payment slip has no service bill");
  const bill = await tx.serviceBill.findUnique({
    where: { id: slip.serviceBillId },
  });
  if (
    !bill ||
    bill.status !== "POSTED" ||
    bill.netAmountPaise - bill.paidAmountPaise !==
      slip.netPayablePaise - slip.paidPaise
  )
    throw new ConflictError(
      "Service bill balance changed. Reconcile the payment slip before continuing.",
    );
  return bill;
}

export async function settleJobCardBillTx(
  tx: Tx,
  slip: {
    serviceBillId: string | null;
    netPayablePaise: bigint;
    paidPaise: bigint;
  },
  cash: bigint,
  tds: bigint,
) {
  const bill = await assertJobCardSlipBalance(tx, slip);
  await reserveServiceBillPaymentTx(tx, bill.id, cash + tds);
  return bill;
}
