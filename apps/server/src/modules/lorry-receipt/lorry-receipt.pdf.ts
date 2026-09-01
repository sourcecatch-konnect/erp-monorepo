import path from "node:path";
import { Prisma } from "../../../generated/prisma/index.js";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import { paiseToRupees } from "../../lib/money.js";

const logoSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.jpg"),
);
const watermarkSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/watermark.jpg"),
);
const tripSelect = {
  tripName: true,
  tripNumber: true,
  vehicle: { select: { vehicleNumber: true } },
  driver: { select: { name: true, mobile: true, licenseNo: true } },
} satisfies Prisma.VehicleTripSelect;

const partySelect = {
  name: true,
  address: true,
  gstNo: true,
  contactPhone: true,
  mobileNo: true,
  city: { select: { name: true } },
  state: { select: { name: true } },
} satisfies Prisma.CustomerSelect;

const locationSelect = {
  name: true,
  address: true,
  contactName: true,
  contactPhone: true,
  gstNo: true,
  city: { select: { name: true } },
} satisfies Prisma.CustomerLocationSelect;

export const lrPdfInclude = {
  group: {
    include: {
      consignor: { select: partySelect },
      consignee: { select: partySelect },
      originBranch: {
        select: {
          name: true,
          branchCode: true,
          address: true,
          contactPhone: true,
          gstNo: true,
          company: {
            select: {
              name: true,
              address: true,
              companyPAN: true,
              contactPhone: true,
              branches: {
                select: {
                  name: true,
                  branchCode: true,
                  contactPhone: true,
                },
                orderBy: { name: "asc" },
              },
            },
          },
        },
      },
      destinationBranch: {
        select: {
          name: true,
          branchCode: true,
          address: true,
          contactPhone: true,
        },
      },
      hub: { select: { name: true } },
      order: { select: { orderNumber: true, orderType: true } },
      primaryTrip: { select: tripSelect },
      secondaryTrip: { select: tripSelect },
      finalisedBy: { select: { firstName: true, lastName: true } },
    },
  },
  loadingLocation: { select: locationSelect },
  unloadingLocation: { select: locationSelect },
  goods: true,
  ewayBill: true,
  delivery: true,
  acknowledgement: {
    include: {
      items: true,
    },
  },
  createdBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.LorryReceiptInclude;

export type LrPdfData = Prisma.LorryReceiptGetPayload<{
  include: typeof lrPdfInclude;
}>;

type LrCopy = "CONSIGNOR COPY" | "CONSIGNEE COPY" | "OFFICE COPY";

const DEFAULT_COPIES: LrCopy[] = [
  "CONSIGNOR COPY",
  "CONSIGNEE COPY",
  "OFFICE COPY",
];

const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const display = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  return esc(value);
};

const fmtDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const fmtDateTime = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const fmtMoney = (paise: bigint | number | null | undefined) => {
  if (paise === null || paise === undefined) return "—";
  return paiseToRupees(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtWeight = (
  weight: Prisma.Decimal | number | null | undefined,
  unit?: string | null,
) => {
  if (weight === null || weight === undefined) return "—";
  const numeric = Number(weight);
  if (Number.isNaN(numeric)) return "—";
  const value = numeric.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${value} ${esc(unit)}` : value;
};

const personName = (
  person: { firstName?: string | null; lastName?: string | null } | null | undefined,
) => display([person?.firstName, person?.lastName].filter(Boolean).join(" "));

const TRANSPORT_LABELS: Record<string, string> = {
  Road: "By Road",
  Rail: "By Railway",
  RoadAndRail: "By Road & Railway",
};

/* Code 39 supports the characters used by SKT LR numbers, including '/'. */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw",
  "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn",
  "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn",
  "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw",
  C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn",
  I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww",
  L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww",
  O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww",
  R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn",
  X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn",
  "$": "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn",
  "%": "nnnwnwnwn", "*": "nwnnwnwnn",
};

const code39Svg = (raw: string) => {
  const value = raw.toUpperCase().replace(/[^0-9A-Z.\- $/+%]/g, "-");
  const encoded = `*${value}*`;
  const narrow = 1.25;
  const wide = 3.25;
  let x = 2;
  const bars: string[] = [];

  for (const character of encoded) {
    const pattern = CODE39[character] ?? CODE39["-"]!;
    pattern.split("").forEach((widthType, index) => {
      const width = widthType === "w" ? wide : narrow;
      if (index % 2 === 0) {
        bars.push(`<rect x="${x}" y="1" width="${width}" height="26" />`);
      }
      x += width;
    });
    x += narrow;
  }

  return `<svg class="barcode" viewBox="0 0 ${x + 2} 34" role="img" aria-label="${esc(value)}" preserveAspectRatio="none">
    <g fill="#000">${bars.join("")}</g>
    <text x="${x / 2}" y="33" text-anchor="middle" font-size="4.4" font-family="monospace">${esc(value)}</text>
  </svg>`;
};

const partyAddress = (
  party: LrPdfData["group"]["consignor"] | null | undefined,
) =>
  [party?.address, party?.city?.name, party?.state?.name]
    .filter(Boolean)
    .map(esc)
    .join(", ");

const locationText = (location: LrPdfData["loadingLocation"]) =>
  location
    ? [location.name, location.address, location.city?.name]
      .filter(Boolean)
      .map(esc)
      .join(", ")
    : "—";

const TERMS = [
  "Goods are carried at the declared risk shown on this LR. The owner should arrange suitable transit insurance.",
  "The carrier is not responsible for loss or damage caused by accident, fire, theft, leakage, natural events or circumstances beyond reasonable control, except where imposed by law.",
  "The consignor is responsible for the accuracy of the goods description, quantity, invoice, challan and e-way bill particulars.",
  "Delivery will be made to the named consignee or its authorised representative against this LR or valid authorisation.",
  "Detention and other applicable charges may be levied when a vehicle is held beyond the agreed free period at loading or unloading.",
  "Shortage or damage must be recorded at delivery and acknowledged by the driver and consignee representative.",
  "All disputes are subject to Jalgaon jurisdiction.",
  "An acknowledgement must be given on the original copy.",
];

const buildCopy = (
  lr: LrPdfData,
  copyLabel: LrCopy,
  copyIndex: number,
  totalCopies: number,
  withLetterhead: boolean,
) => {
  const group = lr.group;
  const paymentModeLabel =
    group.paymentMode === "TO_PAY"
      ? "TO PAY"
      : "TO BE BILLED";
  const company = group.originBranch.company;
  const isMarket = group.isMarketVehicle;
  const driver = isMarket ? null : group.primaryTrip?.driver;
  const vehicleNumber = isMarket
    ? group.marketVehicleNumber
    : group.primaryTrip?.vehicle?.vehicleNumber;
  const driverName = isMarket ? group.marketDriverName : driver?.name;
  const totalPackages = lr.goods.reduce((sum, item) => sum + item.quantity, 0);
  const receivedByGoods = new Map(
    (lr.acknowledgement?.items ?? []).map((item) => [
      item.lrGoodsId,
      item.receivedQty == null ? null : Number(item.receivedQty),
    ]),
  );
  const printedBy = group.finalisedBy ?? lr.createdBy;
  const routeVia = group.hub?.name && group.tripLegType !== "DIRECT"
    ? group.hub.name
    : null;
  const loadType = group.order?.orderType === "Item" ? "PTL" : "FTL";

  const goodsDescription = lr.goods.length
    ? lr.goods
      .map((item) => `${esc(item.name)}${item.description ? ` – ${esc(item.description)}` : ""}`)
      .join("<br />")
    : "—";

  const acknowledgementRows = lr.goods.length
    ? lr.goods.map((item) => `
        <tr>
          <td>${esc(item.name)}</td>
          <td class="number">${item.quantity.toLocaleString("en-IN")}</td>
          <td class="number">${receivedByGoods.get(item.id)?.toLocaleString("en-IN") ?? ""}</td>
        </tr>`).join("")
    : `<tr><td>&nbsp;</td><td></td><td></td></tr>`;

  const contacts = company.branches
    .filter((branch) => branch.contactPhone)
    .map((branch) => `${esc(branch.name)}: ${esc(branch.contactPhone)}`)
    .join(" &nbsp;◇&nbsp; ");

  const statusWatermark = lr.status === "CANCELLED"
    ? `<div class="status-watermark cancelled">CANCELLED</div>`
    : lr.status === "DRAFT"
      ? `<div class="status-watermark">DRAFT</div>`
      : "";

  return `
  <section class="lr-page${copyIndex < totalCopies - 1 ? " page-break" : ""}">
    ${withLetterhead ? `<img class="stationery-watermark" src="${watermarkSrc}" alt="" />` : ""}
    ${statusWatermark}

    <header class="letterhead">
      ${withLetterhead
      ? `<div class="letterhead-top">
             <span>Subject to Jalgaon Junction</span>
             <span>CIN: U63000MH2004PTC148258</span>
           </div>
           <div class="brand-row">
             <img class="brand-logo" src="${logoSrc}" alt="${esc(company.name)}" />
        
           </div>
           <div class="company-line"><strong>Corporate Office:</strong> ${display("S K Tower, A-52, Ayodhya Nagar Road, Old MIDC, Jalgaon - 425003")}</div>
           <div class="company-line">
             Tel.: ${display(company.contactPhone ?? "0257-2270651, 2270010")} &nbsp;•&nbsp;
             Web: www.sktranslines.com
           </div>`
      : `<div class="blank-letterhead"></div>`}
    </header>

${withLetterhead
      ? `<div class="title-row">
       <div class="doc-title">
         <span>LORRY RECEIPT</span>
       </div>
     </div>`
      : `<div class="title-row title-row-empty"></div>`}

<div class="copy-row">
  <div class="copy-label">${copyLabel}</div>

  <div class="lr-info-box">
    <div>
      <strong>LR No.:</strong>
      <span class="mono">${esc(lr.lrNumber)}</span>
    </div>

    <div>
      <strong>Date:</strong>
      ${esc(fmtDate(lr.createdAt))}
    </div>
  </div>
</div>

    <div class="party-grid ruled">
      <div class="party-box">
        <div><strong>CONSIGNOR:</strong> <span class="party-name">${display(group.consignor?.name)}</span></div>
        <div class="small">${partyAddress(group.consignor) || "—"}</div>
        <div><strong>GST No:</strong> ${display(group.consignor?.gstNo)}</div>
      </div>
      <div class="party-box">
        <div><strong>CONSIGNEE:</strong> <span class="party-name">${display(group.consignee?.name)}</span></div>
        <div class="small">${partyAddress(group.consignee) || "—"}</div>
        <div><strong>GST No:</strong> ${display(group.consignee?.gstNo)}</div>
      </div>
    </div>

    <div class="route-grid">
      <div><strong>FROM:</strong> ${display(group.originBranch.name)}</div>
      <div><strong>TO:</strong> ${display(group.destinationBranch.name)}</div>
    </div>
    <div class="line-row"><strong>Delivery At:</strong> ${locationText(lr.unloadingLocation)}</div>
   <div class="line-row split-four">
  <span><strong>Driver:</strong> ${display(driverName)}</span>
  <span><strong>Truck No:</strong> ${display(vehicleNumber)}</span>
  <span><strong>By:</strong> ${display(
        TRANSPORT_LABELS[group.transportType] ?? group.transportType,
      )}</span>
  <span>
    <strong>Payment Mode:</strong>
    ${esc(paymentModeLabel)}
  </span>
</div>
    <div class="line-row split-two">
      <span><strong>E-Way Bill No:</strong> ${display(lr.ewayBill?.ewayBillNo)}</span>
      <span><strong>Valid Till:</strong> ${lr.ewayBill ? esc(fmtDate(lr.ewayBill.expiresAt)) : "—"}</span>
    </div>

    <table class="details-table">
      <tbody>
        <tr>
          <th>Goods Description</th>
          <th>Challan / Invoice No.</th>
          <th>Total Weight</th>
          <th>Load Type</th>
        </tr>
        <tr>
          <td rowspan="3" class="goods-description">${goodsDescription}</td>
          <td>${display(lr.invoiceNumber)}</td>
          <td>${fmtWeight(lr.totalWeight, lr.unit)}</td>
          <td>${loadType}</td>
        </tr>
        <tr>
          <td><strong>Invoice No:</strong> ${display(lr.invoiceNumber)}</td>
          <td><strong>No. of Packages:</strong></td>
          <td>${totalPackages.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td><strong>Invoice Rs:</strong> ${fmtMoney(lr.invoiceAmount)}</td>
          <td><strong>Delivery Point:</strong></td>
          <td>${display(lr.unloadingLocation?.name ?? lr.unloadingLocation?.city?.name)}</td>
        </tr>
        <tr>
          <td><strong>RISK:</strong> Owner</td>
          <td><strong>Seal No:</strong> ${display(group.sealNumber)}</td>
          <td><strong>Via:</strong></td>
          <td>${display(routeVia)}</td>
        </tr>
      </tbody>
    </table>

    <div class="legal-grid">
      <div>
        <div><strong>PAN No:</strong> ${display(company.companyPAN)}</div>
        <div><strong>GSTIN:</strong> ${display(group.originBranch.gstNo)}</div>
        <div><strong>GST:</strong> Payable under RCM as applicable</div>
      </div>
      <div class="jurisdiction">
        <strong>Subject to Jalgaon Jurisdiction</strong>
        <div>For <strong>${esc(company.name)}</strong></div>
        <div class="sign-line"></div>
      </div>
    </div>

    <div class="generated-row">
      <div>${code39Svg(lr.lrNumber)}</div>
      <div>Printed: ${esc(fmtDateTime(new Date()))} &nbsp; By: ${personName(printedBy)} &nbsp; (${esc(lr.status)})</div>
    </div>

    <section class="terms">
      <h2>Terms &amp; Conditions</h2>
      <ol>${TERMS.map((term) => `<li>${esc(term)}</li>`).join("")}</ol>
    </section>

    <section class="acknowledgement">
      <h2>Acknowledgement</h2>
      <div class="ack-meta">
        <span><strong>LR No.:</strong> ${esc(lr.lrNumber)}</span>
        <span><strong>LR Date:</strong> ${esc(fmtDate(lr.createdAt))}</span>
        <span><strong>From:</strong> ${display(group.originBranch.name)}</span>
        <span><strong>To:</strong> ${display(group.destinationBranch.name)}</span>
        <span><strong>Invoice No:</strong> ${display(lr.invoiceNumber)}</span>
      </div>
      <div class="ack-dates">
        <span><strong>In Date/Time:</strong> ${lr.delivery?.reportedAt ? esc(fmtDateTime(lr.delivery.reportedAt)) : "____________________"}</span>
        <span><strong>Out Date/Time:</strong> ${lr.delivery?.unloadingAt || lr.delivery?.deliveredAt ? esc(fmtDateTime(lr.delivery.unloadingAt ?? lr.delivery.deliveredAt)) : "____________________"}</span>
      </div>
      <table class="ack-table">
        <thead><tr><th>Goods Name</th><th>Total Qty</th><th>Received Qty</th></tr></thead>
        <tbody>${acknowledgementRows}</tbody>
      </table>
      <div class="remark"><strong>Remark:</strong> ${display(lr.acknowledgement?.remark ?? lr.delivery?.remark)}</div>
      <div class="authority-sign"><span>Seal &amp; Sign. of Authority</span></div>
    </section>

    <footer class="${withLetterhead ? "" : "preprinted-footer"}">
      ${withLetterhead ? `<div>${contacts}</div><strong>This LR is online system generated, no signature required</strong>` : ""}
      <span>${copyIndex + 1}/${totalCopies}</span>
    </footer>
  </section>`;
};

export const buildLrPdfHtml = (
  lr: LrPdfData,
  options?: {
    withLetterhead?: boolean;
    copies?: LrCopy[];
  },
): string => {
  const withLetterhead = options?.withLetterhead ?? true;
  const copies = options?.copies?.length ? options.copies : DEFAULT_COPIES;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    background: #fff;
    font-size: 11px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .lr-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    padding: 5mm 1mm 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
  }
    .title-row-empty {
  min-height: 8mm;
}
  .page-break { break-after: page; page-break-after: always; }
 .stationery-watermark {
  position: absolute;
  z-index: 0;

  top: 105mm;
  left: 50%;

  width: 115mm;
  height: 115mm;

  object-fit: contain;
  transform: translateX(-50%);
  opacity: 0.08;
}
  
  .status-watermark {
    position: absolute; top: 126mm; left: 6mm; right: 6mm; z-index: 2;
    text-align: center; transform: rotate(-22deg);
    color: rgba(0,0,0,.055); font-size: 82px; font-weight: 800;
    letter-spacing: 12px;
  }
  .status-watermark.cancelled { color: rgba(150,0,0,.08); }
  .lr-page > *:not(.stationery-watermark):not(.status-watermark) { position: relative; z-index: 1; }
  .letterhead { text-align: center; min-height: 31mm; height: auto; border-bottom: 1.5px solid #111; padding: 0 0 1.5mm; overflow: visible; }
  .letterhead-top { position: relative; height: 3mm; padding: 0 2mm; font-size: 6.5px; }
  .letterhead-top span:first-child { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; }
  .letterhead-top span:last-child { position: absolute; right: 0; white-space: nowrap; }
 .brand-row {
  width: calc(100% + 2mm);
  margin: 0 -1mm;
  line-height: 0;
  }

  .brand-logo {
    display: block;
    width: 100%;
    height: auto;
  }
  .certifications { width: 31mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1mm; }
  .cert-box { min-height: 12mm; border: 1px solid #777; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 6px; line-height: 1.05; }
  .cert-box strong { font-size: 7px; }
  .cert-box small { margin-top: 1mm; font-size: 5px; text-transform: uppercase; }
  .company-line {  padding: 0 1mm; font-size: 9px; line-height: 0.85; }
  .blank-letterhead { height: 29mm; }
.title-row {
  position: relative;
  min-height: 11mm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-title {
  width: 100%;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.7px;
}
.doc-title span {
  display: inline-block;
  padding: 2px 14px;
  background: #f4d43f;
  box-shadow: 0 0 9px rgba(244, 212, 63, 0.65);
}

.copy-row {
  position: relative;
  min-height: 11mm;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
}

.copy-label {
  width: 100%;
  padding: 3px;
  text-align: center;
  font-size: 10px;
  font-weight: 800;
}

.lr-info-box {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 52mm;
  display: grid;
  grid-template-rows: 1fr 1fr;
  border-left: 1px solid #111;
  background: #fff;
  font-size: 11px;
  font-weight: 700;
}

.lr-info-box > div {
  display: flex;
  align-items: center;
  padding: 2px 5px;
  white-space: nowrap;
}

.lr-info-box > div + div {
  border-top: 1px solid #111;
}
  .doc-title span { display: inline-block; padding: 2px 14px; background: #f4d43f; box-shadow: 0 0 9px rgba(244,212,63,.65); }
  .lr-meta { border-left: 1px solid #111; font-size: 10px; font-weight: 700; }
  .lr-meta > div { padding: 3px 5px; }
  .lr-meta > div + div { border-top: 1px solid #111; }
  .mono { font-family: "Courier New", monospace; white-space: nowrap; }
 
  .party-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .party-box { min-height: 21mm; padding: 4px 6px; }
  .party-box + .party-box { border-left: 1px solid #111; }
  .party-name { font-size: 12px; font-weight: 800; }
  .small { min-height: 8mm; margin: 2px 0; font-size: 10px; }
  .ruled { border-bottom: 1px solid #111; }
  .line-row { min-height: 6mm; padding: 3px 5px; border-bottom: 1px solid #111; font-size: 11px; }
  .route-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border-bottom: 1px solid #111; }
  .route-grid > div { min-height: 6mm; padding: 3px 5px; min-width: 0; overflow-wrap: anywhere; }
  .route-grid > div + div { border-left: 1px solid #111; }
.split-two,
.split-three,
.split-four {
  display: grid;
  gap: 6px;
}

.split-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.split-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.lr-info-row {
  width: 100%;
  min-height: 6mm;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  margin: 0;
  border-bottom: 1px solid #111;
  font-size: 10px;
  font-weight: 700;
}

.lr-info-row > div {
  padding: 3px 5px;
}

.lr-info-row > div:first-child {
  text-align: left;
}

.lr-info-row > div:last-child {
  text-align: right;
  border-left: 1px solid #111;
}
.split-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 3px 4px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; font-size: 9px; }
  .details-table { border-left: 0; border-right: 0; }
  .details-table th:first-child, .details-table td:first-child { border-left: 0; }
  .details-table th:last-child, .details-table td:last-child { border-right: 0; }
  .details-table td {
  font-size: 9.5px;
  line-height: 1.3;
}
  .goods-description { width: 38%; }
  .legal-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #111; }
  .legal-grid > div { min-height: 18mm; padding: 4px 6px; }
  .legal-grid > div + div { border-left: 1px solid #111; }
  .jurisdiction { font-size: 9px; }
  .jurisdiction > div { margin-top: 5px; }
  .sign-line { width: 42mm; border-bottom: 1px solid #111; }
  .generated-row { display: grid; grid-template-columns: 50mm 1fr; gap: 8px; align-items: end; min-height: 12mm; padding: 3px 5px; font-size: 6.5px; text-align: right; }
  .barcode { display: block; width: 45mm; height: 10mm; }
  .terms { border-top: 1px solid #111; padding: 3px 6px; }
  h2 { margin: 0 0 3px; text-align: center; text-decoration: underline; font-size: 12px; }
  .terms ol { margin: 0; padding-left: 15px; font-size: 6.3px; line-height: 1.25; }
  .acknowledgement { margin-top: 3px; border-top: 1.5px solid #111; padding: 3px 5px 0; }
  .ack-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px 22px; font-size: 11px; }
  .ack-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 5px 0 3px; }
  .ack-table th:nth-child(2), .ack-table th:nth-child(3),
  .ack-table td:nth-child(2), .ack-table td:nth-child(3) { width: 23mm; }
  .number { text-align: right; font-weight: 700; }
  .remark { min-height: 8mm; padding-top: 3px; border-bottom: 1px solid #777; }
  .authority-sign { height: 16mm; display: flex; justify-content: flex-end; align-items: flex-end; }
  .authority-sign span { width: 58mm; padding-top: 2px; border-top: 1px dotted #333; text-align: center; font-weight: 700; }
  footer { margin-top: auto; margin-left: -1mm; margin-right: -1mm; min-height: 12mm; position: relative; padding: 3px 18mm 3px 4px; background: #bfe5f3; text-align: center; font-size: 6.5px; }
  footer strong { display: block; margin-top: 2px; font-size: 9px; }
  footer > span { position: absolute; right: 4px; bottom: 3px; font-weight: 700; }
  footer.preprinted-footer { background: transparent; }
  @media screen {
    body { background: #e5e7eb; padding: 18px; }
    .lr-page { margin: 0 auto 18px; box-shadow: 0 2px 14px rgba(0,0,0,.18); }
  }
  @media print {
    html, body { width: 210mm; }
    body { background: #fff; }
  }
</style>
</head>
<body>
${copies.map((copy, index) => buildCopy(lr, copy, index, copies.length, withLetterhead)).join("\n")}
</body>
</html>`;
};
