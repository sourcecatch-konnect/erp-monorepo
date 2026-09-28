import path from "node:path";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import type { MonthlyPnlResult } from "./vehicle-pnl-monthly.service.js";
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
