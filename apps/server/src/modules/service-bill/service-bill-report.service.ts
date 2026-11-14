import type { z } from "zod";
import type { serviceBillOutstandingQuerySchema } from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";

type Filters = z.infer<typeof serviceBillOutstandingQuerySchema>;
type Amounts = {
  outstandingPaise: string;
  futurePaise: string;
  days0To30Paise: string;
  days31To60Paise: string;
  days61To90Paise: string;
  daysOver90Paise: string;
};
type OutstandingRow = {
  id: string;
  serviceBillNumber: string | null;
  providerInvoiceNo: string;
  billDate: Date;
  providerName: string;
  shopName: string | null;
  branchName: string;
  netAmountPaise: string;
  settledPaise: string;
  outstandingPaise: string;
  ageDays: number;
  bucket: string;
};

/** Current bill balances, aged by India calendar dates, not historical balances. */
export function outstandingBillsCte(
  filters: Filters,
  branchIds: string[] | null,
) {
  const scope =
    branchIds === null
      ? Prisma.sql`TRUE`
      : branchIds.length
        ? Prisma.sql`b."branchId" IN (${Prisma.join(branchIds)})`
        : Prisma.sql`FALSE`;
  const search = filters.search
    ? `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`
    : null;
  return Prisma.sql`
    WITH balances AS (
      SELECT b."id", b."serviceBillNumber", b."providerInvoiceNo", b."billDate",
        p."name" AS "providerName", p."shopName", br."name" AS "branchName",
        b."netAmountPaise", b."paidAmountPaise" AS settled,
        b."netAmountPaise" - b."paidAmountPaise" AS outstanding,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date -
          (b."billDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS age
      FROM "ServiceBill" b JOIN "SparePartSupplier" p ON p."id" = b."serviceProviderId"
      JOIN "Branch" br ON br."id" = b."branchId"
      JOIN "JournalEntry" j ON j."id" = b."journalEntryId" AND j."status" = 'POSTED'
      WHERE b."status" = 'POSTED' AND b."netAmountPaise" > b."paidAmountPaise" AND ${scope}
        ${filters.branchId ? Prisma.sql`AND b."branchId" = ${filters.branchId}` : Prisma.empty}
        ${filters.serviceProviderId ? Prisma.sql`AND b."serviceProviderId" = ${filters.serviceProviderId}` : Prisma.empty}
        ${search ? Prisma.sql`AND (p."name" ILIKE ${search} OR p."shopName" ILIKE ${search} OR b."serviceBillNumber" ILIKE ${search} OR b."providerInvoiceNo" ILIKE ${search})` : Prisma.empty}
    ), aged AS (
      SELECT *, CASE WHEN age < 0 THEN 'FUTURE' WHEN age <= 30 THEN '0_30'
        WHEN age <= 60 THEN '31_60' WHEN age <= 90 THEN '61_90' ELSE '90_PLUS' END AS bucket
      FROM balances
    ), filtered AS (
      SELECT * FROM aged ${filters.bucket ? Prisma.sql`WHERE bucket = ${filters.bucket}` : Prisma.empty}
    )`;
}

export async function getServiceBillOutstanding(
  filters: Filters,
  branchIds: string[] | null,
) {
  const cte = outstandingBillsCte(filters, branchIds);
  return db.$transaction(
    async (tx) => {
      const [rows, totals] = await Promise.all([
        tx.$queryRaw<OutstandingRow[]>(Prisma.sql`${cte}
        SELECT "id", "serviceBillNumber", "providerInvoiceNo", "billDate", "providerName", "shopName", "branchName",
          "netAmountPaise"::text, settled::text AS "settledPaise", outstanding::text AS "outstandingPaise",
          age AS "ageDays", bucket
        FROM filtered ORDER BY "billDate" ASC, "id" ASC LIMIT ${filters.size} OFFSET ${filters.page * filters.size}`),
        tx.$queryRaw<
          (Amounts & { total: number; reportDate: string })[]
        >(Prisma.sql`${cte}
        SELECT COUNT(*)::integer AS total, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date::text AS "reportDate",
          COALESCE(SUM(outstanding), 0)::text AS "outstandingPaise",
          COALESCE(SUM(outstanding) FILTER (WHERE bucket = 'FUTURE'), 0)::text AS "futurePaise",
          COALESCE(SUM(outstanding) FILTER (WHERE bucket = '0_30'), 0)::text AS "days0To30Paise",
          COALESCE(SUM(outstanding) FILTER (WHERE bucket = '31_60'), 0)::text AS "days31To60Paise",
          COALESCE(SUM(outstanding) FILTER (WHERE bucket = '61_90'), 0)::text AS "days61To90Paise",
          COALESCE(SUM(outstanding) FILTER (WHERE bucket = '90_PLUS'), 0)::text AS "daysOver90Paise"
        FROM filtered`),
      ]);
      const { total, reportDate, ...summary } = totals[0]!;
      return {
        rows,
        total,
        reportDate,
        summary,
        page: filters.page,
        size: filters.size,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
