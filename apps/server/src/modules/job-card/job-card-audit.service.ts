import type { z } from "zod";
import type { jobCardAuditQuerySchema } from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { repairCostDateBounds } from "./job-card-report.query.js";

type Filters = z.infer<typeof jobCardAuditQuerySchema>;
type Row = {
  id: string;
  documentNumber: string;
  branchName: string;
  date: Date | null;
  unit: "PAISE" | "QTY";
  expected: string;
  actual: string;
  difference: string;
  issue: string;
  state: string;
  voucherNumber: string | null;
  tallySyncStatus: string | null;
};

export function jobCardAuditCte(filters: Filters, branchIds: string[] | null) {
  const scope =
    branchIds === null
      ? Prisma.sql`TRUE`
      : branchIds.length
        ? Prisma.sql`br."id" IN (${Prisma.join(branchIds)})`
        : Prisma.sql`FALSE`;
  const search = filters.search
    ? `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`
    : null;
  const bounds = repairCostDateBounds(filters);
  let data: Prisma.Sql;
  if (filters.mode === "SETTLEMENTS") {
    data = Prisma.sql`
      , bills AS (SELECT b.* FROM "ServiceBill" b JOIN allowed a ON a.id = b."branchId"),
      payments AS (
        SELECT p."id", p."serviceBillId" AS "billId", NULL::text AS "slipId", p."paidPaise" + p."tdsPaise" AS amount,
          p."journalEntryId" AS "journalId", p."reversedAt", p."reversalJournalEntryId", 'SERVICE_BILL' AS "sourceType"
        FROM "ServiceBillPayment" p JOIN bills b ON b.id = p."serviceBillId"
        UNION ALL
        SELECT p."id", s."serviceBillId", s."id", p."paidPaise" + p."tdsPaise", p."settlementJournalEntryId", p."reversedAt", p."reversalJournalEntryId", 'VENDOR_PAYMENT'
        FROM "VendorPaymentDisbursement" p JOIN "VendorPaymentSlip" s ON s.id = p."slipId" AND s.type = 'JOBCARD'
        JOIN bills b ON b.id = s."serviceBillId" AND b."branchId" = s."branchId"
      ), bill_totals AS (SELECT "billId", SUM(amount) AS amount FROM payments WHERE "reversedAt" IS NULL GROUP BY "billId"),
      slip_totals AS (SELECT "slipId", SUM(amount) AS amount FROM payments WHERE "reversedAt" IS NULL GROUP BY "slipId"),
      provider_totals AS (
        SELECT l."journalEntryId", gl."sparePartSupplierId", SUM(l."debitPaise"::numeric - l."creditPaise") AS amount
        FROM "JournalLine" l JOIN "Ledger" gl ON gl.id = l."ledgerId" WHERE gl."sparePartSupplierId" IS NOT NULL
          AND l."journalEntryId" IN (SELECT "journalId" FROM payments UNION SELECT "reversalJournalEntryId" FROM payments)
        GROUP BY l."journalEntryId", gl."sparePartSupplierId"
      ), raw AS (
        SELECT 'bill:' || b.id AS id, COALESCE(b."serviceBillNumber", b.id) AS "documentNumber", b."branchId", b."billDate" AS date,
          'PAISE' AS unit, COALESCE(bt.amount, 0)::numeric AS expected,
          b."paidAmountPaise"::numeric AS actual, 'COUNTER' AS state, NULL::text AS "voucherNumber", NULL::text AS "tallySyncStatus", TRUE AS valid
        FROM bills b LEFT JOIN bill_totals bt ON bt."billId" = b.id
        UNION ALL
        SELECT 'slip:' || s.id, s."slipNumber", s."branchId", s."createdAt", 'PAISE',
          COALESCE(st.amount, 0), s."paidPaise", 'COUNTER', NULL, NULL, TRUE
        FROM "VendorPaymentSlip" s JOIN allowed a ON a.id = s."branchId" LEFT JOIN slip_totals st ON st."slipId" = s.id WHERE s.type = 'JOBCARD'
        UNION ALL
        SELECT 'payment:' || p.id, COALESCE(b."serviceBillNumber", b.id) || ' / ' || p.id, b."branchId", j."voucherDate", 'PAISE',
          CASE WHEN p."reversedAt" IS NULL THEN p.amount ELSE 0 END,
          CASE WHEN j."branchId" = b."branchId" AND ((p."reversedAt" IS NULL AND j.status = 'POSTED') OR (p."reversedAt" IS NOT NULL AND r."branchId" = b."branchId" AND r.status = 'POSTED')) THEN
            COALESCE(jt.amount, 0) + CASE WHEN p."reversedAt" IS NOT NULL THEN COALESCE(rt.amount, 0) ELSE 0 END ELSE 0 END,
          CASE WHEN p."reversedAt" IS NULL THEN 'ACTIVE' ELSE 'REVERSED' END,
          CASE WHEN j."branchId" = b."branchId" THEN j."voucherNumber" END,
          CASE WHEN j."branchId" = b."branchId" THEN j."tallySyncStatus"::text END,
          COALESCE(j."branchId" = b."branchId" AND j."sourceId" = p.id AND j."sourceType"::text = p."sourceType" AND j."voucherType" = 'PAYMENT'
            AND ((p."reversedAt" IS NULL AND j.status = 'POSTED') OR (p."reversedAt" IS NOT NULL AND j.status = 'REVERSED' AND r.status = 'POSTED' AND r."reversesId" = j.id AND r."branchId" = b."branchId")), FALSE)
        FROM payments p JOIN bills b ON b.id = p."billId" LEFT JOIN "JournalEntry" j ON j.id = p."journalId" LEFT JOIN "JournalEntry" r ON r.id = p."reversalJournalEntryId"
        LEFT JOIN provider_totals jt ON jt."journalEntryId" = j.id AND jt."sparePartSupplierId" = b."serviceProviderId"
        LEFT JOIN provider_totals rt ON rt."journalEntryId" = r.id AND rt."sparePartSupplierId" = b."serviceProviderId"
      ), checks AS (SELECT *, CASE WHEN NOT valid THEN 'VOUCHER_LINK_OR_STATUS' WHEN expected <> actual THEN 'SETTLEMENT_MISMATCH' ELSE 'MATCHED' END AS issue FROM raw)`;
  } else if (filters.mode === "STOCK") {
    data = Prisma.sql`
      , movements AS (SELECT m.* FROM "StockMovement" m JOIN allowed a ON a.id = m."branchId"),
      batches AS (SELECT b.* FROM "SpareBatch" b JOIN allowed a ON a.id = b."branchId"),
      ledgers AS (SELECT l.* FROM "StockLedger" l JOIN allowed a ON a.id = l."branchId"),
      keys AS (SELECT "sparePartId", "branchId" FROM movements UNION SELECT "sparePartId", "branchId" FROM batches UNION SELECT "sparePartId", "branchId" FROM ledgers),
      movement_totals AS (SELECT "sparePartId", "branchId", SUM("qtyDelta") AS qty FROM movements GROUP BY "sparePartId", "branchId"),
      batch_totals AS (SELECT "sparePartId", "branchId", SUM("qtyRemaining") AS qty FROM batches GROUP BY "sparePartId", "branchId"),
      balances AS (
        SELECT k.*, p.name, COALESCE(l."currentQty", 0)::numeric AS current,
          COALESCE(mt.qty, 0) AS moved, COALESCE(bt.qty, 0) AS batched
        FROM keys k JOIN "SparePart" p ON p.id = k."sparePartId" LEFT JOIN ledgers l ON l."sparePartId" = k."sparePartId" AND l."branchId" = k."branchId"
        LEFT JOIN movement_totals mt ON mt."sparePartId" = k."sparePartId" AND mt."branchId" = k."branchId"
        LEFT JOIN batch_totals bt ON bt."sparePartId" = k."sparePartId" AND bt."branchId" = k."branchId"
      ), cards AS (SELECT c.* FROM "JobCard" c JOIN allowed a ON a.id = c."branchId"),
      card_keys AS (
        SELECT l."jobCardId", l."sparePartId" FROM "JobCardPartLine" l JOIN cards c ON c.id = l."jobCardId"
        UNION SELECT m."refId", m."sparePartId" FROM movements m WHERE m."refType" IN ('JOB_CARD', 'JOBCARD_FINALISE_UNDO')
      ), part_totals AS (SELECT l."jobCardId", l."sparePartId", SUM(l.qty) AS qty, SUM(l."amountPaise") AS value FROM "JobCardPartLine" l JOIN cards c ON c.id = l."jobCardId" GROUP BY l."jobCardId", l."sparePartId"),
      issue_totals AS (SELECT "refId", "sparePartId", "branchId", SUM("qtyDelta") AS qty, SUM("qtyDelta"::numeric * "unitCostPaise") AS value FROM movements WHERE "refType" IN ('JOB_CARD', 'JOBCARD_FINALISE_UNDO') GROUP BY "refId", "sparePartId", "branchId"),
      return_totals AS (SELECT "refId", "sparePartId", "branchId", SUM("qtyDelta") AS qty, SUM("qtyDelta"::numeric * "unitCostPaise") AS value FROM movements WHERE "refType" = 'JOB_CARD_REMOVED_PART' GROUP BY "refId", "sparePartId", "branchId"),
      card_values AS (
        SELECT k.*, c."branchId", COALESCE(c."jobCardNumber", c.id) AS number, c."outDateTime" AS date,
          CASE WHEN c.status = 'FINALISED' THEN -COALESCE(pt.qty, 0) ELSE 0 END AS qty,
          CASE WHEN c.status = 'FINALISED' THEN -COALESCE(pt.value, 0) ELSE 0 END AS value,
          COALESCE(it.qty, 0) AS moved, COALESCE(it.value, 0) AS moved_value
        FROM card_keys k JOIN cards c ON c.id = k."jobCardId"
        LEFT JOIN part_totals pt ON pt."jobCardId" = c.id AND pt."sparePartId" = k."sparePartId"
        LEFT JOIN issue_totals it ON it."refId" = c.id AND it."sparePartId" = k."sparePartId" AND it."branchId" = c."branchId"
      ), raw AS (
        SELECT 'movement-balance:' || "branchId" || ':' || "sparePartId" AS id, name AS "documentNumber", "branchId", NULL::timestamp AS date, 'QTY' AS unit, moved AS expected, current AS actual, 'MOVEMENT_BALANCE' AS state FROM balances
        UNION ALL SELECT 'batch-balance:' || "branchId" || ':' || "sparePartId", name, "branchId", NULL, 'QTY', batched, current, 'BATCH_BALANCE' FROM balances
        UNION ALL SELECT 'card-qty:' || "jobCardId" || ':' || "sparePartId", number, "branchId", date, 'QTY', qty, moved, 'CARD_ISSUES_NET_OF_UNDO' FROM card_values
        UNION ALL SELECT 'card-value:' || "jobCardId" || ':' || "sparePartId", number, "branchId", date, 'PAISE', value, moved_value, 'CARD_ISSUE_VALUE' FROM card_values
        UNION ALL
        SELECT 'return-qty:' || r.id, COALESCE(c."jobCardNumber", c.id) || ' / ' || r.id, c."branchId", r."createdAt", 'QTY',
          CASE WHEN r.condition = 'REUSABLE' THEN r.qty ELSE 0 END,
          COALESCE(rt.qty, 0), 'RETURN_QTY'
        FROM "JobCardRemovedPart" r JOIN cards c ON c.id = r."jobCardId" LEFT JOIN return_totals rt ON rt."refId" = r.id AND rt."sparePartId" = r."sparePartId" AND rt."branchId" = c."branchId"
        UNION ALL
        SELECT 'return-value:' || r.id, COALESCE(c."jobCardNumber", c.id) || ' / ' || r.id, c."branchId", r."createdAt", 'PAISE',
          CASE WHEN r.condition = 'REUSABLE' THEN COALESCE(r."unitCostPaise", 0)::numeric * r.qty ELSE 0 END,
          COALESCE(rt.value, 0), 'RETURN_VALUE'
        FROM "JobCardRemovedPart" r JOIN cards c ON c.id = r."jobCardId" LEFT JOIN return_totals rt ON rt."refId" = r.id AND rt."sparePartId" = r."sparePartId" AND rt."branchId" = c."branchId"
      ), checks AS (SELECT *, NULL::text AS "voucherNumber", NULL::text AS "tallySyncStatus", CASE WHEN expected <> actual THEN 'STOCK_MISMATCH' ELSE 'MATCHED' END AS issue FROM raw)`;
  } else {
    data = Prisma.sql`
      , relevant AS (
        SELECT j.*, original."sourceType" AS "originalSourceType", original."sourceId" AS "originalSourceId"
        FROM "JournalEntry" j JOIN allowed a ON a.id = j."branchId"
        LEFT JOIN "JournalEntry" original ON original.id = j."reversesId" AND original."branchId" = j."branchId"
        WHERE (COALESCE(original."sourceType", j."sourceType") IN ('JOB_CARD', 'SERVICE_BILL') OR EXISTS (
          SELECT 1 FROM "VendorPaymentDisbursement" p JOIN "VendorPaymentSlip" s ON s.id = p."slipId" AND s.type = 'JOBCARD' AND s."branchId" = j."branchId"
          WHERE p.id = COALESCE(original."sourceId", j."sourceId") AND COALESCE(original."sourceType", j."sourceType") = 'VENDOR_PAYMENT'))
          ${bounds.from ? Prisma.sql`AND j."voucherDate" >= ${bounds.from}` : Prisma.empty}
          ${bounds.toExclusive ? Prisma.sql`AND j."voucherDate" < ${bounds.toExclusive}` : Prisma.empty}
      ), raw AS (
        SELECT j.id, j."voucherNumber" AS "documentNumber", j."branchId", j."voucherDate" AS date, 'PAISE' AS unit,
          j."voucherNumber", j."tallySyncStatus"::text AS "tallySyncStatus",
          CASE WHEN j."reversesId" IS NOT NULL THEN 'REVERSAL' ELSE j.status::text END AS state,
          CASE WHEN j.status = 'POSTED' AND j."reversesId" IS NULL THEN COALESCE(SUM(l."debitPaise"::numeric - l."creditPaise") FILTER (WHERE gl.code = 'REPAIR_EXPENSE'), 0) ELSE 0 END AS actual,
          COALESCE(SUM(l."debitPaise"), 0) = COALESCE(SUM(l."creditPaise"), 0) AND COUNT(l.id) > 0 AS balanced,
          CASE COALESCE(j."originalSourceType", j."sourceType")::text
            WHEN 'JOB_CARD' THEN EXISTS(SELECT 1 FROM "JobCard" c WHERE c.id = COALESCE(j."originalSourceId", j."sourceId") AND c."branchId" = j."branchId") OR EXISTS(SELECT 1 FROM "JobCardRemovedPart" r JOIN "JobCard" c ON c.id = r."jobCardId" WHERE r.id = COALESCE(j."originalSourceId", j."sourceId") AND c."branchId" = j."branchId")
            WHEN 'SERVICE_BILL' THEN EXISTS(SELECT 1 FROM "ServiceBill" b WHERE b.id = COALESCE(j."originalSourceId", j."sourceId") AND b."branchId" = j."branchId") OR EXISTS(SELECT 1 FROM "ServiceBillPayment" p JOIN "ServiceBill" b ON b.id = p."serviceBillId" WHERE p.id = COALESCE(j."originalSourceId", j."sourceId") AND b."branchId" = j."branchId")
            ELSE TRUE END AS linked
        FROM relevant j LEFT JOIN "JournalLine" l ON l."journalEntryId" = j.id LEFT JOIN "Ledger" gl ON gl.id = l."ledgerId"
        GROUP BY j.id, j."voucherNumber", j."branchId", j."voucherDate", j."tallySyncStatus", j."reversesId", j.status, j."originalSourceType", j."sourceType", j."originalSourceId", j."sourceId"
      ), checks AS (
        SELECT *, actual AS expected, CASE WHEN NOT linked THEN 'UNLINKED_SOURCE' WHEN NOT balanced THEN 'UNBALANCED'
          ${filters.mode === "TALLY" ? Prisma.sql`WHEN "tallySyncStatus" <> 'SYNCED' THEN 'TALLY_FOLLOW_UP'` : Prisma.empty}
          ELSE 'MATCHED' END AS issue FROM raw
      )`;
  }
  return Prisma.sql`WITH allowed AS (SELECT br.id, br.name FROM "Branch" br WHERE ${scope} ${filters.branchId ? Prisma.sql`AND br.id = ${filters.branchId}` : Prisma.empty})
    ${data}, filtered AS (
      SELECT c.*, a.name AS "branchName" FROM checks c JOIN allowed a ON a.id = c."branchId" WHERE TRUE
        ${filters.view === "ISSUES" ? Prisma.sql`AND c.issue <> 'MATCHED'` : Prisma.empty}
        ${search ? Prisma.sql`AND (c."documentNumber" ILIKE ${search} OR c.id ILIKE ${search} OR a.name ILIKE ${search})` : Prisma.empty}
    )`;
}

