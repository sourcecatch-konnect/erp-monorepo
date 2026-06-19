import { Prisma } from "../../../generated/prisma/index.js";
import { BadRequestError } from "../../lib/error.js";

type Tx = Prisma.TransactionClient;

/* ------------------------------------------------------------------ */
/* LR number generation                                                */
/* ------------------------------------------------------------------ */

/**
 * LR numbers are branch-scoped: SKT/<branchCode>/<fyCode>/<00001>
 * Reuses the DocumentSequence table with docType "LR". Each LR in a group
 * gets its own number (one per consignment / invoice).
 */
export const generateLRNumber = async (
  tx: Tx,
  branchCode: string,
  fyCode: string,
): Promise<string> => {
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "branchCode", "fyCode", "docType", "nextSeq", "updatedAt")
    VALUES (gen_random_uuid()::text, ${branchCode}, ${fyCode}, ${"LR"}, 2, now())
    ON CONFLICT ("branchCode", "fyCode", "docType")
    DO UPDATE SET "nextSeq" = "DocumentSequence"."nextSeq" + 1, "updatedAt" = now()
    RETURNING ("nextSeq" - 1) AS seq
  `;
  const seq = Number(rows[0]?.seq ?? 1);
  return `SKT/${branchCode}/${fyCode}/${String(seq).padStart(5, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Hub (head-office branch) resolver                                    */
/* ------------------------------------------------------------------ */

/**
 * The hub is always the head-office branch (Jalgaon) — never picked. Resolve it
 * from the singleton `isHeadOffice` flag. Throws if none is configured.
 */
export const resolveHubBranchId = async (tx: Tx): Promise<string> => {
  const ho = await tx.branch.findFirst({
    where: { isHeadOffice: true },
    select: { id: true },
  });
  if (!ho) {
    throw new BadRequestError(
      "No head-office branch is configured. Mark a branch as Head Office to enable hub split.",
    );
  }
  return ho.id;
};

/* ------------------------------------------------------------------ */
/* Prisma select shapes (slim LR — one consignment within a group)     */
/* ------------------------------------------------------------------ */

const locationSelect = {
  id: true,
  name: true,
  address: true,
  city: { select: { id: true, name: true } },
} satisfies Prisma.CustomerLocationSelect;

const groupRefSelect = {
  id: true,
  groupNumber: true,
  status: true,
} satisfies Prisma.LRGroupSelect;

export const lrListSelect = {
  id: true,
  lrNumber: true,
  status: true,
  fyCode: true,
  createdAt: true,
  groupId: true,
  invoiceNumber: true,
  invoiceAmount: true,
  loadingLocation: { select: locationSelect },
  unloadingLocation: { select: locationSelect },
  group: { select: groupRefSelect },
} satisfies Prisma.LorryReceiptSelect;

export const lrDetailInclude = {
  loadingLocation: { select: locationSelect },
  unloadingLocation: { select: locationSelect },
  group: { select: groupRefSelect },
  goods: true,
  ewayBills: { orderBy: { generatedAt: "asc" as const } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LorryReceiptInclude;
