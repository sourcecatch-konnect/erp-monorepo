import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  completedRepairSchema,
  repairControlActionSchema,
} from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
type Tx = Prisma.TransactionClient;

export async function lockRepairVehicleTx(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) throw new NotFoundError("Vehicle not found");
}
export async function assertVehicleDispatchableTx(tx: Tx, id: string) {
  await lockRepairVehicleTx(tx, id);
  const vehicle = await tx.vehicle.findUniqueOrThrow({
    where: { id },
    select: { maintenanceHold: true },
  });
  if (vehicle.maintenanceHold)
    throw new ConflictError(
      "Vehicle has an active repair hold. Record workshop clearance before dispatch.",
    );
}
export async function assertRepairClearanceTx(
  tx: Tx,
  id: string,
  outDateTime?: Date,
) {
  const card = await tx.jobCard.findUniqueOrThrow({
    where: { id },
    select: {
      repairControlRequired: true,
      repairControl: { select: { status: true, startedAt: true } },
    },
  });
  if (
    card.repairControl?.status === "IN_PROGRESS" ||
    (card.repairControlRequired && card.repairControl?.status !== "RELEASED")
  )
    throw new ConflictError(
      "Complete the repair inspection and record roadworthiness clearance before finalising.",
    );
  if (
    outDateTime &&
    card.repairControl?.startedAt &&
    // The job-card form records completion to the minute; server start events
    // retain milliseconds. Compare at the input's precision.
    outDateTime.getTime() <
      Math.floor(card.repairControl.startedAt.getTime() / 60000) * 60000
  )
    throw new BadRequestError("Completion time cannot precede repair start");
}
export async function assertNoRepairInProgressTx(tx: Tx, id: string) {
  const control = await tx.jobCardRepairControl.findUnique({
    where: { jobCardId: id },
  });
  if (control?.status === "IN_PROGRESS")
    throw new ConflictError(
      "Record physical repair clearance before cancelling the job card",
    );
}
export async function assertRepairIdentityUnchangedTx(tx: Tx, id: string) {
  const control = await tx.jobCardRepairControl.findUnique({
    where: { jobCardId: id },
  });
  if (control && control.status !== "CANCELLED")
    throw new ConflictError(
      "Vehicle, branch and repair location cannot change after repair has started. Use a separate job card.",
    );
}
async function refreshHold(tx: Tx, vehicleId: string) {
  const open = await tx.jobCardRepairControl.count({
    where: { status: "IN_PROGRESS", jobCard: { vehicleId } },
  });
  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { maintenanceHold: open > 0 },
  });
}
export async function actOnRepairTx(
  tx: Tx,
  id: string,
  branchId: string,
  raw: z.infer<typeof repairControlActionSchema>,
  actorId: string,
) {
  const input = repairControlActionSchema.parse(raw);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ id, actorId, input }))
    .digest("hex");
  const requestKey = `repair-action:${input.clientRequestId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requestKey}))`;
  const card = await tx.jobCard.findUnique({ where: { id } });
  if (!card || card.branchId !== branchId)
    throw new NotFoundError("Job card not found");
  await lockRepairVehicleTx(tx, card.vehicleId);
  const prior = await tx.jobCardRepairEvent.findUnique({
    where: { clientRequestId: input.clientRequestId },
  });
  if (prior) {
    if (prior.jobCardId !== id || prior.requestFingerprint !== fingerprint)
      throw new ConflictError(
        "Repair request identity was already used for another payload",
      );
    return { id };
  }
  if (card.status !== "DRAFT")
    throw new ConflictError("Physical repair actions require a draft job card");
  const current = await tx.jobCardRepairControl.findUnique({
    where: { jobCardId: id },
  });
  if ((current?.version ?? 0) !== input.version)
    throw new ConflictError(
      "Repair control changed. Refresh before continuing.",
    );
  if (input.action === "START") {
    if (current?.status === "IN_PROGRESS")
      throw new ConflictError("Repair is already in progress");
    const vehicle = await tx.vehicle.findUniqueOrThrow({
      where: { id: card.vehicleId },
      select: { status: true },
    });
    const activeTrip = await tx.vehicleTrip.findFirst({
      where: {
        vehicleId: card.vehicleId,
        deletedAt: null,
        status: "InTransit",
      },
      select: { id: true },
    });
    if (
      card.truckStatus === "AT_HO" &&
      (vehicle.status === "ON_TRIP" || activeTrip)
    )
      throw new BadRequestError(
        "A vehicle on a journey must use an in-transit repair job card",
      );
  } else if (current?.status !== "IN_PROGRESS")
    throw new ConflictError("No repair is in progress");
  const claim = await tx.jobCard.updateMany({
    where: { id, branchId, status: "DRAFT", version: card.version },
    data: { version: { increment: 1 }, repairControlRequired: true },
  });
  if (claim.count !== 1)
    throw new ConflictError("Job card changed. Refresh before continuing.");
  if (input.action === "START") {
    const data = {
      status: "IN_PROGRESS",
      maintenanceReason: input.reason,
      replacementIntent: input.replacementIntent!,
      inspection: input.inspection!,
      startedAt: new Date(),
      startedById: actorId,
      clearedAt: null,
      clearedById: null,
      release: undefined,
    };
    // JSON null must be explicit when reopening a cleared control.
    if (current)
      await tx.jobCardRepairControl.update({
        where: { jobCardId: id },
        data: { ...data, release: Prisma.DbNull, version: { increment: 1 } },
      });
    else
      await tx.jobCardRepairControl.create({
        data: { ...data, jobCardId: id },
      });
  } else
    await tx.jobCardRepairControl.update({
      where: { jobCardId: id },
      data: {
        status: input.action === "RELEASE" ? "RELEASED" : "CANCELLED",
        release: input.release!,
        clearedAt: new Date(),
        clearedById: actorId,
        version: { increment: 1 },
      },
    });
  await refreshHold(tx, card.vehicleId);
  await tx.jobCardRepairEvent.create({
    data: {
      jobCardId: id,
      clientRequestId: input.clientRequestId,
      requestFingerprint: fingerprint,
      action: input.action,
      actorId,
      details: { ...input, vehicleId: card.vehicleId },
    },
  });
  return { id };
}
export async function recordCompletedRepairTx(
  tx: Tx,
  id: string,
  raw: z.infer<typeof completedRepairSchema>,
  actorId: string,
  clientRequestId: string,
  startedAt: Date,
  clearedAt: Date,
) {
  const input = completedRepairSchema.parse(raw);
  await tx.jobCardRepairControl.create({
    data: {
      jobCardId: id,
      status: "RELEASED",
      maintenanceReason: input.maintenanceReason,
      replacementIntent: input.replacementIntent,
      inspection: input.inspection,
      release: input.release,
      startedAt,
      startedById: actorId,
      clearedById: actorId,
      clearedAt,
    },
  });
  await tx.jobCardRepairEvent.create({
    data: {
      jobCardId: id,
      clientRequestId,
      requestFingerprint: createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex"),
      action: "RECORDED_COMPLETED",
      actorId,
      details: input,
    },
  });
}
