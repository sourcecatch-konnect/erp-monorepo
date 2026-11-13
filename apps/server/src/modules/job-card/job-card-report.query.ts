import { Prisma } from "../../../generated/prisma/index.js";

export type RepairCostFilters = {
  search?: string;
  branchId?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
};

export function repairCostDateBounds(
  filters: Pick<RepairCostFilters, "from" | "to">,
) {
  return {
    from: filters.from ? new Date(`${filters.from}T00:00:00+05:30`) : null,
    toExclusive: filters.to
      ? new Date(new Date(`${filters.to}T00:00:00+05:30`).getTime() + 86400000)
      : null,
  };
}

/** Shared database scope for both page rows and full-filter totals. */
export function repairCostCte(
  filters: RepairCostFilters,
  branchIds: string[] | null,
) {
  const bounds = repairCostDateBounds(filters);
  const scope =
    branchIds === null
      ? Prisma.sql`TRUE`
      : branchIds.length
        ? Prisma.sql`jc."branchId" IN (${Prisma.join(branchIds)})`
        : Prisma.sql`FALSE`;
  const search = filters.search
    ? `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`
    : null;
  return Prisma.sql`
    WITH cards AS (
      SELECT jc.*, v."vehicleNumber", b."name" AS "branchName", j."status" AS "partsJournalStatus"
      FROM "JobCard" jc JOIN "Vehicle" v ON v."id" = jc."vehicleId"
      JOIN "Branch" b ON b."id" = jc."branchId"
      LEFT JOIN "JournalEntry" j ON j."id" = jc."journalEntryId"
      WHERE jc."status" = 'FINALISED' AND ${scope}
        ${filters.branchId ? Prisma.sql`AND jc."branchId" = ${filters.branchId}` : Prisma.empty}
        ${bounds.from ? Prisma.sql`AND jc."outDateTime" >= ${bounds.from}` : Prisma.empty}
        ${bounds.toExclusive ? Prisma.sql`AND jc."outDateTime" < ${bounds.toExclusive}` : Prisma.empty}
        ${search ? Prisma.sql`AND (jc."jobCardNumber" ILIKE ${search} OR v."vehicleNumber" ILIKE ${search})` : Prisma.empty}
    ), services AS (
      SELECT l."jobCardIdSnapshot" AS id,
        COALESCE(SUM(l."netAmountPaise") FILTER (WHERE j."status" = 'POSTED'), 0) AS amount,
        COALESCE(SUM(l."netAmountPaise") FILTER (WHERE j."status" IS DISTINCT FROM 'POSTED'), 0) AS unposted
      FROM "ServiceBillLine" l JOIN cards c ON c."id" = l."jobCardIdSnapshot" AND c."vehicleId" = l."vehicleIdSnapshot"
      JOIN "ServiceBill" b ON b."id" = l."serviceBillId" AND b."status" = 'POSTED' AND b."branchId" = c."branchId"
      LEFT JOIN "JournalEntry" j ON j."id" = b."journalEntryId"
      GROUP BY l."jobCardIdSnapshot"
    ), returns AS (
      SELECT r."jobCardId" AS id, SUM(r."unitCostPaise"::numeric * r."qty") AS amount
      FROM "JobCardRemovedPart" r JOIN cards c ON c."id" = r."jobCardId"
      JOIN "JournalEntry" j ON j."id" = r."journalEntryId" AND j."status" = 'POSTED'
      WHERE r."lifecycleStatus" = 'STOCKED' GROUP BY r."jobCardId"
    ), unbilled AS (
      SELECT l."jobCardId" AS id, SUM(l."amountPaise") AS amount
      FROM "JobCardServiceLine" l JOIN cards c ON c."id" = l."jobCardId"
      WHERE l."billedInServiceBillId" IS NULL GROUP BY l."jobCardId"
    ), costs AS (
      SELECT c."id", c."jobCardNumber", c."vehicleId", c."vehicleNumber", c."branchName", c."outDateTime",
        CASE WHEN c."partsJournalStatus" = 'POSTED' THEN c."totalPartsAmountPaise" ELSE 0 END::numeric AS parts,
        COALESCE(s.amount, 0) AS services, COALESCE(r.amount, 0) AS returns,
        COALESCE(u.amount, 0) AS unbilled,
        CASE WHEN c."partsJournalStatus" = 'POSTED' THEN 0 ELSE c."totalPartsAmountPaise" END + COALESCE(s.unposted, 0) AS unposted
      FROM cards c LEFT JOIN services s ON s.id = c."id" LEFT JOIN returns r ON r.id = c."id" LEFT JOIN unbilled u ON u.id = c."id"
    )`;
}
