import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/index.js";

if (process.env.JOBCARD_ALLOW_ISOLATED_SCHEMA_TEST !== "1")
  throw new Error(
    "Set JOBCARD_ALLOW_ISOLATED_SCHEMA_TEST=1 to authorise disposable-schema tests. Public application tables are never test targets.",
  );
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("PostgreSQL connection is not configured");
const schema = `jc_verify_20261114_${randomBytes(6).toString("hex")}`;
if (!/^jc_verify_20261114_[a-f0-9]{12}$/.test(schema))
  throw new Error("Unsafe test schema");
const admin = new Client({
  connectionString,
  connectionTimeoutMillis: 5000,
  query_timeout: 120000,
});
const scopedUrl = new URL(connectionString);
const safeError = (error: unknown) => {
  let message = error instanceof Error ? error.message : "Check failed";
  for (const value of [
    connectionString,
    scopedUrl.hostname,
    decodeURIComponent(scopedUrl.password),
  ])
    if (value) message = message.replaceAll(value, "[redacted]");
  return message.slice(0, 1000);
};
scopedUrl.searchParams.set(
  "options",
  `-c search_path=${schema} -c timezone=UTC`,
);
const db = new PrismaClient({
  adapter: new PrismaPg(
    {
      connectionString: scopedUrl.toString(),
      max: 8,
      connectionTimeoutMillis: 10000,
    },
    { schema },
  ),
});
const report: {
  checkedAt: string;
  applicationDataChanged: boolean;
  testSchemaDropped: boolean;
  status: string;
  migrations: string[];
  checks: {
    name: string;
    status: string;
    durationMs: number;
    error?: string;
  }[];
  plans: unknown[];
} = {
  checkedAt: new Date().toISOString(),
  applicationDataChanged: false,
  testSchemaDropped: false,
  status: "RUNNING",
  migrations: [],
  checks: [],
  plans: [],
};
let phase = "connect";
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const migrationRoot = new URL("./migrations/", import.meta.url);
const migrationSql = (name: string) =>
  readFile(new URL(`${name}/migration.sql`, migrationRoot), "utf8");
const check = async (name: string, work: () => Promise<unknown>) => {
  phase = name;
  const start = performance.now();
  try {
    await work();
    report.checks.push({
      name,
      status: "PASSED",
      durationMs: Math.round(performance.now() - start),
    });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({
      name,
      status: "FAILED",
      durationMs: Math.round(performance.now() - start),
      error: safeError(error),
    });
    throw error;
  }
};
async function seed(table: string, data: Record<string, unknown>) {
  // Only synthetic rows, explicitly schema-qualified. Fill mandatory scalar
  // metadata so unrelated catalogue additions do not require production data.
  const columns = await admin.query<{
    column_name: string;
    data_type: string;
    udt_name: string;
  }>(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_nullable='NO' AND column_default IS NULL",
    [schema, table],
  );
  for (const column of columns.rows)
    if (!(column.column_name in data)) {
      if (column.data_type.includes("timestamp") || column.data_type === "date")
        data[column.column_name] = new Date("2026-11-14T08:00:00Z");
      else if (
        ["integer", "bigint", "double precision", "numeric", "real"].includes(
          column.data_type,
        )
      )
        data[column.column_name] = 0;
      else if (column.data_type === "boolean") data[column.column_name] = false;
      else if (column.data_type === "USER-DEFINED") {
        const labels = await admin.query<{ enumlabel: string }>(
          "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typname=$2 ORDER BY e.enumsortorder LIMIT 1",
          [schema, column.udt_name],
        );
        data[column.column_name] = labels.rows[0]!.enumlabel;
      } else if (column.data_type === "jsonb") data[column.column_name] = {};
      else
        data[column.column_name] =
          `synthetic-${table}-${column.column_name}-${data.id ?? randomUUID()}`;
    }
  const keys = Object.keys(data);
  await admin.query(
    `INSERT INTO ${quote(schema)}.${quote(table)} (${keys.map(quote).join(",")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(",")})`,
    keys.map((key) =>
      data[key] instanceof Date ? data[key].toISOString() : data[key],
    ),
  );
}
const id = {
  company: "test-company",
  branch: "test-branch",
  branch2: "test-other-branch",
  role: "test-role",
  user: randomUUID(),
  reviewer: randomUUID(),
  city: "test-city",
  state: "test-state",
  vehicleType: "test-type",
  vehicle: "test-vehicle",
  driver: "test-driver",
  provider: "test-provider",
  category: "test-category",
  part: "test-part",
  batch: "test-batch",
};
const cardData = (cardId: string, extra: Record<string, unknown> = {}) => ({
  id: cardId,
  jobCardNumber: `JC/${cardId}`,
  fyCode: "26-27",
  branchId: id.branch,
  vehicleId: id.vehicle,
  driverId: id.driver,
  truckStatus: "AT_HO",
  inDateTime: new Date("2026-11-14T08:00:00Z"),
  openingKm: 100,
  createdById: id.user,
  ...extra,
});
const txOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  timeout: 30000,
  maxWait: 10000,
};

