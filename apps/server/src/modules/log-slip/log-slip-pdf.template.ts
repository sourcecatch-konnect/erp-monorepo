import type { LogSlipPdfData } from "./log-slip.pdf.js";
import { paiseToRupees } from "../../lib/money.js";

type JsonRecord = Record<string, unknown>;

const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const metaOf = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const textMeta = (meta: JsonRecord, key: string) =>
  typeof meta[key] === "string" ? (meta[key] as string) : null;

const numberMeta = (meta: JsonRecord, key: string) =>
  typeof meta[key] === "number" ? (meta[key] as number) : null;

const stringListMeta = (meta: JsonRecord, key: string) =>
  Array.isArray(meta[key])
    ? (meta[key] as unknown[]).filter(
        (item): item is string => typeof item === "string" && Boolean(item),
      )
    : [];

const formatDate = (value: Date | string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "-";

const formatDateTime = (value: Date | string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(value))
    : "-";

const formatNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "-"
    : value.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const formatMoney = (value: bigint | number | null | undefined) =>
  value === null || value === undefined
    ? "-"
    : paiseToRupees(Number(value)).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const sumMoney = (
  lines: LogSlipPdfData["lines"],
  predicate: (line: LogSlipPdfData["lines"][number]) => boolean,
) =>
  lines.filter(predicate).reduce((total, line) => total + line.amountPaise, 0n);

const cleanDescription = (value: string) =>
  value.replaceAll("—", "-").replaceAll("→", "->").replace(/\s+/g, " ").trim();

const parseRouteFallback = (description: string) => {
  const route = description.match(
    /:\s*(.*?)\s*(?:→|->)\s*(.*?)(?:\s*\(empty\))?$/i,
  );
  return {
    source: route?.[1]?.trim() ?? "-",
    destination: route?.[2]?.trim() ?? "-",
  };
};

const infoRow = (label: string, value: unknown) => `
  <div class="info-row">
    <span>${esc(label)}</span>
    <strong>${value === null || value === undefined || value === "" ? "-" : esc(value)}</strong>
  </div>`;

export const logSlipPdfTemplate = (
  slip: LogSlipPdfData,
  assets: { headerImageSrc?: string },
) => {
  const tripLines = slip.lines.filter(
    (line) => line.lineType === "TRIP_FREIGHT",
  );
  const advanceLines = slip.lines.filter((line) => line.lineType === "ADVANCE");
  const dieselLines = slip.lines.filter((line) => line.lineType === "DIESEL");
  const expenseLines = slip.lines.filter((line) => line.lineType === "EXPENSE");
  const generatedBy = slip.generatedBy
    ? `${slip.generatedBy.firstName} ${slip.generatedBy.lastName}`.trim()
    : "-";

  const tripRows = tripLines.map((line) => {
    const meta = metaOf(line.metadata);
    const fallback = parseRouteFallback(line.description);
    const source = textMeta(meta, "source") ?? fallback.source;
    const destination = textMeta(meta, "destination") ?? fallback.destination;
    const startedAt = textMeta(meta, "startedAt");
    const endedAt = textMeta(meta, "endedAt");
    const lrNumbers = stringListMeta(meta, "lrNumbers");
    const consignors = stringListMeta(meta, "consignors");
    const isEmpty =
      meta.isEmpty === true || /\(empty\)/i.test(line.description);
    const openingKm = numberMeta(meta, "openingKm");
    const closingKm = numberMeta(meta, "closingKm");
    const distance =
      numberMeta(meta, "distanceKm") ??
      (openingKm !== null && closingKm !== null
        ? Math.max(closingKm - openingKm, 0)
        : null);
    const reference = isEmpty
      ? `Empty Trip${startedAt ? `<br><small>${esc(formatDate(startedAt))}</small>` : ""}`
      : lrNumbers.length
        ? `${lrNumbers.map(esc).join("<br>")}${startedAt ? `<br><small>${esc(formatDate(startedAt))}</small>` : ""}`
        : `${esc(textMeta(meta, "tripName") ?? `Trip ${line.sortOrder + 1}`)}${startedAt ? `<br><small>${esc(formatDate(startedAt))}</small>` : ""}`;
    const narration = consignors.length
      ? consignors.join(", ")
      : cleanDescription(line.description);

    return `<tr>
      <td>${reference}</td>
      <td><strong>${esc(source)}</strong>${startedAt ? `<br><small>${esc(formatDateTime(startedAt))}</small>` : ""}</td>
      <td><strong>${esc(destination)}</strong>${endedAt ? `<br><small>${esc(formatDateTime(endedAt))}</small>` : ""}</td>
      <td>${esc(narration)}</td>
      <td class="num">${esc(formatNumber(distance))}</td>
      <td class="num">${esc(formatMoney(line.amountPaise))}</td>
      <td class="num">0.00</td>
    </tr>`;
  });

  const advanceRows = advanceLines.map((line) => {
    const meta = metaOf(line.metadata);
    const paidAt = textMeta(meta, "paidAt");
    return `<tr>
      <td>${paidAt ? esc(formatDateTime(paidAt)) : "-"}</td>
      <td></td>
      <td></td>
      <td>${esc(cleanDescription(line.description))}</td>
      <td class="num">0</td>
      <td class="num">0.00</td>
      <td class="num">${esc(formatMoney(line.amountPaise))}</td>
    </tr>`;
  });

  const dieselRows = dieselLines.map(
    (line) => `<tr>
    <td>${esc(cleanDescription(line.description).replace(/^Diesel\s*-?\s*/i, ""))}</td>
    <td class="num">${esc(formatNumber(line.quantity, 2))}</td>
    <td class="num">${esc(formatMoney(line.ratePaise))}</td>
    <td class="num">${esc(formatMoney(line.amountPaise))}</td>
  </tr>`,
  );

  const expensesByType = new Map<string, bigint>();
  for (const line of expenseLines) {
    const meta = metaOf(line.metadata);
    const label =
      textMeta(meta, "expenseType") ??
      cleanDescription(line.description).split(" (")[0] ??
      "Other expense";
    expensesByType.set(
      label,
      (expensesByType.get(label) ?? 0n) + line.amountPaise,
    );
  }
  const expenseRows = [...expensesByType.entries()].map(
    ([label, value]) => `<tr>
      <td>${esc(label)}</td>
      <td class="num">${esc(formatMoney(value))}</td>
    </tr>`,
  );

  const totalTripFreight = sumMoney(tripLines, () => true);
  const totalAdvances = sumMoney(advanceLines, () => true);
  const settlementLabel =
    Number(slip.driverPayablePaise) > 0
      ? "Payable to Driver"
      : "Receivable from Driver";
  const settlementValue =
    Number(slip.driverPayablePaise) > 0
      ? slip.driverPayablePaise
      : slip.driverReceivablePaise;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 6mm 6mm 9mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #171717;
      background: white;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.4px;
      line-height: 1.18;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: 100%; }
    .header {
      display: grid;
      grid-template-columns: 1fr 1.15fr 1fr;
      align-items: start;
      gap: 8px;
      margin-bottom: 4px;
    }
    .logo { width: 205px; max-width: 100%; height: 38px; object-fit: contain; object-position: left top; }
    .title { padding-top: 13px; text-align: center; font-size: 14px; font-weight: 800; }
    .print-meta { padding-top: 5px; text-align: right; font-size: 7px; }
    .print-meta strong { font-size: 8px; }
    .header-rule { border-top: 1.5px solid #222; margin-bottom: 4px; }
    .identity {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      padding: 1px 3px 4px;
    }
    .info-row { display: grid; grid-template-columns: 82px 1fr; min-height: 14px; align-items: baseline; }
    .info-row span { color: #555; }
    .info-row strong { font-size: 8px; }
    .metrics { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 4px; }
    .metrics td { border: 1px solid #555; padding: 2px 4px; }
    .metrics .metric-label { color: #555; width: 12%; }
    .metrics .metric-value { text-align: right; font-weight: 700; width: 13%; }
    .section { margin-top: 4px; }
    .section-title {
      padding: 2px 3px;
      border: 1px solid #555;
      border-bottom: 0;
      background: #ececec;
      font-size: 8px;
      font-weight: 800;
    }
    table.dense { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.dense thead { display: table-header-group; }
    table.dense tr { break-inside: avoid; page-break-inside: avoid; }
    table.dense th,
    table.dense td { border: 1px solid #555; padding: 2px 3px; vertical-align: top; overflow-wrap: anywhere; }
    table.dense th { background: #e4e4e4; text-align: left; font-size: 7px; font-weight: 800; }
    table.dense td { font-size: 7px; }
    table.dense small { color: #555; font-size: 6.3px; }
    .num { text-align: right !important; white-space: nowrap; }
    .total-row td { background: #ededed; font-weight: 800; }
    .two-column {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 5px;
      align-items: start;
      margin-top: 4px;
    }
    .panel { min-width: 0; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      border: 1px solid #555;
      border-right: 0;
      margin-top: 4px;
      break-inside: avoid;
    }
    .summary-cell { border-right: 1px solid #555; padding: 3px; text-align: center; }
    .summary-cell span { display: block; min-height: 10px; color: #555; font-size: 6.5px; }
    .summary-cell strong { display: block; margin-top: 2px; font-size: 8px; }
    .driver-settlement {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid #555;
      border-right: 0;
      margin-top: 4px;
      break-inside: avoid;
    }
    .driver-settlement .summary-cell:last-child { background: #ededed; }
    .remarks { margin-top: 4px; padding: 3px 4px; border: 1px solid #777; font-size: 7px; break-inside: avoid; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 20px; break-inside: avoid; }
    .signature { border-top: 1px dotted #333; padding-top: 3px; text-align: center; font-size: 7px; }
    .footer {
      margin-top: 4px;
      border-top: 0.5px solid #aaa;
      padding-top: 1.5px;
      color: #666;
      text-align: center;
      font-size: 6px;
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>${assets.headerImageSrc ? `<img class="logo" src="${assets.headerImageSrc}" alt="S K Translines" />` : "<strong>S K TRANS LINES PVT. LTD.</strong>"}</div>
      <div class="title">Vehicle Log Slip</div>
      <div class="print-meta">Printed: <strong>${esc(formatDateTime(new Date()))}</strong><br>Status: <strong>${esc(slip.status.replaceAll("_", " "))}</strong></div>
    </header>
    <div class="header-rule"></div>

    <section class="identity">
      <div>
        ${infoRow("Log Slip No.", slip.logSlipNumber ?? "(draft)")}
        ${infoRow("Driver Name", slip.driver.name)}
        ${infoRow("Vehicle No.", slip.vehicle.vehicleNumber)}
        ${infoRow("Journey No.", slip.journey.journeyNumber)}
      </div>
      <div>
        ${infoRow("Start Date", formatDateTime(slip.journey.startedAt))}
        ${infoRow("Return Date", formatDateTime(slip.journey.closedAt))}
        ${infoRow("Log Slip Date", formatDateTime(slip.logSlipDate))}
        ${infoRow("Total Days", slip.totalDays)}
      </div>
    </section>

    <table class="metrics">
      <tr>
        <td class="metric-label">Opening KM</td><td class="metric-value">${esc(formatNumber(slip.openingKm, 2))}</td>
        <td class="metric-label">Closing KM</td><td class="metric-value">${esc(formatNumber(slip.closingKm, 2))}</td>
        <td class="metric-label">Running KM</td><td class="metric-value">${esc(formatNumber(slip.totalKm, 2))}</td>
        <td class="metric-label">Diesel Fillup</td><td class="metric-value">${esc(formatNumber(slip.totalDieselQty, 2))}</td>
      </tr>
      <tr>
        <td class="metric-label">Actual Average</td><td class="metric-value">${esc(formatNumber(slip.actualAverage, 2))}</td>
        <td class="metric-label">Standard Average</td><td class="metric-value">${esc(formatNumber(slip.standardAverage, 2))}</td>
        <td class="metric-label">Expected Diesel</td><td class="metric-value">${esc(formatNumber(slip.expectedDieselQty, 2))}</td>
        <td class="metric-label">Short Diesel</td><td class="metric-value">${esc(formatNumber(slip.shortDieselQty, 2))}</td>
      </tr>
    </table>

    <section class="section">
      <div class="section-title">Trip Details</div>
      <table class="dense">
        <colgroup>
          <col style="width: 14%" /><col style="width: 12%" /><col style="width: 12%" />
          <col style="width: 38%" /><col style="width: 7%" /><col style="width: 8.5%" /><col style="width: 8.5%" />
        </colgroup>
        <thead><tr><th>LR No. / Date</th><th>Source</th><th>Destination</th><th>Consignor / Narration</th><th class="num">Distance</th><th class="num">Freight</th><th class="num">Advance</th></tr></thead>
        <tbody>
          ${[...tripRows, ...advanceRows].join("") || `<tr><td colspan="7">No trip or advance lines found</td></tr>`}
          <tr class="total-row"><td colspan="4">Total</td><td class="num">${esc(formatNumber(slip.totalKm))}</td><td class="num">${esc(formatMoney(totalTripFreight))}</td><td class="num">${esc(formatMoney(totalAdvances))}</td></tr>
        </tbody>
      </table>
    </section>

    <div class="two-column">
      <section class="panel">
        <div class="section-title">Diesel Particulars</div>
        <table class="dense">
          <colgroup><col style="width: 62%" /><col style="width: 12%" /><col style="width: 12%" /><col style="width: 14%" /></colgroup>
          <thead><tr><th>Pump / Particular</th><th class="num">Liter</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${dieselRows.join("") || `<tr><td colspan="4">No diesel entries</td></tr>`}
            <tr class="total-row"><td>Total</td><td class="num">${esc(formatNumber(slip.totalDieselQty, 2))}</td><td></td><td class="num">${esc(formatMoney(slip.totalDieselAmountPaise))}</td></tr>
          </tbody>
        </table>
      </section>
      <section class="panel">
        <div class="section-title">Other Expenses</div>
        <table class="dense">
          <colgroup><col style="width: 68%" /><col style="width: 32%" /></colgroup>
          <thead><tr><th>Expense</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${expenseRows.join("") || `<tr><td colspan="2">No other expenses</td></tr>`}
            <tr class="total-row"><td>Total</td><td class="num">${esc(formatMoney(sumMoney(expenseLines, () => true)))}</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <section class="summary-grid">
      <div class="summary-cell"><span>Total Freight (A)</span><strong>${esc(formatMoney(slip.totalFreightPaise))}</strong></div>
      <div class="summary-cell"><span>Diesel Expenses</span><strong>${esc(formatMoney(slip.totalDieselAmountPaise))}</strong></div>
      <div class="summary-cell"><span>Other Expenses</span><strong>${esc(formatMoney(sumMoney(expenseLines, () => true)))}</strong></div>
      <div class="summary-cell"><span>Total Expenses (B)</span><strong>${esc(formatMoney(slip.totalExpensePaise))}</strong></div>
      <div class="summary-cell"><span>Net Difference (A-B)</span><strong>${esc(formatMoney(slip.netVehicleResultPaise))}</strong></div>
    </section>

    <section class="driver-settlement">
      <div class="summary-cell"><span>Driver Advance</span><strong>${esc(formatMoney(slip.totalAdvancePaise))}</strong></div>
      <div class="summary-cell"><span>Driver Cash Expenses</span><strong>${esc(formatMoney(slip.driverCashExpensePaise))}</strong></div>
      <div class="summary-cell"><span>${esc(settlementLabel)}</span><strong>${esc(formatMoney(settlementValue))}</strong></div>
      <div class="summary-cell"><span>Prepared By</span><strong>${esc(generatedBy)}</strong></div>
    </section>

    ${slip.remarks ? `<div class="remarks"><strong>Remark:</strong> ${esc(slip.remarks)}</div>` : ""}

    <section class="signatures">
      <div class="signature">Prepared &amp; Checked By<br>(${esc(generatedBy)})</div>
      <div class="signature">Authorised Sign</div>
      <div class="signature">Accountant Sign</div>
    </section>
  </main>
  <footer class="footer">S K Translines Pvt. Ltd. - Vehicle Log Slip ${esc(slip.logSlipNumber ?? "")}</footer>
</body>
</html>`;
};
