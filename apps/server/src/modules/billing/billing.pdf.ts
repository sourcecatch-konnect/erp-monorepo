import { Prisma } from "../../../generated/prisma/index.js";
import { paiseToRupees } from "../../lib/money.js";
import { billDetailInclude } from "./billing.service.js";

/**
 * Bill PDF / print-preview.
 *
 * Two fixed layouts, chosen by the service customer's `splitBillsByChargeType`
 * flag (no letterhead variants, no toggles):
 *
 *  - OFF  -> "Regular" invoice  (portrait, tri-block consigner/consignee/billed-to,
 *            simple Particulars + Amount line table)
 *  - ON   -> "Standard" invoice (landscape, single Billed-To block, wide charge
 *            grid Freight / Labour / Detention / Incentive / Other Charges). The
 *            same layout serves both the freight bill and the additional-charges
 *            bill of a split customer.
 */
export const billPdfInclude = {
  ...billDetailInclude,
  taxRule: { select: { name: true, sacCode: true } },
} satisfies Prisma.BillInclude;

export type BillPdfData = Prisma.BillGetPayload<{ include: typeof billPdfInclude }>;

type BillLine = BillPdfData["lines"][number];
type BillLR = BillLine["lr"];

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */
const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const display = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  return esc(value);
};

const fmtDate = (date: Date | string | null | undefined) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    : "-";

const fmtDateTime = (date: Date | string | null | undefined) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    : "-";

