import type {
  ApproveDeliveryChallanInput,
  UpsertDeliveryChallanAckInput,
} from "@skerp/validators";

import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/error.js";
import { assertNotOnVendorSlip } from "../vendor-payment/source-lock.js";
import {
  approvalDefaultsFrom,
  shortageQtyOf,
  totalDamageQty,
  totalShortageQty,
  type AckLite,
} from "./ack.compare.js";

/**
 * DC Acknowledgement + Approval — the database layer.
 *
 * The comparison maths is pure and lives in `ack.compare.ts`; this file loads
 * rows and enforces the rules around them. Nothing here posts to the ledger:
 * an approval produces amounts, and the vendor-payment slip stays the single
 * accrual point (decision Q9).
 */

const ackSelect = {
  id: true,
  reportingDate: true,
  unloadingDate: true,
  collectionDate: true,
  claimedDetentionDays: true,
  claimedDetentionPaise: true,
  parkingPaise: true,
  otherPaise: true,
  labourPaise: true,
  damagePaise: true,
  remarks: true,
  podAttachmentId: true,
  filedById: true,
  filedAt: true,
  version: true,
  filedBy: { select: { id: true, firstName: true, lastName: true } },
  items: {
    orderBy: { lrNumberSnapshot: "asc" },
    select: {
      id: true,
      challanItemId: true,
      lrNumberSnapshot: true,
      totalQty: true,
      receivedQty: true,
      damageQty: true,
    },
  },
} satisfies Prisma.DeliveryChallanAcknowledgementSelect;

type LoadedAck = Prisma.DeliveryChallanAcknowledgementGetPayload<{
  select: typeof ackSelect;
}>;

const toLite = (ack: LoadedAck): AckLite => ({
  reportingDate: ack.reportingDate,
  unloadingDate: ack.unloadingDate,
  collectionDate: ack.collectionDate,
  claimedDetentionDays: ack.claimedDetentionDays,
  claimedDetentionPaise: ack.claimedDetentionPaise,
  parkingPaise: ack.parkingPaise,
  otherPaise: ack.otherPaise,
  labourPaise: ack.labourPaise,
  damagePaise: ack.damagePaise,
  items: ack.items,
});

/** Challan fields every handler here needs, plus its acks and ruling. */
type Tx = Prisma.TransactionClient;
type DbClient = typeof db | Tx;

/**
 * Serialise everything that reads-then-writes a challan's acknowledgements
 * or its ruling.
 *
 * Without this, each handler checked "is it approved / is it on a slip"
 * before opening its transaction, leaving a window in which another request
 * could approve the challan or claim it onto a payment slip — and the
 * amendment would land anyway. Same key as the LDC payment path takes in
 * `reconcileLDCLines`, so an ack amendment and a slip claiming that challan
 * cannot interleave.
 */
