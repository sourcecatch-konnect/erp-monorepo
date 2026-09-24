import { db } from "../apps/server/prisma/prisma.js";

async function main() {
  const ledgers = await db.ledger.findMany({
    where: { driverId: { not: null } },
    select: { id: true, name: true, driverId: true },
  });
  console.log("Driver ledgers:", ledgers);

  for (const l of ledgers) {
    const lines = await db.journalLine.findMany({
      where: { ledgerId: l.id },
      select: {
        id: true,
        debitPaise: true,
        creditPaise: true,
        narration: true,
        journalEntry: { select: { status: true, voucherNumber: true, voucherDate: true } },
      },
    });
    console.log(`Lines for ${l.name} (${l.id}):`, lines);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
