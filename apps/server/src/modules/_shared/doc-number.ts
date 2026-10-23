import { Prisma } from "../../../generated/prisma/index.js";

type Tx = Prisma.TransactionClient;

/**
 * Indian financial year code for a date — April..March.
 * 2026-06-02 -> "26-27", 2026-02-15 -> "25-26".
 */
export const fyCodeFor = (date: Date): string => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1; // month 3 = April
  const pad = (y: number) => String(y % 100).padStart(2, "0");
  return `${pad(startYear)}-${pad(startYear + 1)}`;
};

/**
 * Atomically reserve the next sequence number for (branchCode, fyCode, docType)
 * and return it. Single upsert+increment statement → safe under concurrency.
 *
 * `branchCode` is the per-branch slot for branch-scoped documents (orders, LRs);
 * branch-less documents (e.g. trips) pass a fixed token such as "TRIP".
 */
export const nextSequence = async (
  tx: Tx,
  branchCode: string,
  fyCode: string,
  docType: string,
): Promise<number> => {
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "branchCode", "fyCode", "docType", "nextSeq", "updatedAt")
    VALUES (gen_random_uuid()::text, ${branchCode}, ${fyCode}, ${docType}, 2, now())
    ON CONFLICT ("branchCode", "fyCode", "docType")
    DO UPDATE SET "nextSeq" = "DocumentSequence"."nextSeq" + 1, "updatedAt" = now()
    RETURNING ("nextSeq" - 1) AS seq
  `;
  return Number(rows[0]?.seq ?? 1);
};

/**
 * Build a document number: <prefix>/<branchCode>/<fyCode>/<00001>.
 *
 * Each document type carries its own human-readable prefix so numbers are
 * distinguishable at a glance even though they live in separate sequences:
 * orders `SKO`, lorry receipts `SKT`, LR groups `SKG`, trips `SKV/TRIP/...`.
 * The DB never collides (separate `docType`); the prefix is purely for humans.
 *
 * `digits` defaults to 5 (every existing document type). Pass a different
 * value only when a specific format is contractually required — e.g. VP-2's
 * VPAY slip number is spec'd as 4 digits (`SKT/VPAY/<branch>/<fy>/0001`),
 * one deliberate exception to the app-wide 5-digit convention.
 */
export const formatDocNumber = (
  branchCode: string,
  fyCode: string,
  seq: number,
  prefix = "SKT",
  digits = 5,
) => `${prefix}/${branchCode}/${fyCode}/${String(seq).padStart(digits, "0")}`;
