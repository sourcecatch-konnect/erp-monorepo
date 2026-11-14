import { createHash } from "node:crypto";
import type { z } from "zod";
import type { removedPartActionSchema } from "@skerp/validators";
import type {
  Prisma,
  RemovedPartLifecycleStatus,
} from "../../../generated/prisma/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import { postApprovedRemovedPartTx } from "./job-card-removed-part.service.js";

type Input = z.infer<typeof removedPartActionSchema>;
export function lifecycleFingerprint(
  id: string,
  input: Input,
  actorId: string,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id,
        actorId,
        action: input.action,
        version: input.version,
        reason: input.reason,
        evidence: input.evidence,
        custodyLocation: input.custodyLocation,
        unitCostPaise: input.unitCostPaise?.toString() ?? null,
      }),
    )
    .digest("hex");
}

/** Caller checks action permission and branch. READ COMMITTED, all effects in one transaction. */
export async function actOnRemovedPartTx(
  tx: Prisma.TransactionClient,
  jobCardId: string,
  id: string,
  branchId: string,
  input: Input,
  actorId: string,
) {
  const fingerprint = lifecycleFingerprint(id, input, actorId);
  const requestLock = `removed-part-action-request:${input.clientRequestId}`;
  const recordLock = `removed-part-action:${id}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requestLock}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${recordLock}))`;
  const record = await tx.jobCardRemovedPart.findUnique({
    where: { id },
    include: {
      jobCard: {
        select: { id: true, branchId: true, status: true, version: true },
      },
    },
  });
  if (
    !record ||
    record.jobCardId !== jobCardId ||
    record.jobCard.branchId !== branchId
  )
    throw new NotFoundError("Removed part not found");
  const prior = await tx.jobCardRemovedPartEvent.findUnique({
    where: { clientRequestId: input.clientRequestId },
  });
  if (prior) {
    if (prior.removedPartId !== id || prior.requestFingerprint !== fingerprint)
      throw new ConflictError(
        "This lifecycle request ID was already used for another action",
      );
    return { id };
  }
  if (record.jobCard.status !== "FINALISED")
    throw new ConflictError(
      "Only finalised job cards can change removed-part custody",
    );
  if (record.version !== input.version)
    throw new ConflictError("Removed part changed. Refresh before continuing.");
  const approve = ["APPROVE_STOCK", "APPROVE_DISPOSAL", "REJECT"].includes(
    input.action,
  );
  if (
    approve &&
    (record.createdById === actorId ||
      record.valuationSubmittedById === actorId)
  )
    throw new BadRequestError(
      "A different person must approve or reject this proposal",
    );
  let next: RemovedPartLifecycleStatus;
  const data: Prisma.JobCardRemovedPartUpdateManyMutationInput = {
    custodyLocation: input.custodyLocation,
    version: { increment: 1 },
  };
  const status = record.lifecycleStatus;
  switch (input.action) {
    case "SEND_REPAIR":
      if (status !== "HELD" || record.condition !== "REPAIRABLE")
        throw new ConflictError("Only held repairable parts can be dispatched");
      next = "IN_REPAIR";
      data.repairReference = input.evidence;
      data.repairReceivedAt = null;
      data.unitCostPaise = null;
      break;
    case "RECEIVE_REPAIR":
      if (status !== "IN_REPAIR")
        throw new ConflictError("The part is not out for repair");
      next = "PENDING_APPROVAL";
      data.repairReference = input.evidence;
      data.repairReceivedAt = new Date();
      data.unitCostPaise = input.unitCostPaise;
      data.valuationSubmittedById = actorId;
      break;
    case "SUBMIT_VALUATION":
      if (
        status !== "HELD" ||
        (record.condition !== "REUSABLE" &&
          !(record.condition === "REPAIRABLE" && record.repairReceivedAt))
      )
        throw new ConflictError(
          "A reusable or received repaired part is required",
        );
      next = "PENDING_APPROVAL";
      data.unitCostPaise = input.unitCostPaise;
      data.valuationSubmittedById = actorId;
      break;
    case "APPROVE_STOCK":
      if (status !== "PENDING_APPROVAL" || record.condition === "SCRAP")
        throw new ConflictError("The part is not awaiting valuation approval");
      if (record.condition === "REPAIRABLE" && !record.repairReceivedAt)
        throw new ConflictError(
          "A repaired part needs a recorded repair receipt before approval",
        );
      if (!input.unitCostPaise)
        throw new BadRequestError("A positive approved value is required");
      data.provenanceReference = record.provenanceReference ?? input.evidence;
      next = "STOCKED";
      data.approvedById = actorId;
      data.approvedAt = new Date();
      data.unitCostPaise = input.unitCostPaise;
      break;
    case "DECLARE_SCRAP":
      if (!["HELD", "IN_REPAIR"].includes(status))
        throw new ConflictError(
          "Only unstocked held or in-repair parts can be declared scrap",
        );
      next = "SCRAP_HELD";
      data.unitCostPaise = null;
      break;
    case "REQUEST_DISPOSAL":
      if (
        status !== "SCRAP_HELD" &&
        !(status === "HELD" && record.condition === "SCRAP")
      )
        throw new ConflictError(
          "Only scrap in custody can be submitted for disposal",
        );
      next = "DISPOSAL_PENDING";
      data.valuationSubmittedById = actorId;
      break;
    case "APPROVE_DISPOSAL":
      if (status !== "DISPOSAL_PENDING")
        throw new ConflictError("The part is not awaiting disposal approval");
      next = "DISPOSED";
      data.approvedById = actorId;
      data.approvedAt = new Date();
      break;
    case "REJECT":
      if (!["PENDING_APPROVAL", "DISPOSAL_PENDING"].includes(status))
        throw new ConflictError("Only pending proposals can be rejected");
      next = status === "DISPOSAL_PENDING" ? "SCRAP_HELD" : "HELD";
      break;
  }
  if (record.newBatchId || record.journalEntryId)
    throw new ConflictError(
      "Posted or legacy stock entries cannot be changed through custody actions",
    );
  const parent = await tx.jobCard.updateMany({
    where: {
      id: jobCardId,
      branchId,
      status: "FINALISED",
      version: record.jobCard.version,
    },
    data: { version: { increment: 1 } },
  });
  if (parent.count !== 1)
    throw new ConflictError("Job card changed. Refresh before continuing.");
  const claimed = await tx.jobCardRemovedPart.updateMany({
    where: { id, version: input.version, lifecycleStatus: status },
    data: { ...data, lifecycleStatus: next },
  });
  if (claimed.count !== 1)
    throw new ConflictError("Removed part changed. Refresh before continuing.");
  if (input.action === "APPROVE_STOCK")
    await postApprovedRemovedPartTx(
      tx,
      { ...record, unitCostPaise: input.unitCostPaise! },
      branchId,
      actorId,
    );
  await tx.jobCardRemovedPartEvent.create({
    data: {
      removedPartId: id,
      clientRequestId: input.clientRequestId,
      requestFingerprint: fingerprint,
      action: input.action,
      fromStatus: status,
      toStatus: next,
      actorId,
      reason: input.reason,
      details: {
        evidence: input.evidence,
        custodyLocation: input.custodyLocation,
        unitCostPaise: input.unitCostPaise?.toString() ?? null,
      },
    },
  });
  return { id };
}
