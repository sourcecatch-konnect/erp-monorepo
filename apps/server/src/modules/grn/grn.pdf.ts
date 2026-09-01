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

const branchSelect = {
  name: true,
  branchCode: true,
  address: true,
  contactPhone: true,
  gstNo: true,
} satisfies Prisma.BranchSelect;

const partySelect = {
  name: true,
  gstNo: true,
  address: true,
  city: { select: { name: true } },
  state: { select: { name: true } },
} satisfies Prisma.CustomerSelect;

export const grnPdfInclude = {
  goods: { orderBy: { createdAt: "asc" } },
  labour: { select: { name: true, mobileNo: true } },
  unloadingSupervisor: { select: { name: true, mobileNo: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  lorryReceipt: {
    select: {
      lrNumber: true,
      invoiceNumber: true,
      invoiceAmount: true,
      totalWeight: true,
      unit: true,
      loadingLocation: {
        select: { name: true, city: { select: { name: true } } },
      },
      unloadingLocation: {
        select: { name: true, city: { select: { name: true } } },
      },
      ewayBill: { select: { ewayBillNo: true, expiresAt: true } },
      group: {
        select: {
          groupNumber: true,
          sealNumber: true,
          transportType: true,
          isMarketVehicle: true,
          marketVehicleNumber: true,
          marketDriverName: true,
          consignor: { select: partySelect },
          consignee: { select: partySelect },
          originBranch: {
            select: {
              ...branchSelect,
              company: {
                select: {
                  name: true,
                  companyPAN: true,
                  contactPhone: true,
                  address: true,
                },
              },
            },
          },
          destinationBranch: { select: branchSelect },
          railheadBranch: { select: branchSelect },
          primaryTrip: {
            select: {
              vehicle: { select: { vehicleNumber: true } },
              driver: { select: { name: true, mobile: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GRNInclude;

export type GrnPdfData = Prisma.GRNGetPayload<{ include: typeof grnPdfInclude }>;

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

const fmtMoney = (paise: bigint | number | null | undefined) => {
  if (paise === null || paise === undefined) return "-";
  return paiseToRupees(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtWeight = (
  weight: Prisma.Decimal | number | null | undefined,
  unit?: string | null,
) => {
  if (weight === null || weight === undefined) return "-";
  const numeric = Number(weight);
  if (Number.isNaN(numeric)) return "-";
  const value = numeric.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${value} ${esc(unit)}` : value;
};

const personName = (
  person:
    | { firstName?: string | null; lastName?: string | null }
    | null
    | undefined,
) => display([person?.firstName, person?.lastName].filter(Boolean).join(" "));

const partyAddress = (party: GrnPdfData["lorryReceipt"]["group"]["consignor"]) =>
  [party?.address, party?.city?.name, party?.state?.name]
    .filter(Boolean)
    .map(esc)
    .join(", ") || "-";

const TRANSPORT_LABELS: Record<string, string> = {
  Road: "By Road",
  Rail: "By Railway",
  RoadAndRail: "By Road & Railway",
};

const CHECKS: Array<{
  key: keyof GrnPdfData;
  remark: keyof GrnPdfData;
  label: string;
}> = [
    { key: "lrCopyChecked", remark: "lrCopyRemark", label: "LR Copy" },
    { key: "invoiceChecked", remark: "invoiceRemark", label: "Invoice" },
    {
      key: "kataReceiptChecked",
      remark: "kataReceiptRemark",
      label: "Kata Receipt",
    },
    { key: "wayBillChecked", remark: "wayBillRemark", label: "Way Bill" },
    { key: "sealNoChecked", remark: "sealNoRemark", label: "Seal No." },
  ];

export const buildGrnPdfHtml = (
  grn: GrnPdfData,
  options?: { withLetterhead?: boolean },
): string => {
  const withLetterhead = options?.withLetterhead ?? true;
  const lr = grn.lorryReceipt;
  const group = lr.group;
  const company = group.originBranch.company;
  const isMarket = group.isMarketVehicle;
  const vehicleNumber = isMarket
    ? group.marketVehicleNumber
    : group.primaryTrip?.vehicle?.vehicleNumber;
  const driverName = isMarket
    ? group.marketDriverName
    : group.primaryTrip?.driver?.name;

  const goodsRows = grn.goods.length
    ? grn.goods
      .map(
        (item, index) => `
        <tr>
          <td class="number">${index + 1}</td>
          <td>${esc(item.goodsName)}${item.description
            ? `<br /><span class="small">${esc(item.description)}</span>`
            : ""
          }</td>
          <td class="number">${item.totalQty.toLocaleString("en-IN")}</td>
          <td class="number">${item.receivedQty.toLocaleString("en-IN")}</td>
          <td class="number">${item.damageQty.toLocaleString("en-IN")}</td>
          <td class="number">${item.shortageQty.toLocaleString("en-IN")}</td>
          <td>${display(item.unit)}</td>
          <td>${display(item.remarks)}</td>
        </tr>`,
      )
      .join("")
    : `<tr><td colspan="8" class="empty">No goods lines</td></tr>`;

  const checkRows = CHECKS.map((check) => {
    const ok = grn[check.key] as boolean;
    const remark = grn[check.remark] as string | null;
    return `<tr>
        <td>${esc(check.label)}</td>
        <td class="center">${ok ? "Checked" : "Pending"}</td>
        <td>${display(remark)}</td>
      </tr>`;
  }).join("");

  const statusWatermark =
    grn.status === "CANCELLED"
      ? `<div class="status-watermark cancelled">CANCELLED</div>`
      : grn.status === "DRAFT"
        ? `<div class="status-watermark">DRAFT</div>`
        : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 9px; line-height: 1.3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; padding: 6mm 8mm 10mm; display: flex; flex-direction: column; background: #fff; overflow: hidden; }
  .stationery-watermark {
  position: absolute;
  z-index: 0;
  top: 110mm;
  left: 50%;
  width: 115mm;
  height: 115mm;
  object-fit: contain;
  transform: translateX(-50%);
  opacity: 0.07;
}
  .status-watermark { position: absolute; top: 120mm; left: 8mm; right: 8mm; z-index: 2; text-align: center; transform: rotate(-22deg); color: rgba(0,0,0,.06); font-size: 88px; font-weight: 800; letter-spacing: 14px; }
  .status-watermark.cancelled { color: rgba(150,0,0,.08); }
  .page > *:not(.stationery-watermark):not(.status-watermark) {
  position: relative;
  z-index: 1;
}

.stationery-watermark,
.status-watermark {
  position: absolute;
  pointer-events: none;
}
  .letterhead { text-align: center; border-bottom: 1.5px solid #111; padding-bottom: 2mm; }
  .letterhead-top { display: flex; justify-content: space-between; font-size: 7px; padding: 0 1mm 1mm; }
  .brand-logo { width: 100%; height: 17mm; object-fit: fill; }
  .company-line { margin-top: 1px; font-size: 7.5px; }
  .blank-letterhead { height: 28mm; }
  .title-row { display: grid; grid-template-columns: 1fr 58mm; align-items: stretch; border: 1px solid #111; border-top: 0; }
  .doc-title { align-self: center; text-align: center; font-size: 13px; font-weight: 800; letter-spacing: .6px; }
  .doc-title span { display: inline-block; padding: 2px 16px; background: #f4d43f; }
  .doc-meta { border-left: 1px solid #111; font-size: 10px; font-weight: 700; }
  .doc-meta > div { padding: 3px 6px; }
  .doc-meta > div + div { border-top: 1px solid #111; }
  .mono { font-family: "Courier New", monospace; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #111; border-top: 0; }
  .grid-2 > div { padding: 4px 6px; }
  .grid-2 > div + div { border-left: 1px solid #111; }
  .name { font-size: 10px; font-weight: 800; }
  .small { font-size: 7.5px; color: #333; }
  .line-row { border: 1px solid #111; border-top: 0; padding: 3px 6px; }
  .split { display: grid; gap: 8px; }
  .split-3 { grid-template-columns: 1fr 1fr 1fr; }
  .split-4 { grid-template-columns: repeat(4, 1fr); }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 3px 5px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; font-size: 7.5px; }
  .number { text-align: right; white-space: nowrap; }
  .center { text-align: center; }
  .empty { text-align: center; color: #777; }
  section.block { margin-top: 4px; }
  h2 { margin: 0 0 3px; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #111; padding-bottom: 1px; }
  .charges { width: 62mm; margin-left: auto; }
  .charges td:last-child { text-align: right; white-space: nowrap; }
  .charges tr.total td { font-weight: 800; background: #f4f4f4; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6mm; font-size: 7.5px; gap: 8px; }
  .sign { width: 55mm; border-top: 1px dotted #333; padding-top: 2px; text-align: center; font-weight: 700; }
  .gen { font-size: 6.8px; color: #444; margin-top: 3mm; }
  @media screen { body { background: #e5e7eb; padding: 16px; } .page { margin: 0 auto; box-shadow: 0 2px 14px rgba(0,0,0,.18); } }
</style>
</head>
<body>
  <div class="page">
    ${withLetterhead ? `<img class="stationery-watermark" src="${watermarkSrc}" alt="" />` : ""}
    ${statusWatermark}

    <header class="letterhead">
      ${withLetterhead
      ? `<div class="letterhead-top"><span>Subject to Jalgaon Jurisdiction</span><span>CIN: U63000MH2004PTC148258</span></div>
             <img class="brand-logo" src="${logoSrc}" alt="${esc(company?.name)}" />
             <div class="company-line"><strong>Corporate Office:</strong> S K Tower, A-52, Ayodhya Nagar Road, Old MIDC, Jalgaon - 425003</div>
             <div class="company-line">Tel.: ${display(company?.contactPhone ?? "0257-2270651, 2270010")} &nbsp;&bull;&nbsp; Web: www.sktranslines.com</div>`
      : `<div class="blank-letterhead"></div>`
    }
    </header>

    <div class="title-row">
      <div class="doc-title"><span>GOODS RECEIPT NOTE</span><div class="small">Railhead / Branch Unloading</div></div>
      <div class="doc-meta">
        <div><strong>GRN No.:</strong> <span class="mono">${esc(grn.grnNumber)}</span></div>
        <div><strong>Date:</strong> ${esc(fmtDate(grn.createdAt))}</div>
        <div><strong>Status:</strong> ${esc(grn.status)}</div>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <div><strong>CONSIGNOR:</strong> <span class="name">${display(group.consignor?.name)}</span></div>
        <div class="small">${partyAddress(group.consignor)}</div>
        <div><strong>GST:</strong> ${display(group.consignor?.gstNo)}</div>
      </div>
      <div>
        <div><strong>CONSIGNEE:</strong> <span class="name">${display(group.consignee?.name)}</span></div>
        <div class="small">${partyAddress(group.consignee)}</div>
        <div><strong>GST:</strong> ${display(group.consignee?.gstNo)}</div>
      </div>
    </div>

    <div class="line-row split split-3">
      <span><strong>LR No.:</strong> ${display(lr.lrNumber)}</span>
      <span><strong>LR Group:</strong> ${display(group.groupNumber)}</span>
      <span><strong>Transport:</strong> ${display(TRANSPORT_LABELS[group.transportType] ?? group.transportType)}</span>
    </div>
    <div class="line-row split split-3">
      <span><strong>From:</strong> ${display(group.originBranch.name)}</span>
      <span><strong>Railhead:</strong> ${display(group.railheadBranch?.name)}</span>
      <span><strong>To:</strong> ${display(group.destinationBranch.name)}</span>
    </div>
    <div class="line-row split split-4">
      <span><strong>Vehicle:</strong> ${display(vehicleNumber)}</span>
      <span><strong>Driver:</strong> ${display(driverName)}</span>
      <span><strong>Gate No.:</strong> ${display(grn.gateNo)}</span>
      <span><strong>Seal No.:</strong> ${display(group.sealNumber)}</span>
    </div>
    <div class="line-row split split-4">
      <span><strong>In:</strong> ${esc(fmtDateTime(grn.inDateTime))}</span>
      <span><strong>Out:</strong> ${esc(fmtDateTime(grn.outDateTime))}</span>
      <span><strong>Unloading Min.:</strong> ${display(grn.unloadingMinutes)}</span>
      <span><strong>Labour Count:</strong> ${display(grn.labourCount)}</span>
    </div>
    <div class="line-row split split-3">
      <span><strong>Invoice No.:</strong> ${display(lr.invoiceNumber)}</span>
      <span><strong>Invoice Rs.:</strong> ${fmtMoney(lr.invoiceAmount)}</span>
      <span><strong>Declared Weight:</strong> ${fmtWeight(lr.totalWeight, lr.unit)}</span>
    </div>
    <div class="line-row split split-3">
      <span><strong>E-Way Bill:</strong> ${display(lr.ewayBill?.ewayBillNo)}</span>
      <span><strong>Valid Till:</strong> ${lr.ewayBill ? esc(fmtDate(lr.ewayBill.expiresAt)) : "-"}</span>
      <span><strong>Damages By:</strong> ${display(grn.damagesBy)}</span>
    </div>

    <section class="block">
      <h2>Goods Received</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Goods</th><th class="number">Total</th><th class="number">Received</th><th class="number">Damage</th><th class="number">Shortage</th><th>Unit</th><th>Remarks</th></tr>
        </thead>
        <tbody>${goodsRows}</tbody>
        <tfoot>
          <tr>
            <th colspan="2">Total</th>
            <th class="number">${grn.totalQty.toLocaleString("en-IN")}</th>
            <th class="number">${grn.receivedQty.toLocaleString("en-IN")}</th>
            <th class="number">${grn.damageQty.toLocaleString("en-IN")}</th>
            <th class="number">${grn.shortageQty.toLocaleString("en-IN")}</th>
            <th colspan="2"></th>
          </tr>
        </tfoot>
      </table>
    </section>

    <section class="block" style="display:grid;grid-template-columns:1fr 66mm;gap:8px;align-items:start;">
      <div>
        <h2>Document Verification</h2>
        <table>
          <thead><tr><th>Document</th><th class="center">Status</th><th>Remark</th></tr></thead>
          <tbody>${checkRows}</tbody>
        </table>
        <p class="small" style="margin-top:4px;"><strong>Remarks:</strong> ${display(grn.remarks)}</p>
      </div>
      <div>
        <h2>Freight &amp; Charges</h2>
        <table class="charges">
          <tbody>
            <tr><td>Total Freight</td><td>${fmtMoney(grn.totalFreight)}</td></tr>
            <tr><td>Detention (${grn.detentionDays}d)</td><td>${fmtMoney(grn.detentionAmount)}</td></tr>
            <tr class="total"><td>Gross Total</td><td>${fmtMoney(grn.grossTotal)}</td></tr>
            <tr><td>Advance</td><td>${fmtMoney(grn.advanceAmount)}</td></tr>
            <tr><td>Damage</td><td>${fmtMoney(grn.damageAmount)}</td></tr>
            <tr><td>TDS</td><td>${fmtMoney(grn.tdsAmount)}</td></tr>
            <tr><td>Hamali</td><td>${fmtMoney(grn.hamaliAmount)}</td></tr>
            <tr><td>Printing / Stationery</td><td>${fmtMoney(grn.printingStationaryAmount)}</td></tr>
            <tr class="total"><td>Net Payable</td><td>${fmtMoney(grn.netAmount)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="line-row split split-3" style="margin-top:4px;">
      <span><strong>Labour Leader:</strong> ${display(grn.labour?.name ?? grn.labourName)}</span>
      <span><strong>Unloading Supervisor:</strong> ${display(grn.unloadingSupervisor?.name)}</span>
      <span><strong>Labour Charge:</strong> ${fmtMoney(grn.labourCharge)}</span>
    </div>

    ${grn.cancelReason
      ? `<div class="line-row" style="margin-top:4px;color:#a00;"><strong>Cancel Reason:</strong> ${esc(grn.cancelReason)}</div>`
      : ""
    }

    <div class="foot">
      <div class="sign">Unloading Supervisor</div>
      <div class="sign">Godown In-charge</div>
      <div class="sign">For SK Translines</div>
    </div>
    <div class="gen">Printed: ${esc(fmtDateTime(new Date()))} &nbsp;&bull;&nbsp; By: ${personName(grn.createdBy)} &nbsp;&bull;&nbsp; GRN ${esc(grn.grnNumber)} (${esc(grn.status)})${withLetterhead
      ? " &nbsp;&bull;&nbsp; System generated, no signature required"
      : ""
    }</div>
  </div>
</body>
</html>`;
};
