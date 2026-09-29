import path from "node:path";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import type {
  FreightDiffRow,
  MonthlyPnlResult,
  SheetLeg,
  SheetSlip,
} from "./vehicle-pnl-monthly.service.js";
import type { VehiclePnlRow } from "./vehicle-pnl.service.js";

/* ------------------------------------------------------------------ */
/* Printable Vehicle Performance and Vehicle P&L detail reports.        */
/* Same letterhead / watermark as the LR and GRN PDFs: "with            */
/* letterhead" prints the logo header and faint logo watermark;         */
/* "without" leaves both out for pre-printed stationery. Unlike those   */
/* one-page documents, these flow over as many pages as needed, with    */
/* table headers and the watermark repeated on every page.              */
/* ------------------------------------------------------------------ */

const logoSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.jpg"),
);
const watermarkSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/watermark.jpg"),
);

type PdfOptions = { withLetterhead?: boolean };

const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/** Whole rupees with Indian grouping, as on the accountant's sheets. */
const money = (paise: bigint | null | undefined) =>
  paise === null || paise === undefined
    ? "—"
    : Math.round(Number(paise) / 100).toLocaleString("en-IN");

/** Per-km figures are small, so keep the paise (₹117.36, not 117). */
const perKm = (paise: bigint | null) =>
  paise === null
    ? "—"
    : (Number(paise) / 100).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const moneyOrDash = (paise: bigint | null) =>
  paise === null ? "—" : money(paise);

const pctText = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;

const tone = (paise: bigint) => (paise < 0n ? "neg" : paise > 0n ? "pos" : "");

const dateText = (value: Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(value)
    : "—";

const monthText = (month: string) => {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, mon - 1, 1)));
};

const printedAt = () =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

const letterhead = (withLetterhead: boolean) =>
  withLetterhead
    ? `<header class="letterhead">
        <div class="letterhead-top"><span>Subject to Jalgaon Jurisdiction</span><span>CIN: U63000MH2004PTC148258</span></div>
        <img class="brand-logo" src="${logoSrc}" alt="" />
        <div class="company-line"><strong>Corporate Office:</strong> S K Tower, A-52, Ayodhya Nagar Road, Old MIDC, Jalgaon - 425003</div>
        <div class="company-line">Tel.: 0257-2270651, 2270010 &nbsp;&bull;&nbsp; Web: www.sktranslines.com</div>
      </header>`
    : `<div class="blank-letterhead"></div>`;

const signatures = `
  <div class="signs">
    <div class="sign">Prepared by</div>
    <div class="sign">Checked by</div>
    <div class="sign">Approved by</div>
  </div>`;

