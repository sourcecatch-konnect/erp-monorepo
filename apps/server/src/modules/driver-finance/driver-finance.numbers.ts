import { db } from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/index.js";
import { formatDocNumber, nextSequence } from "../_shared/doc-number.js";

/**
 * Document numbers for the driver-finance documents. Each has its own
 * DocumentSequence docType (per branch + FY) and a human prefix, e.g.
 * SKT/DSAL/JAL/26-27/00001.
 */
export const DRIVER_FINANCE_DOC = {
  SALARY_RUN: { docType: "DSAL", prefix: "SKT/DSAL" },
  SALARY_ADVANCE: { docType: "DSADV", prefix: "SKT/DSADV" },
  PAYOUT: { docType: "DPAY", prefix: "SKT/DPAY" },
} as const;

export type DriverFinanceDocKind = keyof typeof DRIVER_FINANCE_DOC;

/**
 * Reserve the next number for a driver-finance document. One atomic upsert —
 * safe outside the caller's transaction (a rolled-back create just leaves a
 * gap), same as the vendor-payment routes do.
 */
export const reserveDriverFinanceNumber = async (
  client: typeof db | Prisma.TransactionClient,
  kind: DriverFinanceDocKind,
  branchCode: string,
  fyCode: string,
): Promise<string> => {
  const { docType, prefix } = DRIVER_FINANCE_DOC[kind];
  const seq = await nextSequence(client, branchCode, fyCode, docType);
  return formatDocNumber(branchCode, fyCode, seq, prefix);
};