export async function getJobCardAudit(
  filters: Filters,
  branchIds: string[] | null,
) {
  const cte = jobCardAuditCte(filters, branchIds);
  return db.$transaction(
    async (tx) => {
      const [rows, totals] = await Promise.all([
        tx.$queryRaw<
          Row[]
        >(Prisma.sql`${cte} SELECT id, "documentNumber", "branchName", date, unit, state, "voucherNumber", "tallySyncStatus", issue,
        expected::text, actual::text, (expected - actual)::text AS difference FROM filtered ORDER BY date DESC NULLS LAST, id ASC LIMIT ${filters.size} OFFSET ${filters.page * filters.size}`),
        tx.$queryRaw<
          {
            total: number;
            issues: number;
            moneyDifferencePaise: string;
            quantityDifference: string;
            activeExpensePaise: string;
          }[]
        >(Prisma.sql`${cte}
        SELECT COUNT(*)::integer AS total, COUNT(*) FILTER(WHERE issue <> 'MATCHED')::integer AS issues,
          COALESCE(SUM(ABS(expected - actual)) FILTER(WHERE unit = 'PAISE'), 0)::text AS "moneyDifferencePaise",
          COALESCE(SUM(ABS(expected - actual)) FILTER(WHERE unit = 'QTY'), 0)::text AS "quantityDifference",
          COALESCE(SUM(actual) FILTER(WHERE unit = 'PAISE' AND state = 'POSTED'), 0)::text AS "activeExpensePaise" FROM filtered`),
      ]);
      const { total, ...summary } = totals[0]!;
      return { rows, total, summary, page: filters.page, size: filters.size };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15000,
    },
  );
}
