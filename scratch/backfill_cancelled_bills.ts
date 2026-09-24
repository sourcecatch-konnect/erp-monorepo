import { PrismaClient } from "../apps/server/generated/prisma";

const db = new PrismaClient();

async function main() {
  const affected = await db.bill.findMany({
    where: { status: "CANCELLED", outstandingAmountPaise: { not: 0n } },
    select: { id: true, billNumber: true, outstandingAmountPaise: true },
  });

  console.log(`Found ${affected.length} cancelled bill(s) with stale outstandingAmountPaise:`);
  for (const b of affected) {
    console.log(`  ${b.billNumber ?? b.id}: ${b.outstandingAmountPaise.toString()} paise -> 0`);
  }

  if (affected.length === 0) {
    console.log("Nothing to fix.");
    return;
  }

  const result = await db.bill.updateMany({
    where: { status: "CANCELLED", outstandingAmountPaise: { not: 0n } },
    data: { outstandingAmountPaise: 0n },
  });

  console.log(`Updated ${result.count} bill(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
