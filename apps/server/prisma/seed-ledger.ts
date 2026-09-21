import "dotenv/config";
import { pathToFileURL } from "node:url";
import { db } from "./prisma.js";
import type { LedgerAccountGroup } from "../generated/prisma/index.js";

/**
 * Idempotent chart-of-accounts seed for the double-entry ledger.
 *
 *   - GL ledgers: the named income / tax / deduction heads the posting
 *     service looks up by `code` (see modules/ledger/posting.service.ts).
 *   - Bank / Cash ledgers: one per CashAccount, linked by `cashAccountId`.
 *
 * Party ledgers (customer / transport / creditor / labour / pump) are NOT
 * seeded here — they are created lazily by `getOrCreatePartyLedger` the first
 * time a voucher touches that party.
 *
 * Run from apps/server:  pnpm exec tsx prisma/seed-ledger.ts
 */

const GL_LEDGERS: {
  code: string;
  name: string;
  group: LedgerAccountGroup;
}[] = [
  { code: "FREIGHT_INCOME", name: "Freight Income", group: "DIRECT_INCOME" },
  { code: "DETENTION_INCOME", name: "Detention Income", group: "DIRECT_INCOME" },
  {
    code: "UNLOADING_INCOME",
    name: "Unloading / Hamali Income",
    group: "DIRECT_INCOME",
  },
  {
    code: "FREIGHT_ADJUSTMENT",
    name: "Freight Adjustment",
    group: "DIRECT_INCOME",
  },
  { code: "ROUND_OFF", name: "Round Off", group: "INDIRECT_INCOME" },
  { code: "OUTPUT_CGST", name: "Output CGST", group: "DUTIES_AND_TAXES" },
  { code: "OUTPUT_SGST", name: "Output SGST", group: "DUTIES_AND_TAXES" },
  { code: "OUTPUT_IGST", name: "Output IGST", group: "DUTIES_AND_TAXES" },
  { code: "TDS_RECEIVABLE", name: "TDS Receivable", group: "CURRENT_ASSET" },
  {
    code: "DAMAGE_DEDUCTION",
    name: "Damage Deduction",
    group: "INDIRECT_EXPENSE",
  },
  {
    code: "RATE_DIFFERENCE",
    name: "Rate Difference",
    group: "INDIRECT_EXPENSE",
  },
  // Expense heads for money-out payments (CashPayment) with no creditor —
  // the posting service debits one of these by CreditorCategory. Keep the
  // codes in sync with PAYMENT_CATEGORY_EXPENSE_CODE in posting.service.ts.
  { code: "DIESEL_EXPENSE", name: "Diesel Expense", group: "DIRECT_EXPENSE" },
  { code: "RENT_EXPENSE", name: "Rent Expense", group: "INDIRECT_EXPENSE" },
  {
    code: "FREIGHT_EXPENSE",
    name: "Freight & Cartage Expense",
    group: "DIRECT_EXPENSE",
  },
  {
    code: "GENERAL_EXPENSE",
    name: "General Expense",
    group: "INDIRECT_EXPENSE",
  },
  {
    code: "REPAIR_EXPENSE",
    name: "Vehicle Repair & Maintenance",
    group: "INDIRECT_EXPENSE",
  },
  {
    code: "MISC_EXPENSE",
    name: "Miscellaneous Expense",
    group: "INDIRECT_EXPENSE",
  },
  {
    code: "SPARE_PARTS_INVENTORY",
    name: "Spare Parts Inventory",
    group: "CURRENT_ASSET",
  },
  {
    code: "TDS_PAYABLE",
    name: "TDS Payable (Contractor)",
    group: "DUTIES_AND_TAXES",
  },
];

export async function seedLedger(client: typeof db = db) {
  let created = 0;
  let updated = 0;

  for (const gl of GL_LEDGERS) {
    const existing = await client.ledger.findUnique({
      where: { code: gl.code },
      select: { id: true },
    });
    if (existing) {
      await client.ledger.update({
        where: { id: existing.id },
        data: { name: gl.name, group: gl.group, kind: "GL" },
      });
      updated += 1;
    } else {
      await client.ledger.create({
        data: {
          kind: "GL",
          code: gl.code,
          name: gl.name,
          group: gl.group,
        },
      });
      created += 1;
    }
  }

  // Bank / Cash ledgers — one per active CashAccount, linked by cashAccountId.
  const accounts = await client.cashAccount.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, type: true },
  });
  for (const account of accounts) {
    const group: LedgerAccountGroup = account.type === "BANK" ? "BANK" : "CASH";
    const existing = await client.ledger.findUnique({
      where: { cashAccountId: account.id },
      select: { id: true },
    });
    if (existing) {
      await client.ledger.update({
        where: { id: existing.id },
        data: { name: account.name, group },
      });
      updated += 1;
    } else {
      await client.ledger.create({
        data: {
          kind: "GL",
          name: account.name,
          group,
          cashAccountId: account.id,
        },
      });
      created += 1;
    }
  }

  console.log(`Ledger seed: ${created} created, ${updated} updated.`);
}

// Allow standalone execution: `pnpm exec tsx prisma/seed-ledger.ts`
// pathToFileURL handles Windows drive-letter paths (file:///C:/…) correctly.
const invokedDirectly =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  seedLedger()
    .then(() => db.$disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error("Ledger seed failed:", err);
      await db.$disconnect();
      process.exit(1);
    });
}
