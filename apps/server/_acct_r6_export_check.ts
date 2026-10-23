// R6 — generate a REAL statement PDF + Excel for a real customer, using the
// actual production builders, so they can be opened and eyeballed. Read-only.
//   npx tsx _acct_r6_export_check.ts
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { db } from "./prisma/prisma.js";
import { buildCustomerStatement } from "./src/modules/ledger/customer-statement.service.js";
import { buildStatementHtml, buildStatementXlsx } from "./src/modules/ledger/statement-export.js";
import { generatePdfFromHtml } from "./src/templetes/pdf/pdf.genertaor..js";

const OUT_DIR = process.argv[2] ?? ".";

const customer = await db.customer.findFirst({
  where: { name: { contains: "Whirpool", mode: "insensitive" } },
  select: { id: true, name: true },
});
if (!customer) throw new Error("Sample customer not found");

const view = await buildCustomerStatement(customer.id);
console.log(`Statement for ${view.customerName}: ${view.lines.length} lines, closing=₹${(view.closingBalancePaise / 100).toLocaleString("en-IN")}`);

const meta = { branchName: null, fyCode: null, from: null, to: null, generatedAt: new Date() };

const html = buildStatementHtml(view, meta);
const pdf = await generatePdfFromHtml(html);
writeFileSync(`${OUT_DIR}/statement-sample.pdf`, pdf);
console.log(`Wrote ${OUT_DIR}/statement-sample.pdf (${pdf.length} bytes)`);

const xlsx = await buildStatementXlsx(view, meta);
writeFileSync(`${OUT_DIR}/statement-sample.xlsx`, xlsx);
console.log(`Wrote ${OUT_DIR}/statement-sample.xlsx (${xlsx.length} bytes)`);

await db.$disconnect();
