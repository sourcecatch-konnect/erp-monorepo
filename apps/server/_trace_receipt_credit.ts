import "dotenv/config";
import { db } from "./prisma/prisma.js";

const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);

const customer = await db.customer.findFirst({
  where: { name: { contains: "Whirpool", mode: "insensitive" } },
  select: { id: true, name: true },
});
console.log("Customer:", customer);

const receipts = await db.receipt.findMany({
  where: customer ? { customerId: customer.id } : {},
  orderBy: { createdAt: "desc" },
  take: 5,
  select: {
    id: true, receiptNumber: true, status: true, receivedAt: true,
    receivedIntoAccountId: true, amountPaise: true, createdAt: true,
    receivedIntoAccount: { select: { name: true } },
  },
});
console.log("\nRecent receipts:");
for (const r of receipts) console.log(j(r));

if (receipts[0]) {
  const adjustments = await db.cashAccountAdjustment.findMany({
    where: { receiptId: receipts[0].id },
    include: { day: { select: { date: true, status: true } }, account: { select: { name: true } } },
  });
  console.log(`\nCashAccountAdjustments for most recent receipt (${receipts[0].id}):`);
  console.log(j(adjustments));
}

const days = await db.cashPlanDay.findMany({
  orderBy: { date: "desc" },
  take: 10,
  select: { id: true, date: true, status: true },
});
console.log("\nRecent CashPlanDays:");
for (const d of days) console.log(j(d));

await db.$disconnect();
