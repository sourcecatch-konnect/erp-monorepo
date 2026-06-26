import "dotenv/config";
import { db } from "./prisma.js";

/**
 * Demo seed for the Cash Planning module, transcribed from the real
 * Excel/handwritten sheets. All rupee amounts -> paise (BigInt).
 * Idempotent-ish: skips creditors/accounts if already present; the day
 * (2026-06-23) is rebuilt each run.
 */

const P = (rupees: number) => BigInt(Math.round(rupees * 100));

type Cat = "DIESEL" | "RENT" | "FREIGHT" | "EXPENSE" | "REPAIR" | "OTHER";

// ── img 1: creditor ledger (outstanding in rupees) ──
const CREDITORS: { name: string; category: Cat; outstanding: number }[] = [
  { name: "Vardhaman", category: "DIESEL", outstanding: 204284 },

  { name: "Harshit Intrade GHT Office", category: "RENT", outstanding: 69442 },
  { name: "Rajesh Rawal Mumbai Rent", category: "RENT", outstanding: 55100 },
  { name: "Shahid Ali Arara Rent", category: "RENT", outstanding: 79000 },
  { name: "Nilobha Fad Pune Rent", category: "RENT", outstanding: 21000 },
  { name: "Amit L Shah", category: "RENT", outstanding: 25000 },
  { name: "Chanchal Podder", category: "RENT", outstanding: 34500 },

  { name: "Pravin Achliya KTA", category: "EXPENSE", outstanding: 217150 },
  { name: "DTDC Courier", category: "EXPENSE", outstanding: 40530 },
  { name: "Rajmudra Prints", category: "EXPENSE", outstanding: 64248 },
  { name: "Bharat Patil", category: "EXPENSE", outstanding: 49500 },
  { name: "Techserve Technolgies", category: "EXPENSE", outstanding: 10620 },
  { name: "Sweet Crunch Sweets", category: "EXPENSE", outstanding: 48470 },
  { name: "Ajay PCI", category: "EXPENSE", outstanding: 17700 },
  { name: "Raksha Security Guard", category: "EXPENSE", outstanding: 104280 },
  { name: "Hetal Agencies", category: "EXPENSE", outstanding: 141600 },
  { name: "Maruti Courier", category: "EXPENSE", outstanding: 34012 },
  { name: "Mantri Distributors", category: "EXPENSE", outstanding: 783 },
  { name: "Athang Parakh", category: "EXPENSE", outstanding: 779084 },
  { name: "Rajjas Tours & Travells", category: "EXPENSE", outstanding: 7000 },
  { name: "Synergy Solutions", category: "EXPENSE", outstanding: 45180 },
  { name: "Blood Test", category: "EXPENSE", outstanding: 44890 },

  { name: "Shreenathji Agencies", category: "REPAIR", outstanding: 34000 },
  { name: "Raisoni Brothers", category: "REPAIR", outstanding: 422350 },
  { name: "Shrinathji Automobiles", category: "REPAIR", outstanding: 45977 },
  { name: "Pukhraj Agencies", category: "REPAIR", outstanding: 48880 },
  { name: "Swaminarayan Tyre Retrader", category: "REPAIR", outstanding: 11000 },

  { name: "Kartik Logisitcs Rudra", category: "FREIGHT", outstanding: 157500 },
  { name: "Anil Mohite", category: "FREIGHT", outstanding: 247500 },
  { name: "Yadav Transport", category: "FREIGHT", outstanding: 45000 },
  { name: "Janki Transport", category: "FREIGHT", outstanding: 10000 },
  { name: "Nikhil Logisites", category: "FREIGHT", outstanding: 225000 },
  { name: "Radhyshayam Roadlines", category: "FREIGHT", outstanding: 39156 },
  { name: "JSR Transport", category: "FREIGHT", outstanding: 27060 },
  { name: "Dilip Singh Kolkata", category: "FREIGHT", outstanding: 45045 },
  { name: "Renuka Road Rahul More", category: "FREIGHT", outstanding: 14000 },
  { name: "Freight Payable RCF", category: "FREIGHT", outstanding: 308730 },
  { name: "Jalgaon Jilha Mathadi", category: "FREIGHT", outstanding: 3058865 },
  { name: "Kalpit Pol", category: "FREIGHT", outstanding: 62316 },
  { name: "Chandrapur Gadch Mathadi", category: "FREIGHT", outstanding: 3410704 },
  { name: "Matrix Enterprises", category: "FREIGHT", outstanding: 271134 },
  { name: "J B Munale", category: "FREIGHT", outstanding: 1194175 },
  { name: "Pandurang Kapure", category: "FREIGHT", outstanding: 747100 },
  { name: "SRRL Logistics Palwal", category: "FREIGHT", outstanding: 41160 },
  { name: "Shree Shyam Enterprises", category: "FREIGHT", outstanding: 94400 },
  { name: "K Logisitcs", category: "FREIGHT", outstanding: 404645 },
  { name: "Bipin Singh", category: "FREIGHT", outstanding: 0 },
  { name: "S S Enterprises", category: "FREIGHT", outstanding: 0 },
  { name: "R B Associates", category: "FREIGHT", outstanding: 209496 },
  { name: "Ratul Barman", category: "FREIGHT", outstanding: 724885 },
  { name: "Mojamil Haque Adv", category: "FREIGHT", outstanding: 55000 },
  { name: "Ajay Bagrecha Balance", category: "FREIGHT", outstanding: 63622 },
  { name: "GHT Local Balance", category: "FREIGHT", outstanding: 9000 },
  { name: "Mahakali Transport", category: "FREIGHT", outstanding: 136388 },
  { name: "Gothdra Roadways", category: "FREIGHT", outstanding: 179719 },

  // "A 52" project bucket -> OTHER (no project category in the enum yet)
  { name: "Shital Gujar", category: "OTHER", outstanding: 51000 },
  { name: "Kasat Infra", category: "OTHER", outstanding: 28000 },
  { name: "Agrawal Steel", category: "OTHER", outstanding: 2214 },
  { name: "Techonlite House Lumins", category: "OTHER", outstanding: 50000 },
  { name: "The Art Palce", category: "OTHER", outstanding: 210040 },
  { name: "Barkha Hardware", category: "OTHER", outstanding: 35052 },
  { name: "Sanghvi Pipes", category: "OTHER", outstanding: 263101 },
  { name: "Orchid Veneers Ply", category: "OTHER", outstanding: 34810 },
  { name: "Shivani Kalakruti", category: "OTHER", outstanding: 55770 },
  { name: "Shree Marketing", category: "OTHER", outstanding: 19920 },
  { name: "Mutha Brothers", category: "OTHER", outstanding: 36590 },
];

