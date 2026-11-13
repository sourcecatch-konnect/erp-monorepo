import type { z } from "zod";
import type { jobCardReconciliationQuerySchema } from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";

type Filters = z.infer<typeof jobCardReconciliationQuerySchema>;
type Row = {
  id: string;
  kind: "PARTS" | "SERVICES" | "RETURN";
  parentId: string;
  documentNumber: string | null;
  sourceDate: Date | null;
  branchName: string;
  journalEntryId: string | null;
  voucherNumber: string | null;
  tallySyncStatus: string | null;
  expectedPaise: string;
  recordedPaise: string;
  differencePaise: string;
  issue: string;
};

export function reconciliationCte(
  filters: Filters,
  branchIds: string[] | null,
) {
  // Every union arm applies the same source-branch scope before touching journals.
  const scope = (alias: "c" | "b") => {
    const column =
      alias === "c" ? Prisma.sql`c."branchId"` : Prisma.sql`b."branchId"`;
    return Prisma.sql`${branchIds === null ? Prisma.sql`TRUE` : branchIds.length ? Prisma.sql`${column} IN (${Prisma.join(branchIds)})` : Prisma.sql`FALSE`}
      ${filters.branchId ? Prisma.sql`AND ${column} = ${filters.branchId}` : Prisma.empty}`;
  };
  const search = filters.search
    ? `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`
    : null;
  return Prisma.sql`WITH sources AS (
    SELECT c."id", 'PARTS' AS kind, c."id" AS "parentId", c."jobCardNumber" AS "documentNumber",
      c."outDateTime" AS "sourceDate", c."branchId", c."journalEntryId", c."totalPartsAmountPaise"::numeric AS expected,
      'JOB_CARD' AS "sourceType", FALSE AS "missingValue"
    FROM "JobCard" c WHERE c."status" = 'FINALISED' AND (c."totalPartsAmountPaise" <> 0 OR c."journalEntryId" IS NOT NULL) AND ${scope("c")}
    UNION ALL
    SELECT b."id", 'SERVICES', b."id", b."serviceBillNumber", b."billDate", b."branchId", b."journalEntryId",
      b."netAmountPaise"::numeric, 'SERVICE_BILL', FALSE
    FROM "ServiceBill" b WHERE b."status" = 'POSTED' AND ${scope("b")}
    UNION ALL
    SELECT r."id", 'RETURN', c."id", c."jobCardNumber", r."createdAt", c."branchId", r."journalEntryId",
      -COALESCE(r."unitCostPaise", 0)::numeric * r."qty", 'JOB_CARD', r."unitCostPaise" IS NULL
    FROM "JobCardRemovedPart" r JOIN "JobCard" c ON c."id" = r."jobCardId"
    WHERE c."status" = 'FINALISED' AND r."condition" = 'REUSABLE' AND ${scope("c")}
  ), scoped AS (
    SELECT s.* FROM sources s JOIN "Branch" br ON br."id" = s."branchId"
    WHERE TRUE ${filters.kind ? Prisma.sql`AND s.kind = ${filters.kind}` : Prisma.empty}
      ${search ? Prisma.sql`AND (s."documentNumber" ILIKE ${search} OR s."id" ILIKE ${search} OR br."name" ILIKE ${search})` : Prisma.empty}
  ), journal_totals AS (
    SELECT l."journalEntryId", SUM(l."debitPaise") AS debit, SUM(l."creditPaise") AS credit,
      COALESCE(SUM(l."debitPaise"::numeric - l."creditPaise") FILTER (WHERE gl."code" = 'REPAIR_EXPENSE'), 0) AS expense
    FROM "JournalLine" l JOIN "Ledger" gl ON gl."id" = l."ledgerId"
    WHERE l."journalEntryId" IN (SELECT "journalEntryId" FROM scoped)
    GROUP BY l."journalEntryId"
  ), checked AS (
    SELECT s."id", s.kind, s."parentId", s."documentNumber", s."sourceDate", br."name" AS "branchName",
      CASE WHEN j."branchId" = s."branchId" THEN j."id" END AS "journalEntryId",
      CASE WHEN j."branchId" = s."branchId" THEN j."voucherNumber" END AS "voucherNumber",
      CASE WHEN j."branchId" = s."branchId" THEN j."tallySyncStatus"::text END AS "tallySyncStatus",
      s.expected, CASE WHEN j."status" = 'POSTED' AND j."branchId" = s."branchId" THEN COALESCE(t.expense, 0) ELSE 0 END AS recorded,
      CASE WHEN s."missingValue" THEN 'SOURCE_VALUE_MISSING'
        WHEN j."id" IS NULL THEN 'MISSING_JOURNAL'
        WHEN j."branchId" <> s."branchId" THEN 'WRONG_BRANCH'
        WHEN j."sourceType"::text <> s."sourceType" OR j."sourceId" <> s."id" OR j."voucherType" <> 'JOURNAL' THEN 'WRONG_SOURCE'
        WHEN j."status" <> 'POSTED' THEN 'NOT_POSTED'
        WHEN t."journalEntryId" IS NULL OR t.debit <> t.credit THEN 'UNBALANCED'
        WHEN COALESCE(t.expense, 0) <> s.expected THEN 'AMOUNT_MISMATCH'
        ELSE 'MATCHED' END AS issue
    FROM scoped s JOIN "Branch" br ON br."id" = s."branchId"
    LEFT JOIN "JournalEntry" j ON j."id" = s."journalEntryId"
    LEFT JOIN journal_totals t ON t."journalEntryId" = j."id"
  ), filtered AS (
    SELECT * FROM checked ${filters.view === "ISSUES" ? Prisma.sql`WHERE issue <> 'MATCHED'` : Prisma.empty}
  )`;
}

export async function getJobCardReconciliation(
  filters: Filters,
  branchIds: string[] | null,
) {
  const cte = reconciliationCte(filters, branchIds);
  return db.$transaction(
    async (tx) => {
      const [rows, totals] = await Promise.all([
        tx.$queryRaw<Row[]>(Prisma.sql`${cte}
        SELECT "id", kind, "parentId", "documentNumber", "sourceDate", "branchName", "journalEntryId", "voucherNumber", "tallySyncStatus",
          expected::text AS "expectedPaise", recorded::text AS "recordedPaise", (expected - recorded)::text AS "differencePaise", issue
        FROM filtered ORDER BY "sourceDate" DESC NULLS LAST, kind ASC, "id" ASC LIMIT ${filters.size} OFFSET ${filters.page * filters.size}`),
        tx.$queryRaw<
          {
            total: number;
            issues: number;
            expectedPaise: string;
            recordedPaise: string;
            absoluteDifferencePaise: string;
          }[]
        >(Prisma.sql`${cte}
        SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE issue <> 'MATCHED')::integer AS issues,
          COALESCE(SUM(expected), 0)::text AS "expectedPaise", COALESCE(SUM(recorded), 0)::text AS "recordedPaise",
          COALESCE(SUM(ABS(expected - recorded)), 0)::text AS "absoluteDifferencePaise" FROM filtered`),
      ]);
      const { total, ...summary } = totals[0]!;
      return { rows, total, summary, page: filters.page, size: filters.size };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
