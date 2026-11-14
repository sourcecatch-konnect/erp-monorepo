import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import {
  repairCostCte,
  type RepairCostFilters,
} from "./job-card-report.query.js";

export type RepairCostAmounts = {
  partsPaise: string;
  servicesPaise: string;
  returnsPaise: string;
  netCostPaise: string;
  unbilledServicesPaise: string;
  unpostedCostPaise: string;
};
export type RepairCostRow = RepairCostAmounts & {
  id: string;
  jobCardNumber: string | null;
  vehicleId: string;
  vehicleNumber: string;
  branchName: string;
  outDateTime: Date | null;
};

export async function getJobCardRepairCosts(
  filters: RepairCostFilters,
  branchIds: string[] | null,
) {
  const cte = repairCostCte(filters, branchIds);
  return db.$transaction(
    async (tx) => {
      const [rows, totals] = await Promise.all([
        tx.$queryRaw<RepairCostRow[]>(Prisma.sql`${cte}
        SELECT "id", "jobCardNumber", "vehicleId", "vehicleNumber", "branchName", "outDateTime",
          parts::text AS "partsPaise", services::text AS "servicesPaise", returns::text AS "returnsPaise",
          (parts + services - returns)::text AS "netCostPaise", unbilled::text AS "unbilledServicesPaise", unposted::text AS "unpostedCostPaise"
        FROM costs ORDER BY "outDateTime" DESC NULLS LAST, "id" DESC LIMIT ${filters.size} OFFSET ${filters.page * filters.size}`),
        tx.$queryRaw<
          (RepairCostAmounts & { total: number })[]
        >(Prisma.sql`${cte}
        SELECT COUNT(*)::integer AS total,
          COALESCE(SUM(parts), 0)::text AS "partsPaise", COALESCE(SUM(services), 0)::text AS "servicesPaise",
          COALESCE(SUM(returns), 0)::text AS "returnsPaise", COALESCE(SUM(parts + services - returns), 0)::text AS "netCostPaise",
          COALESCE(SUM(unbilled), 0)::text AS "unbilledServicesPaise", COALESCE(SUM(unposted), 0)::text AS "unpostedCostPaise"
        FROM costs`),
      ]);
      const { total, ...summary } = totals[0]!;
      return { rows, total, summary, page: filters.page, size: filters.size };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