/** Page shell shared by both reports. */
const shell = (args: {
  title: string;
  landscape: boolean;
  withLetterhead: boolean;
  body: string;
}) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(args.title)}</title>
<style>
  @page { size: A4 ${args.landscape ? "landscape" : "portrait"}; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 8.5px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { position: relative; }
  /* position: fixed repeats the watermark on every printed page */
  .stationery-watermark { position: fixed; z-index: 0; top: 50%; left: 50%; width: 110mm; height: 110mm; object-fit: contain; transform: translate(-50%, -50%); opacity: 0.07; pointer-events: none; }
  .sheet > *:not(.stationery-watermark) { position: relative; z-index: 1; }
  /* keep a heading with the table under it */
  .keep { break-inside: avoid; page-break-inside: avoid; }
  .letterhead { text-align: center; border-bottom: 1.5px solid #111; padding-bottom: 2mm; }
  .letterhead-top { display: flex; justify-content: space-between; font-size: 7px; padding: 0 1mm 1mm; }
  .brand-logo { width: 100%; height: 17mm; object-fit: fill; }
  .company-line { margin-top: 1px; font-size: 7.5px; }
  .blank-letterhead { height: 28mm; }
  .title-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; margin: 3mm 0 2mm; }
  .doc-title { font-size: 13px; font-weight: 800; letter-spacing: .6px; }
  .doc-title span { display: inline-block; padding: 2px 12px; background: #f4d43f; }
  .muted { color: #555; }
  .meta { text-align: right; font-size: 9px; }
  .meta strong { font-size: 10px; }
  .cards { display: grid; gap: 0; border: 1px solid #111; margin-bottom: 2mm; }
  .cards > div { padding: 3px 6px; }
  .cards > div + div { border-left: 1px solid #111; }
  .card-label { font-size: 7px; text-transform: uppercase; letter-spacing: .3px; color: #444; }
  .card-value { font-size: 11px; font-weight: 800; }
  .note { font-size: 7.5px; color: #333; margin: 1mm 0 2mm; }
  .warn { color: #92400e; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #111; padding: 2.5px 4px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; font-size: 7.5px; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pos { color: #047857; }
  .neg { color: #b91c1c; }
  tr.loss td { background: #fdf2f2; }
  tr.total td { font-weight: 800; background: #f4f4f4; }
  h2 { margin: 3mm 0 1.5mm; font-size: 9.5px; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #111; padding-bottom: 1px; }
  .three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .kv td:first-child { color: #333; }
  .kv tr.total td:first-child { color: #111; }
  .formula { border: 1px solid #111; border-top: 0; padding: 3px 6px; font-weight: 700; }
  .signs { display: flex; justify-content: space-between; gap: 10mm; margin-top: 12mm; page-break-inside: avoid; }
  .sign { flex: 1; border-top: 1px dotted #333; padding-top: 2px; text-align: center; font-weight: 700; }
  .gen { font-size: 6.8px; color: #444; margin-top: 3mm; }
  /* Monthly vehicle sheet: one block per vehicle, never split over pages */
  .vblock { margin-bottom: 4mm; }
  .vblock .vbar td { background: #fff2a8; text-align: center; font-weight: 800; font-size: 9.5px; letter-spacing: .5px; }
  .vblock th { background: #fce4cc; text-align: center; }
  .vblock td.frt { background: #fde7f1; }
  .vblock tr.sum td { background: #e2f5d9; font-weight: 800; }
  .vblock .costs th { background: #f0f0f0; }
  .vblock .costs td.gt { background: #f7d4d4; font-weight: 800; }
  .vblock .idle { text-align: center; color: #555; font-style: italic; }
  @media screen {
    body { background: #e5e7eb; padding: 16px; }
    .sheet { width: ${args.landscape ? "281mm" : "194mm"}; margin: 0 auto; padding: 8mm; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.18); }
  }
</style>
</head>
<body>
  <div class="sheet">
    ${args.withLetterhead ? `<img class="stationery-watermark" src="${watermarkSrc}" alt="" />` : ""}
    ${letterhead(args.withLetterhead)}
    ${args.body}
    <div class="gen">Printed: ${esc(printedAt())}${args.withLetterhead ? "" : " &nbsp;&bull;&nbsp; Plain copy (no letterhead)"}</div>
  </div>
</body>
</html>`;

/* ------------------------------------------------------------------ */
/* Vehicle Performance (landscape, every own vehicle)                  */
/* ------------------------------------------------------------------ */

export const performancePeriodLabel = (from: string, to: string) =>
  from === to ? monthText(from) : `${monthText(from)} – ${monthText(to)}`;

export function buildVehiclePerformancePdfHtml(
  report: MonthlyPnlResult,
  options?: PdfOptions,
) {
  const withLetterhead = options?.withLetterhead ?? true;
  const { totals } = report;
  const multi = report.monthCount > 1;
  const label = performancePeriodLabel(report.from, report.to);

  const rows = report.rows
    .map((r, i) => {
      const period =
        r.trips > 0 ? `${dateText(r.periodFrom)} – ${dateText(r.periodTo)}` : "Idle";
      return `<tr class="${r.resultPaise < 0n ? "loss" : ""}">
        <td class="num">${i + 1}</td>
        <td><strong>${esc(r.vehicleNumber)}</strong></td>
        <td>${esc(period)}</td>
        ${multi ? `<td class="num">${r.monthsRan}/${report.monthCount}</td>` : ""}
        <td class="num">${r.trips}</td>
        <td class="num">${r.days}</td>
        <td class="num">${r.km.toLocaleString("en-IN")}</td>
        <td class="num">${money(r.freightPaise)}</td>
        <td class="num">${money(r.dieselPaise)}</td>
        <td class="num">${money(r.otherExpensePaise)}</td>
        <td class="num">${money(r.tripBalancePaise)}</td>
        <td class="num">${money(r.fixedTotalPaise)}</td>
        <td class="num">${money(r.variableTotalPaise)}</td>
        <td class="num ${tone(r.resultPaise)}"><strong>${money(r.resultPaise)}</strong></td>
        <td class="num">${money(r.freightDiffPaise)}${r.missingBookingTrips > 0 ? " *" : ""}</td>
      </tr>`;
    })
    .join("");

  const sum = (pick: (r: MonthlyPnlResult["rows"][number]) => bigint) =>
    report.rows.reduce((s, r) => s + pick(r), 0n);
  const totalRow = `<tr class="total">
    <td></td><td>Total</td><td></td>${multi ? "<td></td>" : ""}
    <td class="num">${report.rows.reduce((s, r) => s + r.trips, 0)}</td>
    <td class="num">${report.rows.reduce((s, r) => s + r.days, 0)}</td>
    <td class="num">${report.rows.reduce((s, r) => s + r.km, 0).toLocaleString("en-IN")}</td>
    <td class="num">${money(totals.freightPaise)}</td>
    <td class="num">${money(sum((r) => r.dieselPaise))}</td>
    <td class="num">${money(sum((r) => r.otherExpensePaise))}</td>
    <td class="num">${money(sum((r) => r.tripBalancePaise))}</td>
    <td class="num">${money(totals.fixedTotalPaise)}</td>
    <td class="num">${money(totals.variableTotalPaise)}</td>
    <td class="num ${tone(totals.netPaise)}">${money(totals.netPaise)}</td>
    <td class="num">${money(totals.freightDiffPaise)}</td>
  </tr>`;

  const body = `
    <div class="title-row">
      <div>
        <div class="doc-title"><span>VEHICLE PERFORMANCE REPORT</span></div>
        <div class="muted">Own vehicles · after monthly fixed and variable costs</div>
      </div>
      <div class="meta"><strong>${esc(label)}</strong><br />${totals.vehicleCount} vehicles</div>
    </div>

    <div class="cards" style="grid-template-columns: repeat(5, 1fr)">
      <div><div class="card-label">Profit vehicle amount (${totals.profitVehicleCount})</div><div class="card-value pos">${money(totals.profitAmountPaise)}</div></div>
      <div><div class="card-label">Loss vehicle amount (${totals.lossVehicleCount})</div><div class="card-value neg">${money(totals.lossAmountPaise)}</div></div>
      <div><div class="card-label">Vehicle result</div><div class="card-value ${tone(totals.netPaise)}">${money(totals.netPaise)}</div></div>
      <div><div class="card-label">Freight difference</div><div class="card-value">${money(totals.freightDiffPaise)}</div></div>
      <div><div class="card-label">Business result</div><div class="card-value ${tone(totals.businessResultPaise)}">${money(totals.businessResultPaise)}</div></div>
    </div>
    <div class="note">
      Vehicle result ${money(totals.netPaise)} + Freight difference ${money(totals.freightDiffPaise)} = Business result <strong>${money(totals.businessResultPaise)}</strong>
      &nbsp;·&nbsp; Freight ${money(totals.freightPaise)} · Booking ${money(totals.bookingFreightPaise)} · Fixed ${money(totals.fixedTotalPaise)} · Variable ${money(totals.variableTotalPaise)}
      ${totals.missingBookingTrips > 0 ? `<br /><span class="warn">* ${totals.missingBookingTrips} trip(s) left out of freight difference — LR has no booking amount.</span>` : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th class="num">Sr</th><th>Vehicle</th><th>Period</th>${multi ? `<th class="num">Months</th>` : ""}
          <th class="num">Trips</th><th class="num">Days</th><th class="num">Km</th>
          <th class="num">Freight</th><th class="num">Diesel</th><th class="num">Cash</th>
          <th class="num">Trip balance</th><th class="num">Mtly fixed</th><th class="num">Mtly variable</th>
          <th class="num">Result</th><th class="num">Freight diff</th>
        </tr>
      </thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>
    <div class="note">
      Result = trip balance (freight − diesel − cash) − monthly fixed (tax, insurance, permit, fitness, EMI, salary) − monthly variable
      (spare &amp; repairs from finalised Job Cards, tyre, other). Freight difference = booking freight billed on the LRs − onward freight
      credited to the vehicle; it is kept by the business, not by any vehicle. Worst vehicle first.
    </div>
    ${signatures}`;

  return shell({
    title: `Vehicle Performance ${label}`,
    landscape: true,
    withLetterhead,
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Vehicle P&L detail (portrait, one vehicle)                          */
/* ------------------------------------------------------------------ */

const kvRow = (label: string, value: string, cls = "") =>
  `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${value}</td></tr>`;

export function buildVehicleDetailPdfHtml(
  row: VehiclePnlRow,
  period: { from?: Date; to?: Date },
  options?: PdfOptions,
) {
  const withLetterhead = options?.withLetterhead ?? true;
  const costs = row.costs;
  const tripBalance = row.totalFreightPaise - row.totalExpensePaise;
  const fixed = costs
    ? costs.taxPaise +
      costs.insurancePaise +
      costs.permitPaise +
      costs.fitnessPaise +
      costs.emiPaise +
      costs.salaryPaise
    : null;
  const variable =
    row.repairsPaise + (costs ? costs.tyrePaise + costs.otherPaise : 0n);
  const result = tripBalance - (fixed ?? 0n) - variable;
  const headline = row.trueProfitPaise ?? row.profitAfterRepairsPaise;
  const diff = row.freightDiff;
  // The From/To filter dates are UTC calendar days (To = 23:59:59Z), so
  // format them in UTC — in IST the To date would roll over to the next day.
  const filterDate = (value?: Date) =>
    value
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(value)
      : "…";
  const periodLabel =
    period.from || period.to
      ? `${filterDate(period.from)} to ${filterDate(period.to)}`
      : "All dates";

  const trips = `<table class="kv">
    <thead><tr><th colspan="2">Trips (${row.journeyCount} · ${row.totalKm.toLocaleString("en-IN")} km)</th></tr></thead>
    <tbody>
      ${kvRow("Freight", money(row.totalFreightPaise))}
      ${kvRow("Diesel", money(row.dieselPaise))}
      ${kvRow("Other trip expenses", money(row.otherExpensePaise))}
      ${kvRow("Trip balance", money(tripBalance), "total")}
    </tbody>
  </table>`;

  const fixedTable = `<table class="kv">
    <thead><tr><th colspan="2">Monthly fixed</th></tr></thead>
    <tbody>
      ${
        costs && fixed !== null
          ? `${kvRow("Tax", money(costs.taxPaise))}
             ${kvRow("Insurance", money(costs.insurancePaise))}
             ${kvRow("Permit", money(costs.permitPaise))}
             ${kvRow("Fitness", money(costs.fitnessPaise))}
             ${kvRow("EMI", money(costs.emiPaise))}
             ${kvRow("Salary", money(costs.salaryPaise))}
             ${kvRow("Total fixed", money(fixed), "total")}`
          : `<tr><td colspan="2" class="muted">Tracked for own vehicles only.</td></tr>`
      }
    </tbody>
  </table>`;

  const variableTable = `<table class="kv">
    <thead><tr><th colspan="2">Monthly variable</th></tr></thead>
    <tbody>
      ${kvRow("Spare & repairs", money(row.repairsPaise))}
      ${costs ? kvRow("Tyre", money(costs.tyrePaise)) + kvRow("Other", money(costs.otherPaise)) : ""}
      ${kvRow("Total variable", money(variable), "total")}
    </tbody>
  </table>`;

  const monthly = row.monthly
    .map(
      (m) => `<tr>
        <td>${esc(monthText(m.month))}</td>
        <td class="num">${money(m.freightPaise)}</td>
        <td class="num">${money(m.expensePaise)}</td>
        <td class="num">${money(m.repairsPaise)}</td>
        <td class="num">${money(m.fixedCostsPaise)}</td>
        <td class="num ${tone(m.trueProfitPaise)}"><strong>${money(m.trueProfitPaise)}</strong></td>
      </tr>`,
    )
    .join("");

  const slips = row.journeys
    .map(
      (j) => `<tr>
        <td>${esc(j.logSlipNumber ?? "—")}</td>
        <td>${esc(j.journeyNumber)}</td>
        <td>${esc(dateText(j.logSlipDate))}</td>
        <td class="num">${j.totalKm.toLocaleString("en-IN")}</td>
        <td class="num">${money(j.totalFreightPaise)}</td>
        <td class="num">${money(j.totalExpensePaise)}</td>
        <td class="num ${tone(j.netResultPaise)}">${money(j.netResultPaise)}</td>
      </tr>`,
    )
    .join("");

  const body = `
    <div class="title-row">
      <div>
        <div class="doc-title"><span>VEHICLE P&amp;L</span></div>
        <div class="muted">${row.journeyCount} posted journeys · ${row.totalKm.toLocaleString("en-IN")} km</div>
      </div>
      <div class="meta"><strong>${esc(row.vehicleNumber)}</strong><br />${esc(periodLabel)}</div>
    </div>

    <div class="cards" style="grid-template-columns: repeat(4, 1fr)">
      <div><div class="card-label">${row.trueProfitPaise !== null ? "True profit" : "Profit after repairs"}</div><div class="card-value ${tone(headline)}">${money(headline)}</div></div>
      <div><div class="card-label">Before Vehicle Costs</div><div class="card-value">${money(row.profitAfterRepairsPaise)}</div></div>
      <div><div class="card-label">Margin</div><div class="card-value">${pctText(row.marginPct)}</div></div>
      <div><div class="card-label">Freight difference</div><div class="card-value">${diff ? money(diff.diff) : "—"}</div></div>
    </div>

    <h2>Profit breakdown</h2>
    <div class="three">${trips}${fixedTable}${variableTable}</div>
    <div class="formula">
      Trip balance ${money(tripBalance)}${fixed !== null ? ` − Fixed ${money(fixed)}` : ""} − Variable ${money(variable)}
      = <span class="${tone(result)}">${money(result)}</span>
    </div>
    ${
      diff
        ? `<div class="note">Company margin on this truck's loads: booking ${money(diff.booking)} − onward ${money(row.totalFreightPaise)} = ${money(diff.diff)}
           (kept by the business — not part of the truck's profit).${diff.missing > 0 ? ` <span class="warn">${diff.missing} trip(s) left out — LR has no booking amount.</span>` : ""}</div>`
        : ""
    }

    <div class="two">
      <div>
        <h2>${row.trueProfitPaise !== null ? "Per unit (after Vehicle Costs)" : "Per unit"}</h2>
        <table class="kv"><tbody>
          ${kvRow("Revenue / km", perKm(row.revenuePerKmPaise))}
          ${kvRow("Cost / km", perKm(row.costPerKmPaise))}
          ${kvRow("Profit / km", perKm(row.profitPerKmPaise))}
          ${kvRow("Profit / journey", moneyOrDash(row.profitPerJourneyPaise))}
          ${kvRow("Profit / running day", moneyOrDash(row.profitPerDayPaise))}
        </tbody></table>
      </div>
      <div>
        <h2>Operations</h2>
        <table class="kv"><tbody>
          ${kvRow("Mileage", row.actualAverage !== null ? `${row.actualAverage.toFixed(2)} km/l` : "—")}
          ${kvRow("Utilisation", `${pctText(row.utilisationPct)} (${row.daysInPeriod}/${row.periodDays} days)`)}
          ${kvRow("Empty km", pctText(row.emptyPct))}
          ${kvRow("Loaded / empty km", `${row.loadedKm.toLocaleString("en-IN")} / ${row.emptyKm.toLocaleString("en-IN")}`)}
        </tbody></table>
      </div>
    </div>

    <div class="keep">
      <h2>Monthly trend</h2>
      <table>
        <thead><tr><th>Month</th><th class="num">Freight</th><th class="num">Trip expenses</th><th class="num">Repairs</th><th class="num">Vehicle costs</th><th class="num">${row.trueProfitPaise !== null ? "True profit" : "Profit"}</th></tr></thead>
        <tbody>${monthly || `<tr><td colspan="6" class="muted">No months in range.</td></tr>`}</tbody>
      </table>
    </div>

    <div class="keep">
      <h2>Posted Log Slips</h2>
      <table>
        <thead><tr><th>Log Slip</th><th>Journey</th><th>Date</th><th class="num">Km</th><th class="num">Freight</th><th class="num">Expenses</th><th class="num">Result</th></tr></thead>
        <tbody>${slips}</tbody>
      </table>
    </div>
    ${signatures}`;

  return shell({
    title: `Vehicle P&L ${row.vehicleNumber}`,
    landscape: false,
    withLetterhead,
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Monthly vehicle sheet (landscape) — the accountant's per-vehicle    */
/* layout: every Log Slip with its legs, a total row, then the monthly */
/* fixed and variable costs and G.Total (= Result on Performance).     */
/* ------------------------------------------------------------------ */

const legDate = (value: string | null) =>
  value ? dateText(new Date(value)) : "—";

const SHEET_COLS = 17;

function sheetSlipRows(slip: SheetSlip, sr: number) {
  const legs: SheetLeg[] = slip.legs.length
    ? slip.legs
    : [{ from: "—", to: "—", lrNumbers: [], date: null, freightPaise: 0n, isEmpty: false }];
  const span = legs.length;
  // Slip-level cells span all of its legs, as on the paper sheet.
  const slipCell = (content: string, cls = "num") =>
    `<td class="${cls}" rowspan="${span}">${content}</td>`;
  return legs
    .map((leg, i) => {
      const lr = leg.lrNumbers.length
        ? esc(leg.lrNumbers.join(", "))
        : leg.isEmpty
          ? "Empty Trip"
          : "—";
      const legCells = `<td>${esc(leg.from)}</td><td>${esc(leg.to)}</td><td>${lr}</td>
        <td>${esc(legDate(leg.date))}</td><td class="num frt">${money(leg.freightPaise)}</td>`;
      if (i > 0) return `<tr>${legCells}</tr>`;
      return `<tr>
        ${slipCell(String(sr))}
        ${slipCell(esc(slip.logSlipNumber ?? "—"), "")}
        ${slipCell(esc(slip.driverName), "")}
        ${legCells}
        ${slipCell(slip.km.toLocaleString("en-IN"))}
        ${slipCell(money(slip.dieselPaise))}
        ${slipCell(money(slip.cashPaise))}
        ${slipCell(money(slip.expensePaise))}
        ${slipCell(String(slip.days))}
        ${slipCell(money(slip.freightPaise))}
        ${slipCell(`<span class="${tone(slip.netPaise)}">${money(slip.netPaise)}</span>`)}
        ${slipCell(slip.driverPayablePaise > 0n ? money(slip.driverPayablePaise) : "")}
        ${slipCell(slip.driverReceivablePaise > 0n ? money(slip.driverReceivablePaise) : "")}
      </tr>`;
    })
    .join("");
}

function vehicleBlock(row: MonthlyPnlResult["rows"][number], slips: SheetSlip[]) {
  const sum = (pick: (s: SheetSlip) => bigint) => slips.reduce((t, s) => t + pick(s), 0n);
  const net = sum((s) => s.netPaise);
  const header = `<tr>
    <th>Sr.</th><th>Log Slip No.</th><th>Driver's Name</th><th>Station</th><th>To Station</th>
    <th>L.R. No.</th><th>L.R. Date</th><th>Onward Frt</th><th>Total KM</th><th>Diesel</th>
    <th>Cash</th><th>Total Exps</th><th>Total Days</th><th>Total Frt</th><th>Net Balance</th>
    <th>Payable Amt</th><th>Receivable Amt</th>
  </tr>`;

  const body = slips.length
    ? slips.map((slip, i) => sheetSlipRows(slip, i + 1)).join("") +
      `<tr class="sum">
        <td colspan="7" class="num">Total</td>
        <td class="num">${money(sum((s) => s.freightPaise))}</td>
        <td class="num">${slips.reduce((t, s) => t + s.km, 0).toLocaleString("en-IN")}</td>
        <td class="num">${money(sum((s) => s.dieselPaise))}</td>
        <td class="num">${money(sum((s) => s.cashPaise))}</td>
        <td class="num">${money(sum((s) => s.expensePaise))}</td>
        <td class="num">${slips.reduce((t, s) => t + s.days, 0)}</td>
        <td class="num">${money(sum((s) => s.freightPaise))}</td>
        <td class="num ${tone(net)}">${money(net)}</td>
        <td class="num">${money(sum((s) => s.driverPayablePaise))}</td>
        <td class="num">${money(sum((s) => s.driverReceivablePaise))}</td>
      </tr>`
    : `<tr><td colspan="${SHEET_COLS}" class="idle">No posted Log Slips in this period — fixed costs still apply.</td></tr>`;

  const totalExp = row.fixedTotalPaise + row.variableTotalPaise;
  const costs = `<table class="costs">
    <thead><tr>
      <th>Mtly Fxd</th><th>Tax</th><th>Insurance</th><th>Permit</th><th>Fitness</th><th>EMI</th><th>Salary</th>
      <th>Mtly V'ble</th><th>Spare &amp; Repairs</th><th>Tyre</th><th>Other</th><th>Total Exp</th><th>G.Total</th>
    </tr></thead>
    <tbody><tr>
      <td></td>
      <td class="num">${money(row.taxPaise)}</td><td class="num">${money(row.insurancePaise)}</td>
      <td class="num">${money(row.permitPaise)}</td><td class="num">${money(row.fitnessPaise)}</td>
      <td class="num">${money(row.emiPaise)}</td><td class="num">${money(row.salaryPaise)}</td>
      <td></td>
      <td class="num">${money(row.repairsPaise)}</td><td class="num">${money(row.tyrePaise)}</td>
      <td class="num">${money(row.otherCostPaise)}</td><td class="num">${money(totalExp)}</td>
      <td class="num gt ${tone(row.resultPaise)}">${money(row.resultPaise)}</td>
    </tr></tbody>
  </table>`;

  return `<div class="vblock keep">
    <table>
      <thead>
        <tr class="vbar"><td colspan="${SHEET_COLS}">${esc(row.vehicleNumber)}</td></tr>
        ${slips.length ? header : ""}
      </thead>
      <tbody>${body}</tbody>
    </table>
    ${costs}
  </div>`;
}

export function buildVehicleSheetPdfHtml(
  report: MonthlyPnlResult,
  slipsByVehicle: Map<string, SheetSlip[]>,
  options?: PdfOptions,
) {
  const withLetterhead = options?.withLetterhead ?? true;
  const label = performancePeriodLabel(report.from, report.to);
  const byNumber = (a: { vehicleNumber: string }, b: { vehicleNumber: string }) =>
    a.vehicleNumber.localeCompare(b.vehicleNumber);
  // Vehicles that ran first, then idle ones — each group by vehicle number.
  const ran = report.rows.filter((r) => slipsByVehicle.has(r.vehicleId)).sort(byNumber);
  const idle = report.rows.filter((r) => !slipsByVehicle.has(r.vehicleId)).sort(byNumber);

  const blocks = [...ran, ...idle]
    .map((row) => vehicleBlock(row, slipsByVehicle.get(row.vehicleId) ?? []))
    .join("");

  const body = `
    <div class="title-row">
      <div>
        <div class="doc-title"><span>MONTHLY VEHICLE SHEET</span></div>
        <div class="muted">For the ${report.monthCount > 1 ? "period" : "month"} of ${esc(label)} · own vehicles</div>
      </div>
      <div class="meta"><strong>${esc(label)}</strong><br />${ran.length} ran · ${idle.length} idle</div>
    </div>
    ${blocks}
    <div class="note">
      G.Total = Net Balance − Mtly Fxd − Mtly V'ble; it equals the Result on the Vehicle Performance report.
      Legs, L.R. numbers and amounts are as posted on each Log Slip. Payable / Receivable is the driver settlement on the Log Slip.
    </div>
    ${signatures}`;

  return shell({
    title: `Monthly Vehicle Sheet ${label}`,
    landscape: true,
    withLetterhead,
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Freight difference, LR-wise (portrait) — booking billed on each      */
/* trip's LRs against the onward freight credited to the vehicle.       */
/* ------------------------------------------------------------------ */

export function buildFreightDiffPdfHtml(
  rows: FreightDiffRow[],
  period: { from: string; to: string },
  options?: PdfOptions,
) {
  const withLetterhead = options?.withLetterhead ?? true;
  const label = performancePeriodLabel(period.from, period.to);
  const counted = rows.filter((r) => r.bookingPaise !== null);
  const missing = rows.length - counted.length;
  const sum = (pick: (r: FreightDiffRow) => bigint) =>
    counted.reduce((s, r) => s + pick(r), 0n);
  const onward = sum((r) => r.onwardPaise);
  const booking = sum((r) => r.bookingPaise ?? 0n);
  const diff = sum((r) => r.diffPaise ?? 0n);

  const body = rows
    .map(
      (r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(r.lrNumbers.join(", ") || "—")}</td>
        <td>${esc(r.vehicleNumber)}</td>
        <td>${esc(dateText(r.tripDate))}</td>
        <td class="num">${money(r.onwardPaise)}</td>
        <td class="num">${r.bookingPaise === null ? `<span class="warn">missing</span>` : money(r.bookingPaise)}</td>
        <td class="num ${r.diffPaise === null ? "" : tone(r.diffPaise)}"><strong>${r.diffPaise === null ? "—" : money(r.diffPaise)}</strong></td>
      </tr>`,
    )
    .join("");

  const html = `
    <div class="title-row">
      <div>
        <div class="doc-title"><span>FREIGHT DIFFERENCE</span></div>
        <div class="muted">Booking freight billed on the LRs − onward freight credited to the vehicle · own vehicles</div>
      </div>
      <div class="meta"><strong>${esc(label)}</strong><br />${rows.length} trips</div>
    </div>

    <table>
      <thead><tr>
        <th class="num">Sr</th><th>L.R. No.</th><th>Vehicle</th><th>Trip date</th>
        <th class="num">Onward Freight</th><th class="num">Booking Amount</th><th class="num">Difference</th>
      </tr></thead>
      <tbody>
        ${body || `<tr><td colspan="7" class="muted">No loaded trips with LRs in this period.</td></tr>`}
        <tr class="total">
          <td></td><td colspan="3">Total${missing > 0 ? " (trips with a booking amount)" : ""}</td>
          <td class="num">${money(onward)}</td>
          <td class="num">${money(booking)}</td>
          <td class="num ${tone(diff)}">${money(diff)}</td>
        </tr>
      </tbody>
    </table>
    <div class="note">
      One row per loaded trip; a trip carrying several LRs shows them together, since the vehicle's onward freight is for the whole trip.
      Trips from posted Log Slips in the period, the same as the Vehicle Performance report — this total equals its Freight difference.
      ${missing > 0 ? `<br /><span class="warn">${missing} trip(s) marked "missing" have an LR with no booking amount and are left out of the total — enter the booking amount on the LR.</span>` : ""}
    </div>
    ${signatures}`;

  return shell({
    title: `Freight Difference ${label}`,
    landscape: false,
    withLetterhead,
    body: html,
  });
}
