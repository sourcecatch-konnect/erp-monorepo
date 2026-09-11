import ExcelJS from "exceljs";
import type { CustomerStatementView, StatementLine } from "@skerp/types";

import { paiseToRupees } from "../../lib/money.js";

/**
 * ACCT-R6 — render a customer statement (the exact thing on the Debtor tab)
 * as a printable PDF (HTML → puppeteer) or an Excel workbook.
 */

export type StatementExportMeta = {
  branchName?: string | null;
  fyCode?: string | null;
  from?: string | null;
  to?: string | null;
  generatedAt: Date;
};

const inr = (paise: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paiseToRupees(paise));

const drCr = (paise: number): string => (paise >= 0 ? "Dr" : "Cr");

const fmtDate = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(iso))
    : "—";

const KIND_LABEL: Record<StatementLine["kind"], string> = {
  BILL: "Bill",
  RECEIPT: "Receipt",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
  JOURNAL: "Journal",
};

const esc = (v: unknown): string =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/* ------------------------------------------------------------------ */
/* PDF (HTML)                                                          */
/* ------------------------------------------------------------------ */

export function buildStatementHtml(
  view: CustomerStatementView,
  meta: StatementExportMeta,
): string {
  const filterBits = [
    meta.branchName ? `Branch: ${esc(meta.branchName)}` : "All branches",
    meta.fyCode ? `FY: ${esc(meta.fyCode)}` : null,
    meta.from || meta.to
      ? `Period: ${fmtDate(meta.from)} – ${fmtDate(meta.to)}`
      : "All dates",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  // Matches the web Debtor tab's own column order (LedgerTable's
  // variant="statement") — Type is its own column, not folded into
  // Particulars, so a bill/receipt's number isn't shown twice.
  const rowHtml = (
    type: string,
    date: string,
    particulars: string,
    voucher: string,
    debit: string,
    credit: string,
    balance: string,
    opts: { strong?: boolean } = {},
  ) => `
    <tr class="${opts.strong ? "strong" : ""}">
      <td>${esc(date)}</td>
      <td>${esc(particulars)}</td>
      <td>${type ? `<span class="tag">${esc(type)}</span>` : ""}</td>
      <td class="mono">${esc(voucher)}</td>
      <td class="num">${debit}</td>
      <td class="num">${credit}</td>
      <td class="num">${balance}</td>
    </tr>`;

  const lines = view.lines
    .map((l) =>
      rowHtml(
        KIND_LABEL[l.kind],
        fmtDate(l.date),
        l.particulars,
        l.voucherNumber ?? "",
        l.debitPaise > 0 ? inr(l.debitPaise) : "",
        l.creditPaise > 0 ? inr(l.creditPaise) : "",
        `${inr(l.runningBalancePaise)} ${drCr(l.runningBalancePaise)}`,
      ),
    )
    .join("");

  const t = view.totals;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c1a17; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .muted { color: #6b6259; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1c1a17; padding-bottom:8px; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th, td { padding:6px 8px; border-bottom:1px solid #e7e1d8; text-align:left; vertical-align:top; }
  th { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#6b6259; border-bottom:1px solid #b8afa2; }
  .num { text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size:11px; color:#6b6259; }
  tr.strong td { font-weight:700; background:#faf7f2; }
  .tag { display:inline-block; padding:0 6px; border-radius:4px; background:#f0ece4; color:#6b6259; font-size:10px; white-space:nowrap; }
  .totals { margin-top:16px; display:grid; grid-template-columns: repeat(5, 1fr); gap:1px; background:#e7e1d8; border:1px solid #e7e1d8; }
  .totals div { background:#fff; padding:8px 10px; }
  .totals .k { font-size:10px; text-transform:uppercase; color:#6b6259; }
  .totals .v { font-size:14px; font-weight:700; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>Statement of Account</h1>
      <div class="muted">${esc(view.customerName)}</div>
    </div>
    <div class="muted" style="text-align:right">
      Generated ${fmtDate(meta.generatedAt.toISOString())}
    </div>
  </div>
  <div class="muted">${filterBits}</div>

  <table>
    <thead>
      <tr><th>Date</th><th>Particulars</th><th>Type</th><th>Voucher #</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr>
    </thead>
    <tbody>
      ${rowHtml("", "", "Opening balance", "", "", "", `${inr(view.openingBalancePaise)} ${drCr(view.openingBalancePaise)}`, { strong: true })}
      ${lines}
      ${rowHtml("", "", "Closing balance", "", inr(t.billedPaise), inr(t.receivedPaise + t.tdsPaise), `${inr(view.closingBalancePaise)} ${drCr(view.closingBalancePaise)}`, { strong: true })}
    </tbody>
  </table>

  <div class="totals">
    <div><div class="k">Billed</div><div class="v">${inr(t.billedPaise)}</div></div>
    <div><div class="k">Received</div><div class="v">${inr(t.receivedPaise)}</div></div>
    <div><div class="k">TDS</div><div class="v">${inr(t.tdsPaise)}</div></div>
    <div><div class="k">On account</div><div class="v">${inr(t.onAccountPaise)}</div></div>
    <div><div class="k">Outstanding</div><div class="v">${inr(t.outstandingPaise)} ${drCr(t.outstandingPaise)}</div></div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

export async function buildStatementXlsx(
  view: CustomerStatementView,
  meta: StatementExportMeta,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK ERP";
  wb.created = meta.generatedAt;
  const ws = wb.addWorksheet("Statement");

  const widths = [14, 42, 14, 22, 16, 16, 20];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const moneyFmt = "#,##0.00";
  const DEBIT_COL = 5;
  const CREDIT_COL = 6;

  ws.addRow(["Statement of Account"]).font = { bold: true, size: 14 };
  ws.addRow([view.customerName]).font = { bold: true };
  ws.addRow([
    [
      meta.branchName ? `Branch: ${meta.branchName}` : "All branches",
      meta.fyCode ? `FY: ${meta.fyCode}` : null,
      meta.from || meta.to
        ? `Period: ${fmtDate(meta.from)} - ${fmtDate(meta.to)}`
        : "All dates",
      `Generated: ${fmtDate(meta.generatedAt.toISOString())}`,
    ]
      .filter(Boolean)
      .join("   |   "),
  ]);
  ws.addRow([]);
  ws.addRow(["Date", "Particulars", "Type", "Voucher #", "Debit", "Credit", "Balance"]).font = {
    bold: true,
  };

  const addRow = (
    date: string,
    particulars: string,
    type: string,
    voucher: string,
    debit: number | null,
    credit: number | null,
    balance: number,
    bold = false,
  ) => {
    const row = ws.addRow([
      date,
      particulars,
      type,
      voucher,
      debit,
      credit,
      `${paiseToRupees(balance).toFixed(2)} ${drCr(balance)}`,
    ]);
    row.getCell(DEBIT_COL).numFmt = moneyFmt;
    row.getCell(CREDIT_COL).numFmt = moneyFmt;
    if (bold) row.font = { bold: true };
  };

  addRow("", "Opening balance", "", "", null, null, view.openingBalancePaise, true);
  for (const l of view.lines) {
    addRow(
      fmtDate(l.date),
      l.particulars,
      KIND_LABEL[l.kind],
      l.voucherNumber ?? "",
      l.debitPaise > 0 ? paiseToRupees(l.debitPaise) : null,
      l.creditPaise > 0 ? paiseToRupees(l.creditPaise) : null,
      l.runningBalancePaise,
    );
  }
  addRow("", "Closing balance", "", "", null, null, view.closingBalancePaise, true);

  ws.addRow([]);
  const t = view.totals;
  const totalRows: [string, number][] = [
    ["Billed", t.billedPaise],
    ["Received", t.receivedPaise],
    ["TDS", t.tdsPaise],
    ["On account", t.onAccountPaise],
    ["Outstanding", t.outstandingPaise],
  ];
  for (const [label, paise] of totalRows) {
    const row = ws.addRow(["", label, "", "", null, paiseToRupees(paise), ""]);
    row.getCell(CREDIT_COL).numFmt = moneyFmt;
    row.font = { bold: label === "Outstanding" };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
