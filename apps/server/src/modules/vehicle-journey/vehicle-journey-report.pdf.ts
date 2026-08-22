import path from "node:path";
import { Prisma } from "../../../generated/prisma/index.js";
import { paiseToRupees } from "../../lib/money.js";
import { imageToBase64Src } from "../_shared/pdf.helper.js";

const headerImageSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.svg"),
);

const lrSelect = {
  where: { deletedAt: null, status: { not: "CANCELLED" as const } },
  orderBy: { createdAt: "asc" as const },
  select: { id: true, lrNumber: true, createdAt: true },
};

const groupSelect = {
  where: { deletedAt: null, status: { not: "CANCELLED" as const } },
  select: { lorryReceipts: lrSelect },
};

export const vehicleJourneyReportInclude = {
  vehicle: { select: { vehicleNumber: true } },
  driver: { select: { name: true } },
  startCity: { select: { name: true } },
  returnCity: { select: { name: true } },
  trips: {
    where: { deletedAt: null, status: { not: "Cancelled" as const } },
    orderBy: { sequenceNo: "asc" as const },
    select: {
      id: true,
      tripNumber: true,
      sequenceNo: true,
      onwardFreight: true,
      openingKm: true,
      closingKm: true,
      startDateTime: true,
      endDateTime: true,
      fromCity: { select: { name: true } },
      toCity: { select: { name: true } },
      primaryGroups: groupSelect,
      secondaryGroups: groupSelect,
    },
  },
  logSlip: {
    include: { lines: { orderBy: { sortOrder: "asc" as const } } },
  },
} satisfies Prisma.VehicleJourneyInclude;

export type VehicleJourneyReportData = Prisma.VehicleJourneyGetPayload<{
  include: typeof vehicleJourneyReportInclude;
}>;

const esc = (value: unknown) =>
  String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (value: Date | null | undefined) =>
  value
    ? value.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

const formatDateTime = (value: Date | null | undefined) =>
  value
    ? value.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "-";

