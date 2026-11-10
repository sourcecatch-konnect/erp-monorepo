import type { db } from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";
import { formatDocNumber, fyCodeFor, nextSequence } from "../_shared/doc-number.js";

const CLAIM_DOC = { docType: "CLM", prefix: "SKT/CLM" } as const;

/**
 * Reserve the next claim number for the branch and the financial year of the
 * claim date, e.g. SKT/CLM/JAL/26-27/00001. One atomic upsert — safe outside
 * the caller's transaction (a rolled-back create just leaves a gap).
 */
export const reserveClaimNumber = async (
  client: typeof db | Prisma.TransactionClient,
  branchCode: string,
  claimDate: Date,
): Promise<{ claimNumber: string; fyCode: string }> => {
  const fyCode = fyCodeFor(claimDate);
  const seq = await nextSequence(client, branchCode, fyCode, CLAIM_DOC.docType);
  return { claimNumber: formatDocNumber(branchCode, fyCode, seq, CLAIM_DOC.prefix), fyCode };
};
