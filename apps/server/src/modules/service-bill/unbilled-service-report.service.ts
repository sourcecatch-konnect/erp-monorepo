import type { z } from "zod";
import type { unbilledServiceReportQuerySchema } from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { repairCostDateBounds } from "../job-card/job-card-report.query.js";

type Filters = z.infer<typeof unbilledServiceReportQuerySchema>;
type Row = {
  id: string;
  jobCardId: string;
  jobCardNumber: string | null;
  vehicleNumber: string;
  branchName: string;
  providerName: string;
  serviceProviderId: string;
  sparePartName: string;
  description: string | null;
  completedAt: Date | null;
  qty: number;
  amountPaise: string;
};

export function unbilledReportCte(
  filters: Filters,
  branchIds: string[] | null,
) {
  const scope =
    branchIds === null
      ? Prisma.sql`TRUE`
      : branchIds.length
        ? Prisma.sql`c."branchId" IN (${Prisma.join(branchIds)})`
        : Prisma.sql`FALSE`;
  const search = filters.search
    ? `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`
    : null;
  const { toExclusive } = repairCostDateBounds({ to: filters.completedTo });
  return Prisma.sql`WITH eligible AS (
    SELECT l."id", c."id" AS "jobCardId", c."jobCardNumber", v."vehicleNumber",
      b."name" AS "branchName", p."name" AS "providerName", l."serviceProviderId",
      s."name" AS "sparePartName", l."description", c."outDateTime" AS "completedAt",
      l."qty", l."amountPaise"
    FROM "JobCardServiceLine" l JOIN "JobCard" c ON c."id" = l."jobCardId"
    JOIN "Vehicle" v ON v."id" = c."vehicleId" JOIN "Branch" b ON b."id" = c."branchId"
    JOIN "SparePartSupplier" p ON p."id" = l."serviceProviderId"
    JOIN "SparePart" s ON s."id" = l."sparePartId"
    WHERE c."status" = 'FINALISED' AND l."billedInServiceBillId" IS NULL AND ${scope}
      ${filters.branchId ? Prisma.sql`AND c."branchId" = ${filters.branchId}` : Prisma.empty}
      ${filters.serviceProviderId ? Prisma.sql`AND l."serviceProviderId" = ${filters.serviceProviderId}` : Prisma.empty}
      ${toExclusive ? Prisma.sql`AND c."outDateTime" < ${toExclusive}` : Prisma.empty}
      ${search ? Prisma.sql`AND (c."jobCardNumber" ILIKE ${search} OR v."vehicleNumber" ILIKE ${search} OR p."name" ILIKE ${search} OR s."name" ILIKE ${search})` : Prisma.empty}
  )`;
}

export async function getUnbilledServiceReport(
  filters: Filters,
  branchIds: string[] | null,
) {
  const cte = unbilledReportCte(filters, branchIds);
  return db.$transaction(
    async (tx) => {
      const [rows, totals] = await Promise.all([
        tx.$queryRaw<Row[]>(Prisma.sql`${cte}
        SELECT "id", "jobCardId", "jobCardNumber", "vehicleNumber", "branchName", "providerName", "serviceProviderId",
          "sparePartName", "description", "completedAt", "qty", "amountPaise"::text
        FROM eligible ORDER BY "completedAt" ASC NULLS LAST, "id" ASC LIMIT ${filters.size} OFFSET ${filters.page * filters.size}`),
        tx.$queryRaw<
          {
            total: number;
            amountPaise: string;
            jobCards: number;
            providers: number;
          }[]
        >(Prisma.sql`${cte}
        SELECT COUNT(*)::integer AS total, COALESCE(SUM("amountPaise"), 0)::text AS "amountPaise",
          COUNT(DISTINCT "jobCardId")::integer AS "jobCards", COUNT(DISTINCT "serviceProviderId")::integer AS providers FROM eligible`),
      ]);
      const { total, ...summary } = totals[0]!;
      return { rows, total, summary, page: filters.page, size: filters.size };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
