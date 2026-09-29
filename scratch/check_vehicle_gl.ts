import { db } from "../apps/server/prisma/prisma.js";

async function main() {
  const rows = await db.ledger.findMany({
    where: { code: { in: ["VEHICLE_FREIGHT_INCOME", "VEHICLE_TRIP_EXPENSE", "VEHICLE_JOURNEY_RESULT"] } },
    select: { code: true, name: true, group: true },
  });
  console.log(rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
