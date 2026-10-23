import { db } from "../apps/server/prisma/prisma.js";

async function main() {
  const affected = await db.bill.findMany({
    where: { status: "CANCELLED", outstandingAmountPaise: { not: 0n } },
    select: { id: true, billNumber: true, outstandingAmountPaise: true },
  });
  console.log(`Found ${affected.length} cancelled bill(s) with stale outstandingAmountPaise:`);
  for (const b of affected) {
    console.log(`  ${b.billNumber ?? b.id}: ${b.outstandingAmountPaise.toString()} paise`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
