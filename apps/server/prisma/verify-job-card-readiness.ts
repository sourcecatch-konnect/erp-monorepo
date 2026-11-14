import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { Client } from "pg";

// This command never applies migrations or changes application data.
const output = new URL(
  "../../../docs/qa/job-card-db-readiness.json",
  import.meta.url,
);
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  mode: "READ_ONLY",
  applicationDataChanged: false,
  liveConcurrencyVerified: false,
  representativePerformanceVerified: false,
};
const client = url
  ? new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    })
  : null;
let failed = false;
try {
  if (!client)
    throw Object.assign(new Error("Database connection not configured"), {
      code: "NOT_CONFIGURED",
    });
  await client.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '10s'");
  const server = await client.query<{
    version: string;
    can_create_schema: boolean;
  }>(
    "SELECT current_setting('server_version') AS version, has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema",
  );
  report.postgresVersion = server.rows[0]!.version;
  report.isolatedSchemaTestingAvailable = server.rows[0]!.can_create_schema;
  const migrationTable = await client.query<{ present: boolean }>(
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present",
  );
  const history = migrationTable.rows[0]!.present
    ? await client.query<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
      }>(
        'SELECT migration_name, checksum, finished_at FROM "public"."_prisma_migrations" WHERE rolled_back_at IS NULL',
      )
    : { rows: [] };
  const migrationRoot = new URL("./migrations/", import.meta.url);
  const localNames = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expected = localNames.filter((name) =>
    /job_card|service_bill|removed_part/.test(name),
  );
  const applied = history.rows.filter((row) => row.finished_at !== null);
  const appliedNames = new Set(applied.map((row) => row.migration_name));
  const localSet = new Set(localNames);
  const unknownApplied = applied
    .filter((row) => !localSet.has(row.migration_name))
    .map((row) => row.migration_name);
  const checksumMismatches: string[] = [];
  for (const row of applied) {
    if (!localSet.has(row.migration_name)) continue;
    const bytes = await readFile(
      new URL(`${row.migration_name}/migration.sql`, migrationRoot),
    );
    // Prisma accepts platform line-ending variants when checking migration history.
    const sql = bytes.toString("utf8");
    const variants = [
      sql,
      sql.replace(/\r\n/g, "\n"),
      sql.replace(/\r?\n/g, "\r\n"),
    ];
    if (
      !variants.some(
        (value) =>
          createHash("sha256").update(value).digest("hex") === row.checksum,
      )
    )
      checksumMismatches.push(row.migration_name);
  }
  const unfinished = history.rows
    .filter((row) => row.finished_at === null)
    .map((row) => row.migration_name);
  report.migrationHistory = {
    unknownApplied,
    checksumMismatches,
    unfinished,
    allPending: localNames.filter((name) => !appliedNames.has(name)),
  };
  const historyNeedsReview =
    unknownApplied.length + checksumMismatches.length + unfinished.length > 0;
  report.migrations = expected.map((name) => ({
    name,
    applied: appliedNames.has(name),
  }));
  report.missingMigrations = expected.filter((name) => !appliedNames.has(name));
  const columns = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('Vehicle', 'JobCard', 'JobCardRepairControl', 'JobCardRepairEvent', 'JobCardRemovedPart', 'JobCardRemovedPartEvent', 'ServiceBillLine', 'VendorPaymentDisbursement')",
  );
  const present = new Set(
    columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const required = [
    "Vehicle.maintenanceHold",
    "JobCard.repairControlRequired",
    "JobCardRepairControl.status",
    "JobCardRepairEvent.clientRequestId",
    "JobCardRemovedPart.lifecycleStatus",
    "JobCardRemovedPartEvent.clientRequestId",
    "ServiceBillLine.netAmountPaise",
    "VendorPaymentDisbursement.reversalJournalEntryId",
  ];
  report.schemaChecks = required.map((column) => ({
    column,
    present: present.has(column),
  }));
  // Aggregate-only preflight: no provider names, document IDs or business rows
  // are written to the evidence file. These columns predate the finance upgrade.
  const preflight = await client.query<{
    duplicateInvoiceGroups: number;
    inconsistentBillTotals: number;
    draftCardsForOperationalReview: number;
    cancelledBillsWithoutRetainedLines: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::integer FROM (
        SELECT 1 FROM public."ServiceBill" WHERE "status" <> 'CANCELLED'
        GROUP BY "serviceProviderId", "fyCode", lower(btrim("providerInvoiceNo"))
        HAVING COUNT(*) > 1
      ) duplicates) AS "duplicateInvoiceGroups",
      (SELECT COUNT(*)::integer FROM (
        SELECT b."id" FROM public."ServiceBill" b
        LEFT JOIN public."ServiceBillLine" l ON l."serviceBillId" = b."id"
        GROUP BY b."id"
        HAVING (COUNT(l."id") > 0 OR b."status" = 'POSTED') AND (
          COALESCE(SUM(l."amountPaise"), 0) <> b."grossAmountPaise"
          OR b."discountPaise" < 0 OR b."discountPaise" > b."grossAmountPaise"
          OR b."netAmountPaise" <> b."grossAmountPaise" - b."discountPaise"
        )
      ) inconsistent) AS "inconsistentBillTotals",
      (SELECT COUNT(*)::integer FROM public."JobCard" WHERE "status" = 'DRAFT')
        AS "draftCardsForOperationalReview",
      (SELECT COUNT(*)::integer FROM public."ServiceBill" b
        WHERE b."status" = 'CANCELLED' AND NOT EXISTS (
          SELECT 1 FROM public."ServiceBillLine" l WHERE l."serviceBillId" = b."id"
        )) AS "cancelledBillsWithoutRetainedLines"
  `);
  report.preflight = preflight.rows[0];
  report.knownMigrationDataBlockers =
    preflight.rows[0]!.duplicateInvoiceGroups +
    preflight.rows[0]!.inconsistentBillTotals;
  report.financeSignOff = "NOT_RECORDED";
  report.rolloutApproved = false;
  report.status = historyNeedsReview
    ? "MIGRATION_HISTORY_REVIEW_REQUIRED"
    : required.every((column) => present.has(column)) &&
        localNames.every((name) => appliedNames.has(name))
      ? report.knownMigrationDataBlockers === 0
        ? "SCHEMA_READY"
        : "DATA_REVIEW_REQUIRED"
      : "MIGRATIONS_PENDING";
  report.verificationSchemasRemaining = (
    await client.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM pg_namespace WHERE nspname LIKE 'jc_verify_%'",
    )
  ).rows[0]!.count;
  await client.query("ROLLBACK");
} catch (error) {
  failed = true;
  report.status = "CONNECTION_OR_READINESS_CHECK_FAILED";
  // Never print URLs, passwords, hostnames, or raw connection errors.
  report.errorCode =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";
} finally {
  if (client) await client.end().catch(() => undefined);
  await mkdir(new URL("../../../docs/qa/", import.meta.url), {
    recursive: true,
  });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
else if (report.status !== "SCHEMA_READY") process.exitCode = 2;