// ── img 2/3: money sources ──
const ACCOUNTS: {
  name: string;
  type: "BANK" | "CASH";
  bankName?: string;
  last4?: string;
  opening: number; // rupees
}[] = [
  { name: "ICICI Bank-28", type: "BANK", bankName: "ICICI Bank", last4: "0028", opening: 5011 },
  { name: "IndusInd Bank", type: "BANK", bankName: "IndusInd Bank", opening: 10471 },
  { name: "ICICI Bank-8748", type: "BANK", bankName: "ICICI Bank", last4: "8748", opening: 0 },
  { name: "ICICI Bank-2382", type: "BANK", bankName: "ICICI Bank", last4: "2382", opening: 0 },
  { name: "Tijori", type: "CASH", opening: 149000 },
  { name: "Cash - Guwahati", type: "CASH", opening: 3084 },
  { name: "Cash - Kolkata", type: "CASH", opening: 22160 },
  { name: "Cash - Mumbai", type: "CASH", opening: 630 },
  { name: "Cash - Nashik", type: "CASH", opening: 11 },
  { name: "Cash - Container", type: "CASH", opening: 1500 },
];

// ── img 2: handwritten payment queue (priority order, rupees) ──
const PAYMENTS: { payee: string; amount: number; category: Cat; segment?: "ROAD" | "RAIL" | "FCI" }[] = [
  { payee: "Self", amount: 40000, category: "EXPENSE" },
  { payee: "Happay", amount: 40000, category: "EXPENSE" },
  { payee: "HPCL", amount: 100000, category: "DIESEL" },
  { payee: "BR Associate", amount: 209446, category: "FREIGHT", segment: "RAIL" },
  { payee: "ODA Adv", amount: 55000, category: "FREIGHT", segment: "RAIL" },
  { payee: "RR Paldhi", amount: 496116, category: "FREIGHT", segment: "RAIL" },
  { payee: "Bipin Singh", amount: 40000, category: "FREIGHT" },
  { payee: "Kol Rent", amount: 33000, category: "RENT" },
  { payee: "DC GHT", amount: 64000, category: "EXPENSE" },
  { payee: "Hamali", amount: 12000, category: "EXPENSE" },
  { payee: "Inhouse Vehicle", amount: 105000, category: "EXPENSE" },
  { payee: "Axle Bank", amount: 738000, category: "OTHER" },
  { payee: "ICICI Bank", amount: 240000, category: "OTHER" },
  { payee: "Puthi Agency", amount: 48450, category: "EXPENSE" },
  { payee: "GHT Diwas", amount: 18000, category: "EXPENSE" },
  { payee: "Nsk Branch", amount: 30000, category: "OTHER" },
  { payee: "Kol Branch", amount: 40000, category: "OTHER" },
  { payee: "Directs 4/27/23", amount: 10000, category: "OTHER" },
  { payee: "Rajjas Barelli", amount: 7000, category: "EXPENSE" },
  { payee: "Ajapmole Jor", amount: 1500, category: "EXPENSE" },
  { payee: "Bharath Pumps", amount: 67000, category: "DIESEL" },
  { payee: "Schindler", amount: 54020, category: "REPAIR" },
  { payee: "Telephone", amount: 12000, category: "EXPENSE" },
];

