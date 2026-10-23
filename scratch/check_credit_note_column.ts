import { db } from "../apps/server/prisma/prisma.js";

async function main() {
  const rows = await db.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
    "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='BillCreditNote'",
  );
  console.log(rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