export const lockChallan = async (tx: Tx, challanId: string) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`delivery-challan:${challanId}`}))`;
};

const loadChallanOrThrow = async (
  challanId: string,
  client: DbClient = db,
) => {
  const challan = await client.deliveryChallan.findUnique({
    where: { id: challanId },
    select: {
      id: true,
      challanNumber: true,
      status: true,
      sourceBranchId: true,
      /// SK's own side of the delivery: the Labour supervisor who ran the
      /// unloading. Held on the challan, never acknowledged — he has no login.
      supervisor: { select: { id: true, name: true } },
      items: {
        select: { id: true, lrNumberSnapshot: true, quantity: true },
        orderBy: { lrNumberSnapshot: "asc" },
      },
      acknowledgements: { select: ackSelect },
      approval: {
        select: {
          id: true,
          acceptedAckId: true,
          approvedDetentionDays: true,
          approvedParkingPaise: true,
          approvedOtherPaise: true,
          approvedLabourPaise: true,
          approvedDamagePaise: true,
          approvedShortagePaise: true,
          remarks: true,
          approvedAt: true,
          version: true,
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!challan) throw new NotFoundError("Delivery Challan not found");
  return challan;
};

type LoadedChallan = Awaited<ReturnType<typeof loadChallanOrThrow>>;

const pick = (challan: LoadedChallan) => challan.acknowledgements[0] ?? null;

/**
 * The broker's acknowledgement, with the quantities it implies.
 *
 * What the broker claims is "often inflated" (CONTEXT.md §5.2). The control
 * is no longer a second account to compare against — the supervisor is a
 * Labour record, not a user — but the slab ceiling applied on the payment
 * slip, which pays `min(claimed, slab)`.
 */
export const getChallanAckView = async (challanId: string) => {
  const challan = await loadChallanOrThrow(challanId);
  const broker = pick(challan);

  const withDerived = (ack: LoadedAck | null) =>
    ack
      ? {
          ...ack,
          items: ack.items.map((item) => ({
            ...item,
            shortageQty: shortageQtyOf(item),
          })),
          totalShortageQty: totalShortageQty(toLite(ack)),
          totalDamageQty: totalDamageQty(toLite(ack)),
        }
      : null;

  return {
    challanId: challan.id,
    challanNumber: challan.challanNumber,
    status: challan.status,
    /** The challan's own lines, so a form can be laid out before either ack
     *  exists and so quantities can be prefilled from what was sent. */
    lines: challan.items,
    broker: withDerived(broker),
    /** The Labour supervisor who ran the unloading — SK's own side of the
     *  delivery, which is held on the challan rather than acknowledged. */
    supervisor: challan.supervisor,
    filed: Boolean(broker),
    approval: challan.approval,
  };
};

/**
 * File or amend one party's acknowledgement.
 *
 * Idempotent per challan — the DB unique makes a second filing an amendment
 * of the first, not a duplicate row.
 *
 * Two things are refused:
 *  - amending once the challan is on a payment slip, for the same reason the
 *    report date is frozen there: the slip's figures were computed from what
 *    this ack said;
 *  - amending after an approval exists, because the approver ruled on the
 *    text as it was. Revoke the approval first.
 */
export const upsertChallanAck = async (
  challanId: string,
  input: UpsertDeliveryChallanAckInput,
  actorId: string,
) => {
  return db.$transaction(async (tx) => {
  // Lock first, then read: every check below has to be made against state
  // that cannot change before the write at the end of this transaction.
  await lockChallan(tx, challanId);

  const challan = await loadChallanOrThrow(challanId, tx);
  if (challan.status !== "ISSUED")
    throw new BadRequestError(
      "Only an issued delivery challan can be acknowledged",
    );

  const existing = pick(challan);
  if (existing && input.version !== undefined && existing.version !== input.version)
    throw new ConflictError(
      "This acknowledgement changed in another session. Refresh and try again.",
    );

  if (challan.approval)
    throw new BadRequestError(
      "This challan has already been approved — revoke the approval before changing an acknowledgement",
    );

  await assertNotOnVendorSlip(
    tx,
    "DELIVERY_CHALLAN",
    [challan.id],
    "change an acknowledgement on this delivery challan",
  );

  // Every item must belong to this challan. Without this an ack could carry
  // quantities for someone else's consignment.
  const validItemIds = new Set(challan.items.map((item) => item.id));
  const foreign = input.items.filter(
    (item) => !validItemIds.has(item.challanItemId),
  );
  if (foreign.length)
    throw new BadRequestError(
      `${foreign.length} line(s) are not on this delivery challan`,
    );

  const lrByItemId = new Map(
    challan.items.map((item) => [item.id, item.lrNumberSnapshot]),
  );

  const data = {
    reportingDate: input.reportingDate ?? null,
    unloadingDate: input.unloadingDate ?? null,
    collectionDate: input.collectionDate ?? null,
    claimedDetentionDays: input.claimedDetentionDays ?? null,
    claimedDetentionPaise: input.claimedDetentionPaise ?? null,
    parkingPaise: input.parkingPaise ?? null,
    otherPaise: input.otherPaise ?? null,
    labourPaise: input.labourPaise ?? null,
    damagePaise: input.damagePaise ?? null,
    remarks: input.remarks ?? null,
    podAttachmentId: input.podAttachmentId ?? null,
  };

  const itemRows = input.items.map((item) => ({
    challanItemId: item.challanItemId,
    lrNumberSnapshot: lrByItemId.get(item.challanItemId)!,
    totalQty: item.totalQty,
    receivedQty: item.receivedQty,
    damageQty: item.damageQty,
  }));

  // The advisory lock above means `existing.version` cannot have moved, so
  // this update can no longer fail on the version predicate and surface as a
  // raw P2025 — the friendly ConflictError above is now the only way a
  // concurrent edit is reported.
  const ack = existing
    ? await tx.deliveryChallanAcknowledgement.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
        select: { id: true },
      })
    : await tx.deliveryChallanAcknowledgement.create({
        data: {
          challanId: challan.id,
          filedById: actorId,
          ...data,
        },
        select: { id: true },
      });

  // Replace the item set wholesale: a line dropped from the form means the
  // party is no longer accounting for it, and a stale row would quietly
  // keep counting toward shortage.
  await tx.deliveryChallanAckItem.deleteMany({ where: { ackId: ack.id } });
  if (itemRows.length)
    await tx.deliveryChallanAckItem.createMany({
      data: itemRows.map((row) => ({ ...row, ackId: ack.id })),
    });

  return ack.id;
  });
};

/**
 * Rule on a challan: accept one acknowledgement and record the figures.
 *
 * Requires that the broker has actually filed.
 *
 * Posts nothing (Q9).
 */
export const approveChallan = async (
  challanId: string,
  input: ApproveDeliveryChallanInput,
  actorId: string,
) => {
  return db.$transaction(async (tx) => {
  await lockChallan(tx, challanId);

  const challan = await loadChallanOrThrow(challanId, tx);
  if (challan.status !== "ISSUED")
    throw new BadRequestError("Only an issued delivery challan can be approved");
  if (challan.approval)
    throw new BadRequestError(
      "This challan is already approved — revoke the existing approval first",
    );

  const accepted = pick(challan);
  if (!accepted)
    throw new BadRequestError(
      "No broker acknowledgement has been filed for this challan",
    );

  // Maker-checker, matching the payment slip's rule: whoever filed the
  // account cannot be the one who rules it trustworthy. Fail-closed — the
  // comparison is the fraud control, and it is worth nothing if the filer
  // signs off on their own figures.
  if (accepted.filedById === actorId)
    throw new BadRequestError(
      "You filed this acknowledgement, so you cannot approve it. Another user with approval rights must rule on it.",
    );

  const defaults = approvalDefaultsFrom(toLite(accepted));

  // An omitted figure means "take what the accepted ack said". An explicitly
  // sent one — including zero — is the approver overriding it, and that
  // distinction has to survive, exactly as it does for the broker's
  // detention claim on a payment slip.
  const resolve = <T>(sent: T | null | undefined, fallback: T | null) =>
    sent === undefined ? fallback : sent;

  const approval = await tx.deliveryChallanApproval.create({
    data: {
      challanId: challan.id,
      acceptedAckId: accepted.id,
      approvedDetentionDays: resolve(
        input.approvedDetentionDays,
        defaults.approvedDetentionDays,
      ),
      approvedParkingPaise: resolve(
        input.approvedParkingPaise,
        defaults.approvedParkingPaise,
      ),
      approvedOtherPaise: resolve(
        input.approvedOtherPaise,
        defaults.approvedOtherPaise,
      ),
      approvedLabourPaise: resolve(
        input.approvedLabourPaise,
        defaults.approvedLabourPaise,
      ),
      approvedDamagePaise: resolve(
        input.approvedDamagePaise,
        defaults.approvedDamagePaise,
      ),
      approvedShortagePaise: resolve(
        input.approvedShortagePaise,
        defaults.approvedShortagePaise,
      ),
      remarks: input.remarks ?? null,
      approvedById: actorId,
    },
    select: { id: true },
  });

  return approval.id;
  });
};

/**
 * Undo a ruling, so the acknowledgements can be corrected and re-approved.
 *
 * Refused once the challan is on a payment slip: the slip's detention was
 * computed from the approved dates, and pulling the approval out from under
 * it would leave the figures unexplainable — the same guard that freezes the
 * report date and blocks cancellation.
 */
export const revokeChallanApproval = async (
  challanId: string,
  version: number,
  _reason: string,
) => {
  return db.$transaction(async (tx) => {
    await lockChallan(tx, challanId);

    const challan = await loadChallanOrThrow(challanId, tx);
    if (!challan.approval)
      throw new BadRequestError("This challan has no approval to revoke");
    if (challan.approval.version !== version)
      throw new ConflictError(
        "This approval changed in another session. Refresh and try again.",
      );

    await assertNotOnVendorSlip(
      tx,
      "DELIVERY_CHALLAN",
      [challan.id],
      "revoke the approval on this delivery challan",
    );

    await tx.deliveryChallanApproval.delete({
      where: { id: challan.approval.id },
    });
    return challan.approval.id;
  });
};
