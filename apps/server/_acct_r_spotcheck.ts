// R2/R4/R5 real-data spot check — calls the ACTUAL production service
// functions (not a reimplementation) against the live DB. Read-only.
//   npx tsx _acct_r_spotcheck.ts
import "dotenv/config";
import { db } from "./prisma/prisma.js";
import { buildCustomerStatement, perBillOutstanding } from "./src/modules/ledger/customer-statement.service.js";
import { buildAgeingReport } from "./src/modules/ledger/ageing.service.js";

const rupees = (v: number) => (v / 100).toLocaleString("en-IN");

const customers = await db.customer.findMany({
  where: { billsAsBillingCustomer: { some: {} } },
  select: { id: true, name: true },
  take: 20,
});

console.log(`Checking ${customers.length} customers with at least one bill...\n`);

let sumStatementClosing = 0;
let sumBillOutstanding = 0;
const mismatches: string[] = [];

for (const c of customers) {
  const statement = await buildCustomerStatement(c.id);
  const bills = await perBillOutstanding(c.id);
  const sumBills = bills.reduce((s, b) => s + b.outstandingPaise, 0);

  sumStatementClosing += statement.closingBalancePaise;
  sumBillOutstanding += sumBills;

  const match = statement.closingBalancePaise === sumBills;
  console.log(
    `${c.name.padEnd(35)} statement.closing=₹${rupees(statement.closingBalancePaise).padStart(12)}  ` +
      `Σbills=₹${rupees(sumBills).padStart(12)}  lines=${statement.lines.length}  ${match ? "OK" : "MISMATCH ✗"}`,
  );
  if (!match) mismatches.push(c.id);
}

console.log(`\nΣ statement.closingBalancePaise across ${customers.length} customers: ₹${rupees(sumStatementClosing)}`);
console.log(`Σ bill-wise outstanding across the same customers:              ₹${rupees(sumBillOutstanding)}`);
console.log(`Mismatched customers: ${mismatches.length}`);

const ageing = await buildAgeingReport();
console.log(`\nAgeing report grand total: ₹${rupees(ageing.totals.totalPaise)}`);
console.log(`Ageing rows: ${ageing.rows.length}`);
for (const r of ageing.rows)
  console.log(
    `  ${r.customerName.padEnd(35)} notDue=₹${rupees(r.buckets.notDue)} 0-30=₹${rupees(r.buckets.d0_30)} ` +
      `31-60=₹${rupees(r.buckets.d31_60)} 61-90=₹${rupees(r.buckets.d61_90)} 90+=₹${rupees(r.buckets.d90_plus)} total=₹${rupees(r.totalPaise)}`,
  );

console.log(`\nAgeing grand total vs Σ bill-wise outstanding (all customers checked above): match=${ageing.totals.totalPaise === sumBillOutstanding}`);

await db.$disconnect();
