import type { Prisma } from "../../../generated/prisma/index.js";
import { rupeesText } from "./claim.settle.compute.js";

/**
 * C7 — transporter / broker recoveries deducted on their vendor payment slip
 * (line sourceType CLAIM_RECOVERY). Called by vendor-payment.route:
 *
 *   slip approved → the slip's accrual posted Cr DAMAGE_RECOVERY for the
 *                   line; the recovery is RECEIVED
 *   slip cancelled after approval → accrual reversed; back to APPROVED, and
 *                   free for the next slip
 */

type Tx = Prisma.TransactionClient;

const slipRecoveryLines = (tx: Tx, slipId: string) =>
  tx.vendorPaymentSlipLine.findMany({
    where: { slipId, isActive: true, sourceType: "CLAIM_RECOVERY" },
    select: { sourceId: true, damagePaise: true },
  });

/** Call after the slip's accrual is posted. */
export async function receiveSlipRecoveries(
  tx: Tx,
  slip: { id: string; slipNumber: string },
  actorId: string,
) {
  const lines = await slipRecoveryLines(tx, slip.id);
  if (!lines.length) return;
  const recoveries = await tx.claimRecovery.findMany({
    where: { id: { in: lines.map((line) => line.sourceId) }, status: "APPROVED" },
    select: { id: true, lineNo: true, claimId: true },
  });
  if (!recoveries.length) return;
  const deducted = new Map(lines.map((line) => [line.sourceId, line.damagePaise]));
  await tx.claimRecovery.updateMany({
    where: { id: { in: recoveries.map((r) => r.id) } },
    data: { status: "RECEIVED", receivedAt: new Date(), version: { increment: 1 } },
  });
  await tx.claimEvent.createMany({
    data: recoveries.map((recovery) => {
      const paise = deducted.get(recovery.id) ?? 0n;
      return {
        claimId: recovery.claimId,
        eventType: "RECOVERY_STATUS_CHANGED",
        note:
          paise > 0n
            ? `Recovery R${recovery.lineNo} received — ${rupeesText(paise)} deducted on vendor payment slip ${slip.slipNumber}`
            : `Recovery R${recovery.lineNo} received — already deducted with the truck's LR acknowledgement damage on slip ${slip.slipNumber}`,
        actorId,
      };
    }),
  });
}

/** Call before the slip's lines are released, when an approved slip is cancelled. */
export async function releaseSlipRecoveries(
  tx: Tx,
  slip: { id: string; slipNumber: string },
  actorId: string,
) {
  const lines = await slipRecoveryLines(tx, slip.id);
  if (!lines.length) return;
  const recoveries = await tx.claimRecovery.findMany({
    where: { id: { in: lines.map((line) => line.sourceId) }, status: "RECEIVED" },
    select: { id: true, lineNo: true, claimId: true },
  });
  if (!recoveries.length) return;
  await tx.claimRecovery.updateMany({
    where: { id: { in: recoveries.map((r) => r.id) } },
    data: { status: "APPROVED", receivedAt: null, version: { increment: 1 } },
  });
  await tx.claimEvent.createMany({
    data: recoveries.map((recovery) => ({
      claimId: recovery.claimId,
      eventType: "RECOVERY_STATUS_CHANGED",
      note: `Vendor payment slip ${slip.slipNumber} cancelled — recovery R${recovery.lineNo} waits for the next slip`,
      actorId,
    })),
  });
}