/** Rupees with 2 decimals; blank cells render as "0.00", not "-". */
const money = (paise: bigint | number | null | undefined) =>
  paiseToRupees(paise ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const weightText = (
  weight: Prisma.Decimal | number | null | undefined,
  unit?: string | null,
) => {
  if (weight === null || weight === undefined) return "-";
  const numeric = Number(weight);
  if (Number.isNaN(numeric)) return "-";
  const value = numeric.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${value} ${esc(unit)}` : value;
};
const quantityOf = (lr: BillLR): number =>
  lr.goods.reduce((total, goods) => total + goods.quantity, 0);
/* ------------------------------------------------------------------ */
/* Amount in words (Indian: Lac / Crore)                               */
/* ------------------------------------------------------------------ */
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

const twoDigits = (n: number): string => {
  if (n < 20) return ONES[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones ? ` ${ONES[ones]}` : ""}`;
};

const threeDigits = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${hundreds ? `${ONES[hundreds]} Hundred${rest ? " " : ""}` : ""}${rest ? twoDigits(rest) : ""
    }`;
};

const rupeesToWords = (rupees: number): string => {
  if (rupees === 0) return "Zero";
  let remaining = rupees;
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lac = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${crore > 99 ? rupeesToWords(crore) : twoDigits(crore)} Crore`);
  if (lac) parts.push(`${twoDigits(lac)} Lac`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (remaining) parts.push(threeDigits(remaining));
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const amountInWords = (paise: bigint): string => {
  const total = Number(paise < 0n ? -paise : paise);
  const rupees = Math.floor(total / 100);
  const p = total % 100;
  return `${rupeesToWords(rupees)}${p ? ` and ${twoDigits(p)} Paise` : ""} Only`
    .replace(/\s+/g, " ")
    .trim();
};

/* ------------------------------------------------------------------ */
/* Row aggregation (bill lines grouped per LR)                         */
/* ------------------------------------------------------------------ */
const standardColumn = (
  type: string,
): "freight" | "labour" | "detention" | "incentive" | "other" => {
  switch (type) {
    case "FREIGHT":
      return "freight";
    case "HAMALI":
    case "UNLOADING":
      return "labour";
    case "DETENTION":
      return "detention";
    default:
      return "other";
  }
};

const particularLabel = (type: string) =>
  type === "FREIGHT"
    ? "Freight Charges"
    : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type BillRow = {
  lr: BillLR;
  freight: bigint;
  labour: bigint;
  detention: bigint;
  incentive: bigint;
  other: bigint;
  total: bigint;
  particulars: string[];
  supportGr: string;
};

const buildRows = (bill: BillPdfData): BillRow[] => {
  const map = new Map<string, BillRow>();
  for (const line of bill.lines) {
    let row = map.get(line.lrId);
    if (!row) {
      row = {
        lr: line.lr,
        freight: 0n,
        labour: 0n,
        detention: 0n,
        incentive: 0n,
        other: 0n,
        total: 0n,
        particulars: [],
        supportGr: "-",
      };
      map.set(line.lrId, row);
    }
    const amount =
      line.effectSnapshot === "DEDUCTION"
        ? -line.amountPaise
        : line.amountPaise;
    row[standardColumn(line.chargeTypeSnapshot)] += amount;
    row.total += amount;
    const label = particularLabel(line.chargeTypeSnapshot);
    if (!row.particulars.includes(label)) row.particulars.push(label);
  }

  const rows = [...map.values()];

  // LRs on the same truck that carry no charge of their own — surface them as
  // "Support GR" against the row that actually bills the freight.
  const billedIds = new Set(rows.map((row) => row.lr.id));
  const companions = bill.lrLinks
    .filter((link) => !billedIds.has(link.lrId))
    .map((link) => link.lr.lrNumber);
  if (companions.length && rows.length) {
    const target = rows.find((row) => row.freight > 0n) ?? rows[0]!;
    target.supportGr = companions.join(", ");
  }

  return rows;
};

const vehicleOf = (group: BillLR["group"]) => {
  const number = group.isMarketVehicle
    ? group.marketVehicleNumber
    : group.primaryTrip?.vehicle?.vehicleNumber;
  const size =
    group.marketVehicle?.vehicleTypeRef?.name ??
    group.primaryTrip?.vehicle?.vehicleTypeRef?.name ??
    null;
  return { number: number ?? null, size };
};

const DISPATCH_MODE: Record<string, string> = {
  Road: "Road",
  Rail: "Railway",
  RoadAndRail: "Road & Railway",
};

const partyAddress = (
  party:
    | { address?: string | null; city?: { name?: string | null } | null; state?: { name?: string | null } | null }
    | null
    | undefined,
) =>
  [party?.address, party?.city?.name, party?.state?.name]
    .filter(Boolean)
    .map((part) => esc(part))
    .join(", ") || "-";

/* ------------------------------------------------------------------ */
/* Shared chrome                                                       */
/* ------------------------------------------------------------------ */
const statusWatermark = (status: string) =>
  status === "CANCELLED"
    ? `<div class="status-watermark cancelled">CANCELLED</div>`
    : status === "DRAFT" || status === "PENDING_REVIEW"
      ? `<div class="status-watermark">${esc(status === "DRAFT" ? "DRAFT" : "UNAPPROVED")}</div>`
      : "";

const taxSummaryRows = (bill: BillPdfData) => {
  const lines = bill.taxLines
    .map(
      (line) =>
        `<tr><td>Add: ${esc(line.taxType)} @ ${(line.rateBps / 100).toFixed(2)}%</td><td class="num">${money(line.taxAmountPaise)}</td></tr>`,
    )
    .join("");
  const roundOff =
    bill.roundOffPaise !== 0n
      ? `<tr><td>Round Off</td><td class="num">${money(bill.roundOffPaise)}</td></tr>`
      : "";
  return { lines, roundOff };
};

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 10px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; background: #fff; display: flex; flex-direction: column; overflow: hidden; }
  .status-watermark { position: absolute; top: 45%; left: 0; right: 0; z-index: 2; text-align: center; transform: rotate(-22deg); color: rgba(0,0,0,.06); font-size: 96px; font-weight: 800; letter-spacing: 14px; pointer-events: none; }
  .status-watermark.cancelled { color: rgba(150,0,0,.08); }
  .page > * { position: relative; z-index: 1; }
  .doc-title { text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 1px; padding: 2mm 0 3mm; }
  .parties { display: grid; border: 1px solid #111; }
  .parties > div { padding: 4px 7px; }
  .party-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: #333; margin-bottom: 2px; }
  .party-name { font-size: 10px; font-weight: 800; }
  .kv { display: flex; gap: 4px; }
  .kv b { min-width: 70px; }
  table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  th, td { border: 1px solid #111; padding: 3px 5px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; font-size: 7.5px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 800; background: #f7f7f7; }
  .totals { width: 78mm; margin: 3mm 0 0 auto; }
  .totals td { border: 1px solid #111; padding: 3px 6px; }
  .totals td.num { text-align: right; white-space: nowrap; }
  .totals tr.grand td { font-weight: 800; background: #f4f4f4; font-size: 11px; }
  .words { margin-top: 2mm; border: 1px solid #111; padding: 4px 7px; font-weight: 700; }
  .note { margin-top: 2mm; font-size: 9px; color: #222; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10mm; gap: 8px; }
  .sign { width: 55mm; border-top: 1px dotted #333; padding-top: 2px; text-align: center; font-weight: 700; }
  .gen { margin-top: 4mm; font-size: 6.8px; color: #555; }
  @media screen { body { background: #e5e7eb; padding: 16px; } .page { margin: 0 auto; box-shadow: 0 2px 14px rgba(0,0,0,.18); } }
`;

/* ------------------------------------------------------------------ */
/* Regular layout (toggle OFF) — portrait                              */
/* ------------------------------------------------------------------ */
const renderRegular = (bill: BillPdfData, rows: BillRow[]): string => {
  const firstGroup = rows[0]?.lr.group;
  const consignor = firstGroup?.consignor;
  const consignee = firstGroup?.consignee;
  const origin =
    firstGroup?.originBranch?.city?.name ?? firstGroup?.originBranch?.name ?? null;
  const destination =
    firstGroup?.destinationBranch?.city?.name ??
    firstGroup?.destinationBranch?.name ??
    null;
  const dispatchMode = firstGroup
    ? DISPATCH_MODE[firstGroup.transportType] ?? firstGroup.transportType
    : "-";
  const sac = bill.taxRule?.sacCode ?? null;

  const bodyRows = rows.length
    ? rows
      .map((row, index) => {
        const vehicle = vehicleOf(row.lr.group);
        return `<tr>
          <td class="num">${index + 1}</td>
          <td>${display(row.lr.lrNumber)}</td>
          <td>${esc(fmtDate(row.lr.createdAt))}</td>
          <td>${display(row.lr.invoiceNumber)}</td>
          <td>${display(vehicle.number)}${vehicle.size ? `<br /><span class="party-label">${esc(vehicle.size)}</span>` : ""}</td>
         <td class="num">
  ${quantityOf(row.lr).toLocaleString("en-IN")}
</td>
          <td>${esc(fmtDate(row.lr.delivery?.deliveredAt))}</td>
          <td>${esc(row.particulars.join(", ") || "Freight Charges")}</td>
          <td>${display(sac)}</td>
          <td class="num">${money(row.total)}</td>
        </tr>`;
      })
      .join("")
    : `<tr><td colspan="10" style="text-align:center;color:#777;">No LR lines on this bill</td></tr>`;

  const { lines: taxRows, roundOff } = taxSummaryRows(bill);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />

<style>
  @page {
    size: A4 portrait;
    margin: 7mm;
  }

  ${BASE_CSS}

  .page {
    width: 196mm;
    min-height: 283mm;
    border: 1.5px solid #111;
  }

  /* Title */

  .regular-title {
    min-height: 14mm;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid #111;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 1px;
    text-decoration: underline;
  }

  /* Party and invoice details */

  .regular-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #111;
  }

  .regular-info-box {
    min-height: 40mm;
    padding: 3mm;
  }

  .regular-info-box:nth-child(even) {
    border-left: 1px solid #111;
  }

  .regular-info-box:nth-child(-n + 2) {
    border-bottom: 1px solid #111;
  }

  .regular-section-title {
    margin-bottom: 3mm;
    font-size: 9px;
    font-weight: 800;
  }

  .regular-party-name {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .regular-kv {
    display: grid;
    grid-template-columns: 31mm minmax(0, 1fr);
    gap: 2px;
    margin-top: 1.5mm;
    font-size: 10px;
    line-height: 1.25;
  }

  .regular-kv b {
    white-space: nowrap;
  }

  .regular-address {
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  /* LR table */

  .regular-table {
    width: 100%;
    margin: 0;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .regular-table th,
  .regular-table td {
    padding: 3px 4px;
    border: 1px solid #111;
    font-size: 9px;
    line-height: 1.25;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .regular-table th {
    background: #ededed;
    text-align: center;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0;
  }

  .regular-table td {
    min-height: 8mm;
  }

  .regular-table td:first-child {
    text-align: center;
  }

  .regular-table .num {
    text-align: right;
    white-space: nowrap;
  }

  .regular-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Full-width totals */

  .regular-totals {
    width: 100%;
    margin: 0;
    border-collapse: collapse;
  }

  .regular-totals td {
    padding: 2.5mm 3mm;
    border-right: 0;
    border-left: 0;
    border-bottom: 1px solid #111;
    font-size: 9px;
  }

  .regular-totals td:first-child {
    font-weight: 600;
  }

  .regular-totals td.num {
    width: 42mm;
    text-align: right;
    white-space: nowrap;
    font-weight: 800;
  }

  .regular-totals tr.grand td {
    background: #f1f1f1;
    font-size: 10px;
    font-weight: 800;
  }

  /* Words and tax information */

  .regular-notes {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42mm;
    min-height: 34mm;
    border-bottom: 1px solid #111;
  }

  .regular-note-content {
    padding: 3mm;
  }

  .regular-words {
    margin-bottom: 3mm;
    font-size: 9px;
  }

  .regular-words strong {
    font-size: 10px;
  }

  .regular-tax-detail {
    margin-top: 2mm;
    font-size: 8.5px;
  }

  .regular-tax-detail .regular-kv {
    margin-top: 1mm;
  }

  .regular-deduction-space {
    border-left: 1px solid #111;
  }

  /* Declaration */

  .regular-declaration {
    min-height: 9mm;
    padding: 2mm 3mm;
    border-bottom: 1px solid #111;
    font-size: 8.5px;
  }

  /* Signature */

  .regular-signatures {
    min-height: 34mm;
    margin-top: auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1.2fr;
    align-items: end;
    border-top: 1px solid #111;
  }

  .regular-signatures > div {
    min-height: 34mm;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 3mm;
    text-align: center;
    font-size: 9px;
    font-weight: 800;
  }

  .regular-signatures > div + div {
    border-left: 1px solid #111;
  }

  .regular-authority {
    flex-direction: column;
    justify-content: space-between !important;
  }

  .regular-generated {
    padding: 1mm 2mm;
    border-top: 1px solid #111;
    text-align: right;
    font-size: 6.5px;
    color: #555;
  }

  @media screen {
    body {
      background: #e5e7eb;
      padding: 16px;
    }

    .page {
      margin: 0 auto;
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
    }
  }
</style>
</head>

<body>
  <div class="page">
    ${statusWatermark(bill.status)}

    <div class="regular-title">
      TAX INVOICE
    </div>

    <div class="regular-info">
      <!-- Consignor -->

      <div class="regular-info-box">
        <div class="regular-section-title">
          Details of Consigner
        </div>

        <div class="regular-kv">
          <b>Name:</b>

          <span class="regular-party-name">
            ${display(consignor?.name)}
          </span>
        </div>

        <div class="regular-kv">
          <b>Address:</b>

          <span class="regular-address">
            ${partyAddress(consignor)}
          </span>
        </div>

        <div class="regular-kv">
          <b>State:</b>
          <span>${display(consignor?.state?.name)}</span>
        </div>

        <div class="regular-kv">
          <b>GSTIN/Unique Id:</b>
          <span>${display(consignor?.gstNo)}</span>
        </div>

        <div class="regular-kv">
          <b>PAN Number:</b>
          <span>${display(consignor?.customerPAN)}</span>
        </div>
      </div>

      <!-- Invoice information -->

      <div class="regular-info-box">
        <div class="regular-section-title">
          Invoice Details
        </div>

        <div class="regular-kv">
          <b>Invoice No.:</b>
          <span>${display(bill.billNumber)}</span>
        </div>

        <div class="regular-kv">
          <b>Date of Invoice:</b>
          <span>${esc(fmtDate(bill.billDate))}</span>
        </div>

        <div class="regular-kv">
          <b>Origin:</b>
          <span>${display(origin)}</span>
        </div>

        <div class="regular-kv">
          <b>Destination:</b>
          <span>${display(destination)}</span>
        </div>

        <div class="regular-kv">
          <b>Place of Supply:</b>
          <span>${display(bill.placeOfSupplyNameSnapshot)}</span>
        </div>

        <div class="regular-kv">
          <b>Dispatch Mode:</b>
          <span>${esc(dispatchMode)}</span>
        </div>
      </div>

      <!-- Consignee -->

      <div class="regular-info-box">
        <div class="regular-section-title">
          Details of Consignee (Shipped to)
        </div>

        <div class="regular-kv">
          <b>Name:</b>

          <span class="regular-party-name">
            ${display(consignee?.name)}
          </span>
        </div>

        <div class="regular-kv">
          <b>Address:</b>

          <span class="regular-address">
            ${partyAddress(consignee)}
          </span>
        </div>

        <div class="regular-kv">
          <b>State:</b>
          <span>${display(consignee?.state?.name)}</span>
        </div>

        <div class="regular-kv">
          <b>GSTIN/Unique Id:</b>
          <span>${display(consignee?.gstNo)}</span>
        </div>

        <div class="regular-kv">
          <b>PAN Number:</b>
          <span>${display(consignee?.customerPAN)}</span>
        </div>
      </div>

      <!-- Billed To -->

      <div class="regular-info-box">
        <div class="regular-section-title">
          Billed To
        </div>

        <div class="regular-kv">
          <b>Name:</b>

          <span class="regular-party-name">
            ${display(bill.billingPartyNameSnapshot)}
          </span>
        </div>

        <div class="regular-kv">
          <b>Address:</b>

          <span class="regular-address">
            ${display(bill.billingAddressSnapshot)}
          </span>
        </div>

        <div class="regular-kv">
          <b>State:</b>
          <span>${display(bill.billingCustomer?.state?.name)}</span>
        </div>

        <div class="regular-kv">
          <b>GSTIN/Unique Id:</b>
          <span>${display(bill.billingGstinSnapshot)}</span>
        </div>

        <div class="regular-kv">
          <b>PAN Number:</b>
          <span>${display(bill.billingCustomer?.customerPAN)}</span>
        </div>
      </div>
    </div>

    <table class="regular-table">
      <colgroup>
        <col style="width:4%" />
        <col style="width:12%" />
        <col style="width:10%" />
        <col style="width:12%" />
        <col style="width:11%" />
        <col style="width:9%" />
        <col style="width:10%" />
        <col style="width:18%" />
        <col style="width:7%" />
        <col style="width:7%" />
      </colgroup>

      <thead>
        <tr>
          <th>Sr.</th>
          <th>LR No.</th>
          <th>LR Date</th>
          <th>Invoice No.</th>
          <th>Truck No.</th>
<th class="num">QTY</th>
          <th>Del. Date</th>
          <th>Particulars</th>
          <th>SAC No.</th>
          <th class="num">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${bodyRows}
      </tbody>
    </table>

    <table class="regular-totals">
      <tbody>
        <tr>
          <td>Total Taxable Value</td>

          <td class="num">
            ${money(bill.subtotalAmountPaise)}
          </td>
        </tr>

        ${taxRows}
        ${roundOff}

        <tr class="grand">
          <td>Total Invoice Value (In figures)</td>

          <td class="num">
            ${money(bill.totalAmountPaise)}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="regular-notes">
      <div class="regular-note-content">
        <div class="regular-words">
          In Words:
          <strong>
            ${esc(amountInWords(bill.totalAmountPaise))}
          </strong>
        </div>

        <div class="regular-tax-detail">
          <div class="regular-kv">
            <b>PAN:</b>
            <span>${display(bill.company?.companyPAN)}</span>
          </div>

          <div class="regular-kv">
            <b>GSTIN:</b>
            <span>${display(bill.supplierGstinSnapshot)}</span>
          </div>

          <div style="margin-top:2mm;">
            Tax Paid by <strong>Transporter</strong>
          </div>
        </div>
      </div>

      <div class="regular-deduction-space"></div>
    </div>

    <div class="regular-declaration">
      Declaration (If Any): Ok
    </div>

    <div class="regular-signatures">
      <div>Prepared by</div>

      <div>Checked by</div>

      <div class="regular-authority">
        <span>
          For ${esc(bill.supplierNameSnapshot)}
        </span>

        <span>Authorised Signatory</span>
      </div>
    </div>

    <div class="regular-generated">
      Printed: ${esc(fmtDateTime(new Date()))}
      &nbsp;&bull;&nbsp;
      Bill ${display(bill.billNumber ?? bill.id)}
      (${esc(bill.status)})
    </div>
  </div>
</body>
</html>`;
};

/* ------------------------------------------------------------------ */
/* Standard layout (toggle ON) — landscape, wide charge grid           */
/* ------------------------------------------------------------------ */
const renderStandard = (bill: BillPdfData, rows: BillRow[]): string => {
  const sac = bill.taxRule?.sacCode ?? null;

  const sum = (pick: (row: BillRow) => bigint) =>
    rows.reduce((total, row) => total + pick(row), 0n);

  const bodyRows = rows.length
    ? rows
      .map((row) => {
        const vehicle = vehicleOf(row.lr.group);
        const group = row.lr.group;
        const from =
          group.originBranch?.city?.name ?? group.originBranch?.name ?? null;
        const to =
          group.destinationBranch?.city?.name ??
          group.destinationBranch?.name ??
          null;
        return `<tr>
          <td>${display(row.lr.invoiceNumber)}</td>
          <td>${esc(fmtDate(row.lr.createdAt))}</td>
          <td>${display(row.lr.lrNumber)}</td>
    
          <td>${display(vehicle.number)}</td>
          <td>${display(vehicle.size)}</td>
          <td>${display(from)}</td>
          <td>${display(to)}</td>
        <td class="num">
  ${quantityOf(row.lr).toLocaleString("en-IN")}
</td>
          <td class="num">${money(row.freight)}</td>
          <td class="num">${money(row.labour)}</td>
          <td class="num">${money(row.detention)}</td>
          <td class="num">${money(row.incentive)}</td>
          <td class="num">${money(row.other)}</td>
          <td class="num">${money(row.total)}</td>
        </tr>`;
      })
      .join("")
    : `<tr><td colspan="15" style="text-align:center;color:#777;">No LR lines on this bill</td></tr>`;

  const { lines: taxRows, roundOff } = taxSummaryRows(bill);
  const fyLabel = bill.fyCode ?? "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />

<style>
  @page {
    size: A4 landscape;
    margin: 7mm;
  }

  ${BASE_CSS}

  .page {
    width: 283mm;
    min-height: 196mm;
    padding: 2mm;
    border: 1.5px solid #111;
  }

  /* Invoice heading */

  .std-title {
    padding: 1.5mm 0;
    border-bottom: 1px solid #111;
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.8px;
  }

  /* Company information */

  .std-company {
    padding: 2mm 3mm;
    border-bottom: 1px solid #111;
    text-align: center;
  }

  .std-company-name {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .std-company-address {
    margin-top: 1px;
    font-size: 8px;
  }

  .std-company-tax {
    margin-top: 2px;
    display: flex;
    justify-content: center;
    gap: 8mm;
    font-size: 8px;
    font-weight: 700;
  }

  /* Customer and billing details */

  .std-info {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 78mm;
    border-bottom: 1px solid #111;
  }

  .std-info > div {
    min-height: 29mm;
    padding: 2mm 3mm;
  }

  .std-info > div + div {
    border-left: 1px solid #111;
  }

  .std-section-title {
    margin-bottom: 2px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .std-customer-name {
    margin-bottom: 1px;
    font-size: 10px;
    font-weight: 800;
  }

  .std-kv {
    display: grid;
    grid-template-columns: 27mm minmax(0, 1fr);
    gap: 2px;
    font-size: 9px;
    line-height: 1.35;
  }

  .std-kv b {
    white-space: nowrap;
  }

  /* Main charge table */

  .std-table {
    width: 100%;
    margin: 0;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .std-table th,
  .std-table td {
    padding: 2px 3px;
    border: 1px solid #111;
    font-size: 9.2px;
    line-height: 1.2;
    vertical-align: middle;
    overflow-wrap: anywhere;
  }

  .std-table th {
    background: #ededed;
    text-align: center;
    font-weight: 800;
    text-transform: none;
    letter-spacing: 0;
  }

  .std-table td {
    height: 6mm;
  }

  .std-table td.num,
  .std-table th.num {
    text-align: right;
    white-space: nowrap;
  }

  .std-table tfoot td {
    height: auto;
    padding: 3px;
    background: #f3f3f3;
    font-weight: 800;
  }

  .std-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Amount summary */

  .std-bottom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 78mm;
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;
    border-left: 1px solid #111;
  }

  .std-amount-details {
    padding: 2mm 3mm;
    font-size: 9px;
  }

  .std-amount-words {
    font-weight: 800;
  }

  .std-annexure {
    margin-top: 2mm;
    text-align: center;
    font-weight: 800;
  }

  .std-totals {
    width: 100%;
    margin: 0;
    border-collapse: collapse;
  }

  .std-totals td {
    padding: 3px 5px;
    border: 0;
    border-left: 1px solid #111;
    border-bottom: 1px solid #111;
    font-size: 9px;
  }

  .std-totals tr:last-child td {
    border-bottom: 0;
  }

  .std-totals td.num {
    text-align: right;
    white-space: nowrap;
  }

  .std-totals .grand td {
    background: #ededed;
    font-size: 10px;
    font-weight: 800;
  }

  /* Declaration and signature */

  .std-declaration {
    min-height: 13mm;
    padding: 2mm 3mm;
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;
    border-left: 1px solid #111;
    font-size: 8px;
    line-height: 1.3;
  }

  .std-signature {
    min-height: 19mm;
    display: grid;
    grid-template-columns: 1fr 65mm;
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;
    border-left: 1px solid #111;
  }

  .std-signature > div {
    padding: 2mm 3mm;
  }

  .std-signature > div + div {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-left: 1px solid #111;
    text-align: center;
    font-size: 8px;
    font-weight: 700;
  }

  .std-generated {
    padding-top: 1mm;
    text-align: right;
    font-size: 6.5px;
    color: #555;
  }

  @media screen {
    body {
      background: #e5e7eb;
      padding: 16px;
    }

    .page {
      margin: 0 auto;
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
    }
  }
</style>
</head>

<body>
  <div class="page">
    ${statusWatermark(bill.status)}

    <div class="std-title">TAX INVOICE</div>

    <div class="std-company">
      <div class="std-company-name">
        ${display(bill.supplierNameSnapshot)}
      </div>

      <div class="std-company-address">
        ${display(bill.supplierAddressSnapshot)}
      </div>

      <div class="std-company-tax">
        <span>
          PAN: ${display(bill.company?.companyPAN)}
        </span>

        <span>
          GSTIN: ${display(bill.supplierGstinSnapshot)}
        </span>
           <span>
          Email: accounts@sktranslines.com
        </span>
        <span>
        Tel: 94227050, 8806494444 (0257) 2270651, 2270010
      </span>
      </div>
    </div>

    <div class="std-info">
      <div>
        <div class="std-section-title">Billed To</div>

        <div class="std-customer-name">
          ${display(bill.billingPartyNameSnapshot)}
        </div>

        <div>
          ${display(bill.billingAddressSnapshot)}
        </div>

        <div class="std-kv">
          <b>City</b>
          <span>${display(bill.billingCustomer?.city?.name)}</span>
        </div>

        <div class="std-kv">
          <b>State</b>
          <span>${display(bill.billingCustomer?.state?.name)}</span>
        </div>

        <div class="std-kv">
          <b>GSTIN</b>
          <span>${display(bill.billingGstinSnapshot)}</span>
        </div>
      </div>

      <div>
        <div class="std-section-title">Billing Details</div>

        <div class="std-kv">
          <b>Invoice No.</b>
          <span>${display(bill.billNumber)}</span>
        </div>

        <div class="std-kv">
          <b>Invoice Date</b>
          <span>${esc(fmtDate(bill.billDate))}</span>
        </div>

        <div class="std-kv">
          <b>SAC Code</b>
          <span>${display(sac)}</span>
        </div>

        <div class="std-kv">
          <b>Place of Supply</b>
          <span>${display(bill.placeOfSupplyNameSnapshot)}</span>
        </div>
      </div>
    </div>

    <table class="std-table">
     <colgroup>
  <col style="width:8%" />
  <col style="width:7%" />
  <col style="width:10%" />
  <col style="width:9%" />
  <col style="width:7%" />
  <col style="width:7%" />
  <col style="width:7%" />
  <col style="width:5%" />
  <col style="width:7%" />
  <col style="width:6%" />
  <col style="width:6%" />
  <col style="width:6%" />
  <col style="width:8%" />
  <col style="width:7%" />
</colgroup>

      <thead>
        <tr>
          <th>Invoice No.</th>
          <th>GR Date</th>
          <th>LR No.</th>
    
          <th>Vehicle No.</th>
          <th>Vehicle Size</th>
          <th>From</th>
          <th>To</th>
          <th class="num">QTY</th>
          <th class="num">Freight</th>
          <th class="num">Labour</th>
          <th class="num">Detention</th>
          <th class="num">Incentive</th>
          <th class="num">Other Charges</th>
          <th class="num">Total Amount</th>
        </tr>
      </thead>

      <tbody>
        ${bodyRows}
      </tbody>

   <tfoot>
  <tr>
    <td colspan="7"><strong>Total</strong></td>

    <td class="num">
      ${rows
      .reduce((total, row) => total + quantityOf(row.lr), 0)
      .toLocaleString("en-IN")}
    </td>

    <td class="num">${money(sum((row) => row.freight))}</td>
    <td class="num">${money(sum((row) => row.labour))}</td>
    <td class="num">${money(sum((row) => row.detention))}</td>
    <td class="num">${money(sum((row) => row.incentive))}</td>
    <td class="num">${money(sum((row) => row.other))}</td>
    <td class="num">${money(sum((row) => row.total))}</td>
  </tr>
</tfoot>
    </table>

    <div class="std-bottom">
      <div class="std-amount-details">
        <div class="std-amount-words">
          Amount in Words:
          ${esc(amountInWords(bill.totalAmountPaise))}
        </div>

        <div class="std-annexure">
          Annexure III
        </div>
      </div>

      <table class="std-totals">
        <tbody>
          <tr>
            <td>Total Taxable Value</td>
            <td class="num">
              ${money(bill.subtotalAmountPaise)}
            </td>
          </tr>

          ${taxRows}
          ${roundOff}

          <tr class="grand">
            <td>Total</td>
            <td class="num">
              ${money(bill.totalAmountPaise)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="std-declaration">
      <strong>Declaration:</strong>
      We ${esc(bill.supplierNameSnapshot)} have taken registration under
      CGST Act 2017 (GST No. ${display(bill.supplierGstinSnapshot)}) and
      have exercised the option to pay tax on service on GTA in relation
      to transport of goods supplied by us during the financial year
      ${esc(fyLabel)} under &quot;Forward Charge&quot;.
    </div>

    <div class="std-signature">
      <div></div>

      <div>
        <span>
          For ${esc(bill.supplierNameSnapshot)}
        </span>

        <span>Authorised Signatory</span>
      </div>
    </div>

    <div class="std-generated">
      Printed: ${esc(fmtDateTime(new Date()))}
      &nbsp;&bull;&nbsp;
      Bill ${display(bill.billNumber ?? bill.id)}
      (${esc(bill.status)})
    </div>
  </div>
</body>
</html>`;
};

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */
export const buildBillPdfHtml = (bill: BillPdfData): string => {
  const rows = buildRows(bill);
  return bill.serviceCustomer?.splitBillsByChargeType
    ? renderStandard(bill, rows)
    : renderRegular(bill, rows);
};