try {
  await admin.connect();
  await check(
    "Clone schema metadata only; public application data stays untouched",
    async () => {
      const baseline = await readFile(
        new URL("./job-card-verification-baseline.tmp.sql", import.meta.url),
        "utf8",
      );
      if (/\b(?:DROP|TRUNCATE|GRANT|REVOKE)\s/i.test(baseline))
        throw new Error("Baseline must be an empty-to-schema CREATE script");
      const isolated = baseline.replaceAll('"public"', quote(schema));
      if (/\bpublic\s*\./i.test(isolated))
        throw new Error("Unqualified public target in baseline");
      await admin.query(isolated);
      await admin.query(`SET search_path TO ${quote(schema)}`);
      await admin.query("SET timezone TO 'UTC'");
      const checks = await admin.query<{
        table_name: string;
        conname: string;
        definition: string;
      }>(
        "SELECT c.relname AS table_name, co.conname, pg_get_constraintdef(co.oid) AS definition FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND co.contype='c'",
      );
      for (const constraint of checks.rows) {
        const exists = await admin.query(
          "SELECT 1 FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2 AND co.conname=$3",
          [schema, constraint.table_name, constraint.conname],
        );
        if (!exists.rowCount)
          await admin.query(
            `ALTER TABLE ${quote(schema)}.${quote(constraint.table_name)} ADD CONSTRAINT ${quote(constraint.conname)} ${constraint.definition.replaceAll('"public".', `${quote(schema)}.`).replaceAll("public.", `${quote(schema)}.`)}`,
          );
      }
    },
  );
  await check(
    "Seed synthetic pre-upgrade cards and multi-line discounted bill",
    async () => {
      await seed("Company", {
        id: id.company,
        name: "Synthetic QA company",
        country: "India",
      });
      await seed("Branch", {
        id: id.branch,
        name: "Synthetic HO",
        branchCode: "QA",
        companyId: id.company,
      });
      await seed("Branch", {
        id: id.branch2,
        name: "Synthetic restricted branch",
        branchCode: "QA2",
        companyId: id.company,
      });
      await seed("Role", { id: id.role, name: "Synthetic QA role" });
      for (const userId of [id.user, id.reviewer])
        await seed("User", {
          id: userId,
          companyId: id.company,
          branchId: id.branch,
          roleId: id.role,
          status: true,
          firstName: "Synthetic",
          lastName: "Reviewer",
        });
      await seed("State", { id: id.state, name: "Synthetic state" });
      await seed("City", {
        id: id.city,
        name: "Synthetic city",
        stateId: id.state,
      });
      await seed("VehicleType", {
        id: id.vehicleType,
        code: "QA",
        name: "Synthetic vehicle type",
      });
      await seed("Vehicle", {
        id: id.vehicle,
        vehicleNumber: "QA-VEHICLE",
        vehicleTypeId: id.vehicleType,
        capacityMT: 10,
        currentKM: 100,
        openingKM: 0,
        ownershipType: "Own_Vehicle",
      });
      await seed("Driver", {
        id: id.driver,
        name: "Synthetic driver",
        type: "Permanent",
      });
      await seed("SparePartSupplier", {
        id: id.provider,
        name: "Synthetic provider",
        type: "Both",
        cityId: id.city,
      });
      await seed("SpareCategory", { id: id.category, name: "Synthetic parts" });
      await seed("SparePart", {
        id: id.part,
        name: "Synthetic part",
        type: "Item",
        categoryId: id.category,
        supplierId: id.provider,
        rate: 100,
        minimumStock: 0,
        unit: "Each",
      });
      await seed("SpareBatch", {
        id: id.batch,
        sparePartId: id.part,
        supplierId: id.provider,
        branchId: id.branch,
        qtyReceived: 5,
        qtyRemaining: 5,
        unitCostPaise: 100,
      });
      await seed("StockLedger", {
        id: "test-stock",
        sparePartId: id.part,
        branchId: id.branch,
        currentQty: 5,
        movingAvgCostPaise: 100,
      });
      await seed(
        "JobCard",
        cardData("legacy", {
          status: "FINALISED",
          outDateTime: new Date("2026-11-14T09:00:00Z"),
        }),
      );
      await seed("ServiceBill", {
        id: "legacy-bill",
        serviceBillNumber: "SB/LEGACY",
        fyCode: "26-27",
        branchId: id.branch,
        serviceProviderId: id.provider,
        status: "POSTED",
        billDate: new Date("2026-11-14"),
        providerInvoiceNo: "LEGACY",
        grossAmountPaise: 1000,
        discountPaise: 101,
        netAmountPaise: 899,
        paidAmountPaise: 0,
        createdById: id.user,
      });
      for (const lineId of ["legacy-a", "legacy-b"]) {
        await seed("JobCardServiceLine", {
          id: lineId,
          jobCardId: "legacy",
          serviceProviderId: id.provider,
          sparePartId: id.part,
          qty: 1,
          ratePaise: 500,
          amountPaise: 500,
          billedInServiceBillId: "legacy-bill",
        });
        await seed("ServiceBillLine", {
          id: `bill-${lineId}`,
          serviceBillId: "legacy-bill",
          jobCardServiceLineId: lineId,
          amountPaise: 500,
        });
      }
      await seed("JobCardRemovedPart", {
        id: "legacy-scrap",
        jobCardId: "legacy",
        sparePartId: id.part,
        qty: 1,
        condition: "SCRAP",
        createdById: id.user,
      });
    },
  );
  const migrations = (await readdir(migrationRoot))
    .filter(
      (name) =>
        /^2026111[23]/.test(name) &&
        /job_card|service_bill|removed_part/.test(name),
    )
    .sort();
  for (const migration of migrations)
    await check(`Migration ${migration}`, async () => {
      const sql = await migrationSql(migration);
      if (/"public"\s*\.|\bpublic\s*\./i.test(sql))
        throw new Error(
          "Migration has an explicit public target; isolated replay refused",
        );
      if (migration.includes("cost_allocations")) {
        await admin.query(
          'UPDATE "ServiceBill" SET "grossAmountPaise"=1001 WHERE id=\'legacy-bill\'',
        );
        await assert.rejects(admin.query(sql));
        await admin.query("ROLLBACK");
        await admin.query(
          'UPDATE "ServiceBill" SET "grossAmountPaise"=1000 WHERE id=\'legacy-bill\'',
        );
      }
      if (migration.includes("create_safety")) {
        await seed("ServiceBill", {
          id: "legacy-duplicate",
          serviceBillNumber: "SB/LEGACY-DUP",
          fyCode: "26-27",
          branchId: id.branch2,
          serviceProviderId: id.provider,
          status: "POSTED",
          billDate: new Date("2026-11-14"),
          providerInvoiceNo: " legacy ",
          grossAmountPaise: 1000,
          discountPaise: 101,
          netAmountPaise: 899,
          createdById: id.user,
        });
        await assert.rejects(admin.query(sql));
        await admin.query("ROLLBACK");
        await admin.query(
          "DELETE FROM \"ServiceBill\" WHERE id='legacy-duplicate'",
        );
      }
      await admin.query(sql);
      report.migrations.push(migration);
    });
  await check(
    "Discount backfill keeps every paise and immutable vehicle attribution",
    async () => {
      const lines = await admin.query<{
        discount: string;
        net: string;
        card: string;
      }>(
        'SELECT "discountPaise"::text AS discount, "netAmountPaise"::text AS net, "jobCardIdSnapshot" AS card FROM "ServiceBillLine" ORDER BY id',
      );
      assert.equal(
        lines.rows.reduce((sum, row) => sum + BigInt(row.discount), 0n),
        101n,
      );
      assert.equal(
        lines.rows.reduce((sum, row) => sum + BigInt(row.net), 0n),
        899n,
      );
      assert.ok(lines.rows.every((row) => row.card === "legacy"));
      const legacy = await admin.query<{
        lifecycleStatus: string;
        approvedById: string | null;
        repairControlRequired: boolean;
      }>(
        'SELECT r."lifecycleStatus", r."approvedById", c."repairControlRequired" FROM "JobCardRemovedPart" r JOIN "JobCard" c ON c.id=r."jobCardId" WHERE r.id=\'legacy-scrap\'',
      );
      assert.equal(legacy.rows[0]!.lifecycleStatus, "HELD");
      assert.equal(legacy.rows[0]!.approvedById, null);
      assert.equal(legacy.rows[0]!.repairControlRequired, false);
      assert.equal(
        (
          await admin.query(
            "SELECT id FROM \"JobCardRemovedPartEvent\" WHERE \"removedPartId\"='legacy-scrap' AND action='LEGACY_BASELINE'",
          )
        ).rowCount,
        1,
      );
    },
  );
  // Inject only this process's explicitly isolated client before report modules
  // load their shared db singleton. ORM schema and raw-SQL search_path agree.
  (globalThis as unknown as { prisma: PrismaClient }).prisma = db;
  process.env.DATABASE_URL = scopedUrl.toString();
  const { createJobCardOnceTx } =
    await import("../src/modules/job-card/job-card-create-request.service.js");
  const { finaliseJobCardTx } =
    await import("../src/modules/job-card/job-card.service.js");
  const { createRemovedPartTx } =
    await import("../src/modules/job-card/job-card-removed-part.service.js");
  const { actOnRemovedPartTx } =
    await import("../src/modules/job-card/removed-part-lifecycle.service.js");
  const { createServiceBillTx } =
    await import("../src/modules/service-bill/service-bill.service.js");
  const { createJobCardPaymentSlipTx, settleJobCardBillTx } =
    await import("../src/modules/vendor-payment/job-card-payment.service.js");
  const { reverseJobCardSettlementTx } =
    await import("../src/modules/vendor-payment/job-card-reversal.service.js");
  const { postJobCardDisbursement } =
    await import("../src/modules/ledger/posting.service.js");
  const { actOnRepairTx, assertVehicleDispatchableTx } =
    await import("../src/modules/job-card/job-card-repair.service.js");
  const validators = await import("@skerp/validators");
  for (const ledger of [
    { id: "qa-expense", code: "REPAIR_EXPENSE", group: "INDIRECT_EXPENSE" },
    {
      id: "qa-inventory",
      code: "SPARE_PARTS_INVENTORY",
      group: "CURRENT_ASSET",
    },
    { id: "qa-tds", code: "TDS_PAYABLE", group: "DUTIES_AND_TAXES" },
    { id: "qa-bank", code: "QA_BANK", group: "BANK" },
  ])
    await seed("Ledger", { ...ledger, kind: "GL", name: ledger.code });
  await check(
    "Concurrent identical create requests return one card",
    async () => {
      const input = { clientRequestId: randomUUID(), branchId: id.branch };
      const create = () =>
        db.$transaction(
          (tx) =>
            createJobCardOnceTx(tx, input, id.user, "DRAFT", (identity) =>
              tx.jobCard.create({
                data: {
                  ...cardData("once"),
                  ...identity,
                } as Prisma.JobCardUncheckedCreateInput,
                select: { id: true },
              }),
            ),
          txOptions,
        );
      const rows = await Promise.all([create(), create()]);
      assert.equal(rows[0].id, rows[1].id);
      assert.equal(
        await db.jobCard.count({
          where: { clientRequestId: input.clientRequestId },
        }),
        1,
      );
    },
  );
  await check(
    "Concurrent stock finalisations cannot over-issue and failed transactions roll back",
    async () => {
      await db.spareBatch.update({
        where: { id: id.batch },
        data: { qtyRemaining: 1 },
      });
      await db.stockLedger.update({
        where: { id: "test-stock" },
        data: { currentQty: 1 },
      });
      for (const number of [1, 2]) {
        await seed(
          "JobCard",
          cardData(`issue-${number}`, { repairControlRequired: false }),
        );
        await seed("JobCardPartLine", {
          id: `issue-line-${number}`,
          jobCardId: `issue-${number}`,
          sparePartId: id.part,
          batchId: id.batch,
          qty: 1,
          unitCostPaise: 0,
          amountPaise: 0,
        });
      }
      const run = async (cardId: string) => {
        const card = await db.jobCard.findUniqueOrThrow({
          where: { id: cardId },
          include: { partLines: true, serviceLines: true },
        });
        return db.$transaction(
          (tx) =>
            finaliseJobCardTx(
              tx,
              card,
              { outDateTime: new Date("2026-11-14T09:00:00Z"), closingKm: 110 },
              id.user,
            ),
          txOptions,
        );
      };
      const attempts = await Promise.allSettled([
        run("issue-1"),
        run("issue-2"),
      ]);
      assert.equal(
        attempts.filter((row) => row.status === "fulfilled").length,
        1,
        attempts
          .filter((row) => row.status === "rejected")
          .map((row) =>
            row.reason instanceof Error ? row.reason.message : "Rejected",
          )
          .join("\n"),
      );
      assert.equal(
        (await db.spareBatch.findUniqueOrThrow({ where: { id: id.batch } }))
          .qtyRemaining,
        0,
      );
      assert.equal(
        await db.jobCard.count({
          where: {
            id: { in: ["issue-1", "issue-2"] },
            status: "DRAFT",
            version: 1,
          },
        }),
        1,
      );
      assert.equal(
        await db.stockMovement.count({ where: { refType: "JOB_CARD" } }),
        1,
      );
    },
  );
  await check(
    "Return posting failure rolls back stock, status and event; replay posts once",
    async () => {
      const input = validators.createJobCardRemovedPartSchema.parse({
        clientRequestId: randomUUID(),
        sparePartId: id.part,
        qty: 1,
        condition: "REUSABLE",
        unitCostPaise: "50",
        custodyLocation: "Quarantine",
        provenanceReference: "Synthetic inspection",
      });
      const removed = await db.$transaction(
        (tx) => createRemovedPartTx(tx, "legacy", id.branch, input, id.user),
        txOptions,
      );
      const action = validators.removedPartActionSchema.parse({
        clientRequestId: randomUUID(),
        version: 1,
        action: "APPROVE_STOCK",
        unitCostPaise: "50",
        reason: "Synthetic approval",
        evidence: "QA inspection",
        custodyLocation: "Stock bay",
      });
      const before = await db.spareBatch.count();
      await db.ledger.update({
        where: { id: "qa-expense" },
        data: { code: "DISABLED_FOR_ROLLBACK_TEST" },
      });
      await assert.rejects(
        db.$transaction(
          (tx) =>
            actOnRemovedPartTx(
              tx,
              "legacy",
              removed.id,
              id.branch,
              action,
              id.reviewer,
            ),
          txOptions,
        ),
      );
      assert.equal(await db.spareBatch.count(), before);
      assert.equal(
        (
          await db.jobCardRemovedPart.findUniqueOrThrow({
            where: { id: removed.id },
          })
        ).lifecycleStatus,
        "PENDING_APPROVAL",
      );
      await db.ledger.update({
        where: { id: "qa-expense" },
        data: { code: "REPAIR_EXPENSE" },
      });
      for (let repeat = 0; repeat < 2; repeat++)
        await db.$transaction(
          (tx) =>
            actOnRemovedPartTx(
              tx,
              "legacy",
              removed.id,
              id.branch,
              action,
              id.reviewer,
            ),
          txOptions,
        );
      assert.equal(await db.spareBatch.count(), before + 1);
      assert.equal(
        await db.jobCardRemovedPartEvent.count({
          where: { removedPartId: removed.id, action: "APPROVE_STOCK" },
        }),
        1,
      );
    },
  );
  let payableBill = "";
  await check(
    "Concurrent duplicate provider invoices across cards are rejected by the database",
    async () => {
      for (const number of [1, 2]) {
        await seed(
          "JobCard",
          cardData(`bill-card-${number}`, {
            status: "FINALISED",
            outDateTime: new Date("2026-11-14T09:00:00Z"),
          }),
        );
        await seed("JobCardServiceLine", {
          id: `bill-source-${number}`,
          jobCardId: `bill-card-${number}`,
          serviceProviderId: id.provider,
          sparePartId: id.part,
          qty: 1,
          ratePaise: 500,
          amountPaise: 500,
        });
      }
      const run = (number: number) =>
        db.$transaction(
          (tx) =>
            createServiceBillTx(
              tx,
              validators.createServiceBillSchema.parse({
                branchId: id.branch,
                serviceProviderId: id.provider,
                billDate: "2026-11-14",
                providerInvoiceNo: number === 1 ? " QA-DUP " : "qa-dup",
                jobCardServiceLineIds: [`bill-source-${number}`],
              }),
              "QA",
              id.user,
            ),
          txOptions,
        );
      const attempts = await Promise.allSettled([run(1), run(2)]);
      const winner = attempts.find((row) => row.status === "fulfilled");
      assert.ok(winner?.status === "fulfilled");
      payableBill = winner.value.id;
      assert.equal(
        attempts.filter((row) => row.status === "rejected").length,
        1,
      );
    },
  );
  await check(
    "TDS-only settlement and idempotent reversal retain balanced vouchers and correct counters",
    async () => {
      const slipRef = await db.$transaction(
        (tx) => createJobCardPaymentSlipTx(tx, payableBill, id.branch, id.user),
        txOptions,
      );
      await db.vendorPaymentSlip.update({
        where: { id: slipRef.id },
        data: { status: "APPROVED" },
      });
      const pay = async (cash: bigint, tds: bigint) =>
        db.$transaction(async (tx) => {
          const lockKey = `vendor-payment-slip:${slipRef.id}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
          const slip = await tx.vendorPaymentSlip.findUniqueOrThrow({
            where: { id: slipRef.id },
          });
          const bill = await settleJobCardBillTx(tx, slip, cash, tds);
          const payment = await tx.vendorPaymentDisbursement.create({
            data: {
              slipId: slip.id,
              paidPaise: cash,
              tdsPaise: tds,
              fundingLedgerId: "qa-bank",
              mode: "BANK",
              paidAt: new Date(),
              clientRequestId: randomUUID(),
              createdById: id.user,
            },
          });
          const journal = await postJobCardDisbursement(tx, {
            disbursementId: payment.id,
            voucherNumber: `QA/PAY/${payment.id}`,
            slipId: slip.id,
            slipNumber: slip.slipNumber,
            paidAt: payment.paidAt,
            branchId: id.branch,
            fyCode: "26-27",
            transportId: null,
            labourId: null,
            fundingLedgerId: "qa-bank",
            paidPaise: cash,
            tdsPaise: tds,
            serviceProviderId: bill.serviceProviderId,
            createdById: id.user,
          });
          await tx.vendorPaymentDisbursement.update({
            where: { id: payment.id },
            data: { settlementJournalEntryId: journal.id },
          });
          await tx.vendorPaymentSlip.update({
            where: { id: slip.id },
            data: {
              paidPaise: { increment: cash + tds },
              status:
                cash + tds === slip.netPayablePaise - slip.paidPaise
                  ? "PAID"
                  : "PARTIALLY_PAID",
              version: { increment: 1 },
            },
          });
          return { payment, journal };
        }, txOptions);
      const first = await pay(0n, 50n);
      assert.equal(
        await db.journalLine.count({
          where: { journalEntryId: first.journal.id },
        }),
        2,
      );
      for (let repeat = 0; repeat < 2; repeat++)
        await db.$transaction(
          (tx) =>
            reverseJobCardSettlementTx(
              tx,
              {
                slipId: slipRef.id,
                paymentId: first.payment.id,
                branchId: id.branch,
                reason: "Synthetic reversal",
              },
              id.reviewer,
            ),
          txOptions,
        );
      assert.equal(
        (await db.serviceBill.findUniqueOrThrow({ where: { id: payableBill } }))
          .paidAmountPaise,
        0n,
      );
      const attempts = await Promise.allSettled([pay(500n, 0n), pay(500n, 0n)]);
      assert.equal(
        attempts.filter((row) => row.status === "fulfilled").length,
        1,
      );
      assert.equal(
        (await db.serviceBill.findUniqueOrThrow({ where: { id: payableBill } }))
          .paidAmountPaise,
        500n,
      );
    },
  );
  await check(
    "Concurrent in-transit repairs retain hold until every card is cleared; dispatch is blocked",
    async () => {
      await db.vehicle.update({
        where: { id: id.vehicle },
        data: { status: "ON_TRIP" },
      });
      for (const number of [1, 2])
        await seed(
          "JobCard",
          cardData(`repair-${number}`, { truckStatus: "IN_TRANSIT" }),
        );
      const inspection = {
        brakes: "PASS",
        steering: "PASS",
        tyres: "PASS",
        lights: "PASS",
        leaks: "NA",
        reference: "QA-TECH",
        notes: "",
      } as const;
      const start = (number: number, version = 0) =>
        db.$transaction(
          (tx) =>
            actOnRepairTx(
              tx,
              `repair-${number}`,
              id.branch,
              validators.repairControlActionSchema.parse({
                clientRequestId: randomUUID(),
                version,
                action: "START",
                reason: "Synthetic repair",
                replacementIntent: "Inspection only",
                inspection,
              }),
              id.user,
            ),
          txOptions,
        );
      await Promise.all([start(1), start(2)]);
      await assert.rejects(
        db.$transaction(
          (tx) => assertVehicleDispatchableTx(tx, id.vehicle),
          txOptions,
        ),
      );
      const release = (number: number, version = 1) =>
        db.$transaction(
          (tx) =>
            actOnRepairTx(
              tx,
              `repair-${number}`,
              id.branch,
              validators.repairControlActionSchema.parse({
                clientRequestId: randomUUID(),
                version,
                action: "RELEASE",
                reason: "Cleared",
                release: { ...inspection, roadworthyConfirmed: true },
              }),
              id.reviewer,
            ),
          txOptions,
        );
      await release(1);
      assert.equal(
        (await db.vehicle.findUniqueOrThrow({ where: { id: id.vehicle } }))
          .maintenanceHold,
        true,
      );
      await release(2);
      assert.equal(
        (await db.vehicle.findUniqueOrThrow({ where: { id: id.vehicle } }))
          .maintenanceHold,
        false,
      );
      assert.equal(
        (await db.vehicle.findUniqueOrThrow({ where: { id: id.vehicle } }))
          .status,
        "ON_TRIP",
      );
      await Promise.all([start(1, 2), start(2, 2)]);
      await Promise.all([release(1, 3), release(2, 3)]);
      assert.equal(
        (await db.vehicle.findUniqueOrThrow({ where: { id: id.vehicle } }))
          .maintenanceHold,
        false,
      );
    },
  );
  await check(
    "Synthetic 10,000-card pagination, branch isolation and real report SQL",
    async () => {
      await admin.query(
        `INSERT INTO "JobCard" (id, "jobCardNumber", "fyCode", "branchId", "vehicleId", "driverId", "truckStatus", "inDateTime", "outDateTime", "openingKm", status, "createdById", "updatedAt") SELECT 'scale-'||n, 'QA-SCALE-'||n, '26-27', $1, $2, $3, 'AT_HO', '2026-11-13T18:30:00Z'::timestamptz, '2026-11-14T08:00:00Z'::timestamptz, 100, 'FINALISED', $4, now() FROM generate_series(1,10000) n`,
        [id.branch, id.vehicle, id.driver, id.user],
      );
      await admin.query(
        `INSERT INTO "JobCardServiceLine" (id, "jobCardId", "serviceProviderId", "sparePartId", qty, "ratePaise", "amountPaise") SELECT 'scale-service-'||n, 'scale-'||n, $1, $2, 1, 100, 100 FROM generate_series(1,10000) n`,
        [id.provider, id.part],
      );
      for (const table of [
        "JobCard",
        "JobCardServiceLine",
        "ServiceBill",
        "ServiceBillLine",
        "StockMovement",
        "JournalEntry",
        "JournalLine",
      ])
        await admin.query(`ANALYZE ${quote(schema)}.${quote(table)}`);
      const { getJobCardRepairCosts } =
        await import("../src/modules/job-card/job-card-report.service.js");
      const { getUnbilledServiceReport } =
        await import("../src/modules/service-bill/unbilled-service-report.service.js");
      const { getServiceBillOutstanding } =
        await import("../src/modules/service-bill/service-bill-report.service.js");
      const { getJobCardReconciliation } =
        await import("../src/modules/job-card/job-card-reconciliation.service.js");
      const { getJobCardAudit } =
        await import("../src/modules/job-card/job-card-audit.service.js");
      const filter = { page: 2, size: 20, search: "QA-SCALE" };
      const page = await getUnbilledServiceReport(filter, [id.branch]);
      assert.equal(page.rows.length, 20);
      assert.equal(page.total, 10000);
      assert.equal(page.summary.amountPaise, "1000000");
      assert.equal((await getUnbilledServiceReport(filter, [])).total, 0);
      assert.equal(
        (await getJobCardRepairCosts(filter, [id.branch2])).total,
        0,
      );
      assert.equal(
        (await getJobCardRepairCosts(filter, [id.branch])).rows.length,
        20,
      );
      await getServiceBillOutstanding({ page: 0, size: 20 }, [id.branch]);
      await getJobCardReconciliation({ page: 0, size: 20, view: "ALL" }, [
        id.branch,
      ]);
      for (const mode of ["STOCK", "SETTLEMENTS", "POSTINGS", "TALLY"] as const)
        await getJobCardAudit({ page: 0, size: 20, view: "ALL", mode }, [
          id.branch,
        ]);
      const { repairCostCte } =
        await import("../src/modules/job-card/job-card-report.query.js");
      const { unbilledReportCte } =
        await import("../src/modules/service-bill/unbilled-service-report.service.js");
      const { jobCardAuditCte } =
        await import("../src/modules/job-card/job-card-audit.service.js");
      for (const [name, cte] of [
        ["repair-cost", repairCostCte(filter, [id.branch])],
        ["unbilled", unbilledReportCte(filter, [id.branch])],
        [
          "settlement-audit",
          jobCardAuditCte(
            { page: 0, size: 20, view: "ALL", mode: "SETTLEMENTS" },
            [id.branch],
          ),
        ],
      ] as const) {
        const table =
          name === "repair-cost"
            ? "costs"
            : name === "unbilled"
              ? "eligible"
              : "filtered";
        const sql = Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${cte} SELECT * FROM ${Prisma.raw(table)} LIMIT 20`;
        const plan = await admin.query(sql.text, sql.values);
        report.plans.push({
          name,
          syntheticCards: 10000,
          plan: plan.rows[0]["QUERY PLAN"],
        });
      }
    },
  );
  await check(
    "India end-day cutoffs and every bill-age boundary execute correctly in PostgreSQL",
    async () => {
      const { getUnbilledServiceReport } =
        await import("../src/modules/service-bill/unbilled-service-report.service.js");
      const { getJobCardRepairCosts } =
        await import("../src/modules/job-card/job-card-report.service.js");
      const { getServiceBillOutstanding } =
        await import("../src/modules/service-bill/service-bill-report.service.js");
      for (const [number, completed] of [
        [1, "2026-11-14T18:29:59.999Z"],
        [2, "2026-11-14T18:30:00.000Z"],
      ] as const) {
        await seed(
          "JobCard",
          cardData(`boundary-${number}`, {
            jobCardNumber: `QA-BOUNDARY-${number}`,
            status: "FINALISED",
            outDateTime: new Date(completed),
          }),
        );
        await seed("JobCardServiceLine", {
          id: `boundary-source-${number}`,
          jobCardId: `boundary-${number}`,
          serviceProviderId: id.provider,
          sparePartId: id.part,
          qty: 1,
          ratePaise: 100,
          amountPaise: 100,
        });
      }
      assert.equal(
        (
          await getUnbilledServiceReport(
            {
              page: 0,
              size: 20,
              search: "QA-BOUNDARY",
              completedTo: "2026-11-14",
            },
            [id.branch],
          )
        ).total,
        1,
      );
      assert.equal(
        (
          await getJobCardRepairCosts(
            {
              page: 0,
              size: 20,
              search: "QA-BOUNDARY",
              from: "2026-11-14",
              to: "2026-11-14",
            },
            [id.branch],
          )
        ).total,
        1,
      );
      const today = await admin.query<{ day: string }>(
        "SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date::text AS day",
      );
      const midnight = new Date(
        `${today.rows[0]!.day}T00:00:00+05:30`,
      ).getTime();
      const expected = new Map([
        [-1, "FUTURE"],
        [0, "0_30"],
        [30, "0_30"],
        [31, "31_60"],
        [60, "31_60"],
        [61, "61_90"],
        [90, "61_90"],
        [91, "90_PLUS"],
      ]);
      for (const [days] of expected) {
        const cardId = `age-${days}`;
        await seed(
          "JobCard",
          cardData(cardId, {
            status: "FINALISED",
            outDateTime: new Date("2026-11-14T09:00:00Z"),
          }),
        );
        await seed("JobCardServiceLine", {
          id: `source-${cardId}`,
          jobCardId: cardId,
          serviceProviderId: id.provider,
          sparePartId: id.part,
          qty: 1,
          ratePaise: 100,
          amountPaise: 100,
        });
        await db.$transaction(
          (tx) =>
            createServiceBillTx(
              tx,
              validators.createServiceBillSchema.parse({
                branchId: id.branch,
                serviceProviderId: id.provider,
                billDate: new Date(midnight - days * 86400000),
                providerInvoiceNo: `QA-AGE-${days}`,
                jobCardServiceLineIds: [`source-${cardId}`],
              }),
              "QA",
              id.user,
            ),
          txOptions,
        );
      }
      const ages = await getServiceBillOutstanding(
        { page: 0, size: 20, search: "QA-AGE-" },
        [id.branch],
      );
      assert.equal(ages.total, 8);
      for (const row of ages.rows)
        assert.equal(row.bucket, expected.get(row.ageDays));
    },
  );
  report.status = "PASSED_ISOLATED_SCHEMA";
} catch (error) {
  report.status = "FAILED";
  // Test failures contain synthetic names only. Connection errors are reduced
  // to a code so credentials/hostnames never enter the report.
  if (!report.checks.some((row) => row.status === "FAILED"))
    report.checks.push({
      name: phase,
      status: "FAILED",
      durationMs: 0,
      error:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "Verification failed",
    });
  process.exitCode = 1;
} finally {
  await db.$disconnect().catch(() => undefined);
  await admin.query("ROLLBACK").catch(() => undefined);
  await admin
    .query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`)
    .then(() => {
      report.testSchemaDropped = true;
    })
    .catch(() => {
      report.testSchemaDropped = false;
      process.exitCode = 1;
    });
  await admin.end().catch(() => undefined);
  await mkdir(new URL("../../../docs/qa/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL(
      "../../../docs/qa/job-card-database-verification.json",
      import.meta.url,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks,
        testSchemaDropped: report.testSchemaDropped,
      },
      null,
      2,
    ),
  );
}