// ── img: "Payment Receivable" (values in lakhs). `total` = full receivable
// (right column), `expected` = the acknowledged/guaranteed slice (left column;
// 0 = nothing confirmed yet), `date` = expected-by date where the sheet gives
// one. Zero-total rows from the sheet are omitted. Grand total = 277.44 L.
const L = (lakhs: number) => Math.round(lakhs * 100000);
const RECEIVABLES: {
  party: string;
  total: number;
  expected: number;
  date?: string;
}[] = [
  { party: "Rail Road", total: 0.27, expected: 0 },
  { party: "Geep Industries", total: 11.52, expected: 0 },
  { party: "Prasad & Co", total: 1.48, expected: 0 },
  { party: "Badri Ray & Co", total: 1.49, expected: 0 },
  { party: "Videocon Industries", total: 9.17, expected: 0 },
  { party: "Sai Baba Logistics", total: 2.14, expected: 0 },
  { party: "Handicraft Stores", total: 0.44, expected: 0 },
  { party: "Prince Corporation", total: 5.34, expected: 0 },
  { party: "VIP Industries", total: 5.0, expected: 0 },
  { party: "Marrico Ltd", total: 0.71, expected: 0 },
  { party: "Anima Sanitory", total: 0.63, expected: 0 },
  { party: "Maa Sarda", total: 11.52, expected: 0 },
  { party: "Sowallow Enterprses", total: 2.37, expected: 0 },
  { party: "Astha Roadlines", total: 6.16, expected: 0 },
  { party: "Biswas Dairy", total: 0.62, expected: 0.35 },
  { party: "DMO", total: 11.23, expected: 0 },
  { party: "New BP International", total: 0.73, expected: 0.5 },
  { party: "Samsonite South Asia", total: 11.38, expected: 3.88, date: "2026-06-22" },
  { party: "Jain Irregation", total: 0.31, expected: 0 },
  { party: "Nilon's Enterprises", total: 16.47, expected: 2.0, date: "2026-06-25" },
  { party: "Rahul Enterprises", total: 0.54, expected: 0 },
  { party: "Whirlpool of India", total: 85.58, expected: 10.8 },
  { party: "Phantom Express", total: 0.65, expected: 0 },
  { party: "Britania Industries", total: 1.88, expected: 1.6, date: "2026-06-17" },
  { party: "Gopal Umberlla", total: 0.61, expected: 0.61, date: "2026-06-17" },
  { party: "Modern Tailor", total: 0.26, expected: 0.26 },
  { party: "Liebherr Appliance", total: 1.36, expected: 0 },
  { party: "Goodyear India Ltd", total: 1.52, expected: 0 },
  { party: "Supreme Industries", total: 0.49, expected: 0.49, date: "2026-06-26" },
  { party: "Pioneer Syndicate", total: 0.36, expected: 0 },
  { party: "Raptakos Brett Ltd", total: 1.29, expected: 1.25, date: "2026-06-26" },
  { party: "MTR Construct & Inputs", total: 0.41, expected: 0 },
  { party: "Maharahstra Transport", total: 0.91, expected: 0 },
  { party: "DM MP Civil Supply Corp", total: 8.39, expected: 0 },
  { party: "Food Corpration Chandra", total: 74.21, expected: 0 },
];