const amount = (value: bigint | number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `Rs. ${paiseToRupees(Number(value)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const number = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? "-"
    : value.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const uniqueLrs = (trip: VehicleJourneyReportData["trips"][number]) => {
  const rows = [...trip.primaryGroups, ...trip.secondaryGroups].flatMap(
    (group) => group.lorryReceipts,
  );
  return [...new Map(rows.map((lr) => [lr.id, lr])).values()];
};

const lineRows = (
  journey: VehicleJourneyReportData,
  types: string[],
  emptyColumns: number,
) => {
  const lines =
    journey.logSlip?.lines.filter((line) => types.includes(line.lineType)) ??
    [];
  if (lines.length === 0) {
    return `<tr><td colspan="${emptyColumns}" class="empty">No entries</td></tr>`;
  }
  return lines
    .map(
      (line, index) => `<tr>
        <td class="center">${index + 1}</td>
        <td>${esc(line.description)}</td>
        ${types.includes("DIESEL") ? `<td class="num">${esc(number(line.quantity, 2))}</td><td class="num">${esc(amount(line.ratePaise))}</td>` : ""}
        <td class="num">${esc(amount(line.amountPaise))}</td>
      </tr>`,
    )
    .join("");
};

export const buildVehicleJourneyReportHtml = (
  journey: VehicleJourneyReportData,
) => {
  const slip = journey.logSlip!;
  const routeChain = [
    journey.startCity.name,
    ...journey.trips.map((trip) => trip.toCity?.name).filter(Boolean),
  ].join(" -> ");

  let lrSerial = 0;
  const tripRows = journey.trips
    .map((trip) => {
      const lrs = uniqueLrs(trip);
      const rows = lrs.length > 0 ? lrs : [null];
      const km =
        trip.closingKm === null
          ? null
          : Math.max(0, trip.closingKm - trip.openingKm);
      return rows
        .map(
          (lr, index) => `<tr>
            ${
              index === 0
                ? `<td rowspan="${rows.length}" class="center">${esc(trip.sequenceNo ?? "-")}</td>
                   <td rowspan="${rows.length}">${esc(`${trip.fromCity?.name ?? "?"} -> ${trip.toCity?.name ?? "?"}`)}<div class="sub">${esc(trip.tripNumber)}</div></td>`
                : ""
            }
            <td class="center">${lr ? ++lrSerial : "-"}</td>
            <td>${esc(lr?.lrNumber ?? "-")}</td>
            <td class="center">${esc(formatDate(lr?.createdAt))}</td>
            ${
              index === 0
                ? `<td rowspan="${rows.length}" class="num">${esc(amount(trip.onwardFreight))}</td>
                   <td rowspan="${rows.length}" class="num">${esc(trip.openingKm)}</td>
                   <td rowspan="${rows.length}" class="num">${esc(trip.closingKm ?? "-")}</td>
                   <td rowspan="${rows.length}" class="num">${esc(km ?? "-")}</td>`
                : ""
            }
          </tr>`,
        )
        .join("");
    })
    .join("");

  const driverBalanceLabel =
    Number(slip.driverPayablePaise) > 0
      ? "Payable to driver"
      : "Receivable from driver";
  const driverBalance =
    Number(slip.driverPayablePaise) > 0
      ? slip.driverPayablePaise
      : slip.driverReceivablePaise;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #182230; font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; }
  .header { display: grid; grid-template-columns: 165px 1fr 235px; align-items: center; gap: 12px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; }
  .logo { max-width: 155px; max-height: 43px; }
  h1 { margin: 0; text-align: center; font-size: 17px; letter-spacing: .8px; color: #173b78; }
  .subtitle { margin-top: 3px; text-align: center; font-size: 8px; color: #64748b; }
  .doc-meta { display: grid; grid-template-columns: 78px 1fr; gap: 2px 6px; font-size: 8px; }
  .doc-meta b { color: #475569; }
  .info { display: grid; grid-template-columns: repeat(6, 1fr); margin-top: 7px; border: 1px solid #94a3b8; }
  .info > div { min-height: 34px; padding: 4px 6px; border-right: 1px solid #cbd5e1; }
  .info > div:last-child { border-right: 0; }
  .label { display: block; margin-bottom: 2px; color: #64748b; font-size: 7px; text-transform: uppercase; }
  .value { font-weight: 700; }
  .route { margin-top: 5px; padding: 4px 6px; background: #eff6ff; border: 1px solid #bfdbfe; font-weight: 700; }
  h2 { margin: 8px 0 3px; padding: 3px 5px; color: #fff; background: #334155; font-size: 9px; letter-spacing: .25px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { padding: 3px 4px; border: 1px solid #64748b; background: #e2e8f0; color: #1e293b; font-size: 7.5px; text-transform: uppercase; }
  td { padding: 3px 4px; border: 1px solid #94a3b8; vertical-align: top; }
  tfoot td { font-weight: 700; background: #f1f5f9; }
  .center { text-align: center; }
  .num { text-align: right; white-space: nowrap; }
  .sub { margin-top: 1px; color: #64748b; font-size: 7px; }
  .empty { padding: 7px; text-align: center; color: #64748b; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; align-items: start; }
  .summary { display: grid; grid-template-columns: repeat(6, 1fr); margin-top: 8px; border: 1px solid #64748b; }
  .summary > div { min-height: 36px; padding: 4px 5px; border-right: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; }
  .summary > div:nth-child(6n) { border-right: 0; }
  .summary .value { font-size: 9px; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 28px; }
  .signature { padding-top: 4px; border-top: 1px solid #64748b; text-align: center; }
  .footer { margin-top: 8px; color: #64748b; text-align: center; font-size: 7px; }
</style>
</head>
<body>
  <header class="header">
    <img class="logo" src="${headerImageSrc}" />
    <div>
      <h1>VEHICLE JOURNEY REPORT</h1>
      <div class="subtitle">S K TRANS LINES PVT. LTD. - Log-slip-wise operational and settlement statement</div>
    </div>
    <div class="doc-meta">
      <b>Log Slip No.</b><span>${esc(slip.logSlipNumber ?? "-")}</span>
      <b>Log Slip Date</b><span>${esc(formatDate(slip.logSlipDate))}</span>
      <b>Status</b><span>${esc(slip.status.replaceAll("_", " "))}</span>
    </div>
  </header>

  <section class="info">
    <div><span class="label">Journey No.</span><span class="value">${esc(journey.journeyNumber)}</span></div>
    <div><span class="label">Vehicle</span><span class="value">${esc(journey.vehicle.vehicleNumber)}</span></div>
    <div><span class="label">Driver</span><span class="value">${esc(journey.driver.name)}</span></div>
    <div><span class="label">Started</span><span class="value">${esc(formatDateTime(journey.startedAt))}</span></div>
    <div><span class="label">Returned</span><span class="value">${esc(formatDateTime(journey.closedAt))}</span></div>
    <div><span class="label">Financial Year</span><span class="value">${esc(journey.fyCode)}</span></div>
  </section>
  <div class="route"><span class="label">Complete route</span>${esc(routeChain)}</div>

  <h2>ROUTE, LR AND FREIGHT DETAILS</h2>
  <table>
    <thead><tr>
      <th style="width:4%">Leg</th><th style="width:19%">Route / Trip</th><th style="width:4%">#</th>
      <th style="width:23%">LR No.</th><th style="width:10%">LR Date</th><th style="width:13%">Freight</th>
      <th style="width:8%">Opening KM</th><th style="width:8%">Closing KM</th><th style="width:7%">KM</th>
    </tr></thead>
    <tbody>${tripRows || '<tr><td colspan="9" class="empty">No journey legs</td></tr>'}</tbody>
    <tfoot><tr><td colspan="5" class="num">Total Freight</td><td class="num">${esc(amount(slip.totalFreightPaise))}</td><td colspan="2" class="num">Total KM</td><td class="num">${esc(slip.totalKm)}</td></tr></tfoot>
  </table>

  <div class="two-col">
    <div>
      <h2>DIESEL DETAILS</h2>
      <table><thead><tr><th style="width:7%">#</th><th>Particulars</th><th style="width:15%">Qty (L)</th><th style="width:20%">Rate</th><th style="width:22%">Amount</th></tr></thead>
      <tbody>${lineRows(journey, ["DIESEL"], 5)}</tbody>
      <tfoot><tr><td colspan="2" class="num">Total Diesel</td><td class="num">${esc(number(slip.totalDieselQty, 2))}</td><td></td><td class="num">${esc(amount(slip.totalDieselAmountPaise))}</td></tr></tfoot></table>
    </div>
    <div>
      <h2>OTHER EXPENSES</h2>
      <table><thead><tr><th style="width:7%">#</th><th>Particulars</th><th style="width:26%">Amount</th></tr></thead>
      <tbody>${lineRows(journey, ["EXPENSE"], 3)}</tbody>
      <tfoot><tr><td colspan="2" class="num">Total Other Expenses</td><td class="num">${esc(amount(slip.totalExpensePaise - slip.totalDieselAmountPaise))}</td></tr></tfoot></table>

      <h2>DRIVER ADVANCES</h2>
      <table><thead><tr><th style="width:7%">#</th><th>Particulars</th><th style="width:26%">Amount</th></tr></thead>
      <tbody>${lineRows(journey, ["ADVANCE"], 3)}</tbody>
      <tfoot><tr><td colspan="2" class="num">Total Advances</td><td class="num">${esc(amount(slip.totalAdvancePaise))}</td></tr></tfoot></table>
    </div>
  </div>

  <section class="summary">
    <div><span class="label">Opening KM</span><span class="value">${esc(slip.openingKm)}</span></div>
    <div><span class="label">Closing KM</span><span class="value">${esc(slip.closingKm)}</span></div>
    <div><span class="label">Total KM</span><span class="value">${esc(slip.totalKm)}</span></div>
    <div><span class="label">Total Days</span><span class="value">${esc(slip.totalDays)}</span></div>
    <div><span class="label">Total Freight</span><span class="value">${esc(amount(slip.totalFreightPaise))}</span></div>
    <div><span class="label">Total Diesel</span><span class="value">${esc(amount(slip.totalDieselAmountPaise))}</span></div>
    <div><span class="label">Cash Expenses</span><span class="value">${esc(amount(slip.totalCashExpensePaise))}</span></div>
    <div><span class="label">Credit Expenses</span><span class="value">${esc(amount(slip.totalCreditExpensePaise))}</span></div>
    <div><span class="label">Total Expenses</span><span class="value">${esc(amount(slip.totalExpensePaise))}</span></div>
    <div><span class="label">Total Advances</span><span class="value">${esc(amount(slip.totalAdvancePaise))}</span></div>
    <div><span class="label">${esc(driverBalanceLabel)}</span><span class="value">${esc(amount(driverBalance))}</span></div>
    <div><span class="label">Net Vehicle Result</span><span class="value">${esc(amount(slip.netVehicleResultPaise))}</span></div>
  </section>

  <div class="signatures"><div class="signature">Driver</div><div class="signature">Operations</div><div class="signature">Accounts</div></div>
  <div class="footer">Generated from frozen log slip ${esc(slip.logSlipNumber ?? "-")} for vehicle journey ${esc(journey.journeyNumber)}.</div>
</body>
</html>`;
};
