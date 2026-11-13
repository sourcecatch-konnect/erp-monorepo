import { createHash } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/index.js";
import { ConflictError } from "../../lib/error.js";

type Tx = Prisma.TransactionClient;
type Request = { clientRequestId: string; branchId: string };
type Action = "DRAFT" | "FINALISE";

export function jobCardCreateFingerprint<T extends Request>(
  input: T,
  actorId: string,
  action: Action,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({ actorId, action, input }, (_key, value) => {
        if (typeof value === "bigint") return value.toString();
        if (value && typeof value === "object" && !Array.isArray(value))
          return Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          );
        return value;
      }),
    )
    .digest("hex");
}

/** Caller authorises the branch and uses READ COMMITTED to see a lock waiter's committed predecessor. */
export async function createJobCardOnceTx<T extends Request>(
  tx: Tx,
  input: T,
  actorId: string,
  action: Action,
  create: (identity: {
    clientRequestId: string;
    requestFingerprint: string;
  }) => Promise<{ id: string }>,
) {
  const requestFingerprint = jobCardCreateFingerprint(input, actorId, action);
  const lockKey = `job-card-create:${input.clientRequestId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  const prior = await tx.jobCard.findUnique({
    where: { clientRequestId: input.clientRequestId },
    select: {
      id: true,
      requestFingerprint: true,
      branchId: true,
      createdById: true,
    },
  });
  if (prior) {
    if (
      prior.requestFingerprint !== requestFingerprint ||
      prior.branchId !== input.branchId ||
      prior.createdById !== actorId
    )
      throw new ConflictError(
        "This create request was already used. Open the job card register before starting another submission.",
      );
    return { id: prior.id };
  }
  return create({ clientRequestId: input.clientRequestId, requestFingerprint });
}