// Seed the real sheet date plus "today" so the default page view is populated.
const DAY_ISOS = ["2026-06-23", "2026-06-25"];

async function main() {
  // 1) Creditors
  if ((await db.creditor.count()) === 0) {
    await db.creditor.createMany({
      data: CREDITORS.map((c) => ({
        name: c.name,
        category: c.category,
        outstandingBalance: P(c.outstanding),
      })),
    });
    console.log(`Seeded ${CREDITORS.length} creditors.`);
  } else {
    console.log("Creditors already present — skipped.");
  }

  // 2) Cash accounts
  if ((await db.cashAccount.count()) === 0) {
    await db.cashAccount.createMany({
      data: ACCOUNTS.map((a) => ({
        name: a.name,
        type: a.type,
        bankName: a.bankName ?? null,
        accountLast4: a.last4 ?? null,
      })),
    });
    console.log(`Seeded ${ACCOUNTS.length} cash accounts.`);
  } else {
    console.log("Cash accounts already present — skipped.");
  }

  // 2b) Receivables — global (not day-scoped). Expected slice = full amount when
  // a due date is known, else 0.
  if ((await db.cashReceivable.count()) === 0) {
    await db.cashReceivable.createMany({
      data: RECEIVABLES.map((r) => ({
        partyName: r.party,
        totalAmount: P(L(r.total)),
        expectedAmount: P(L(r.expected)),
        expectedDate: r.date ? new Date(`${r.date}T00:00:00.000Z`) : null,
      })),
    });
    console.log(`Seeded ${RECEIVABLES.length} receivables.`);
  } else {
    console.log("Receivables already present — skipped.");
  }

  const accounts = await db.cashAccount.findMany({ select: { id: true, name: true } });
  const accountByName = new Map(accounts.map((a) => [a.name, a.id]));
  const creditors = await db.creditor.findMany({ select: { id: true, name: true } });
  const creditorByName = new Map(creditors.map((c) => [c.name, c.id]));

  // 3) Days — rebuild each from scratch
  for (const iso of DAY_ISOS) {
    const date = new Date(`${iso}T00:00:00.000Z`);
    const existing = await db.cashPlanDay.findUnique({ where: { date } });
    if (existing) {
      await db.cashPlanDay.delete({ where: { id: existing.id } }); // cascades children
    }

    const day = await db.cashPlanDay.create({
      data: {
        date,
        status: "OPEN",
        balances: {
          create: ACCOUNTS.map((a) => ({
            accountId: accountByName.get(a.name)!,
            openingBalance: P(a.opening),
            carriedOpening: P(a.opening),
          })),
        },
        payments: {
          create: PAYMENTS.map((p, i) => ({
            payeeName: p.payee,
            amount: P(p.amount),
            category: p.category,
            mode: "BANK",
            segment: p.segment ?? null,
            priority: i + 1,
            creditorId: creditorByName.get(p.payee) ?? null,
          })),
        },
      },
    });

    console.log(
      `Seeded day ${iso} (id ${day.id}): ${ACCOUNTS.length} balances, ${PAYMENTS.length} payments.`,
    );
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
