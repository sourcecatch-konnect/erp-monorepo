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
  id: true,
  name: true,
  branchCode: true,
  address: true,
  contactPhone: true,
  gstNo: true,
} satisfies Prisma.BranchSelect;

export const railBranchGrnPdfInclude = {
  railRake: {
    include: {
      fromBranch: { select: branchSelect },
      toBranch: {
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
      vpSchedule: {
        select: {
          scheduleNumber: true,
          scheduleName: true,
          scheduleDate: true,
          sourceArea: { select: { name: true } },
          destinationArea: { select: { name: true } },
        },
      },
    },
  },
  vpWagonLoading: {
    include: { mrRrRow: { include: { wagon: true } } },
  },
  labourLeader: { select: { name: true, mobileNo: true } },
  unloadingSupervisor: { select: { name: true, mobileNo: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  submittedBy: { select: { firstName: true, lastName: true } },
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      vpLoadingGoods: {
        select: {
          vpLoading: {
            select: {
              loadingNumber: true,
              grn: { select: { grnNumber: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RailBranchGRNInclude;

export type RailBranchGrnPdfData = Prisma.RailBranchGRNGetPayload<{
  include: typeof railBranchGrnPdfInclude;
}>;

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

const personName = (
  person:
    | { firstName?: string | null; lastName?: string | null }
    | null
    | undefined,
) => display([person?.firstName, person?.lastName].filter(Boolean).join(" "));

export const buildRailBranchGrnPdfHtml = (
  grn: RailBranchGrnPdfData,
  options?: { withLetterhead?: boolean },
): string => {
  const withLetterhead = options?.withLetterhead ?? true;
  const rake = grn.railRake;
  const company = rake.toBranch.company;
  const row = grn.vpWagonLoading.mrRrRow;
  const vpLabel = row.vpNo || row.rowLabel;
  const docNo = `${rake.rakeNumber} / ${vpLabel}`;

  const itemRows = grn.items.length
    ? grn.items
        .map((item, index) => {
          const pending = Math.max(
            item.loadedQty - item.receivedQty - item.damageQty,
            0,
          );
          return `
        <tr>
          <td class="number">${index + 1}</td>
          <td>${esc(item.lrNumberSnapshot)}</td>
          <td>${esc(item.goodsNameSnapshot)}${
            item.consigneeNameSnapshot
              ? `<br /><span class="small">to ${esc(item.consigneeNameSnapshot)}</span>`
              : ""
          }</td>
          <td>${display(item.vpLoadingGoods.vpLoading.grn?.grnNumber)}</td>
          <td class="number">${item.loadedQty.toLocaleString("en-IN")}</td>
          <td class="number">${item.receivedQty.toLocaleString("en-IN")}</td>
          <td class="number">${item.damageQty.toLocaleString("en-IN")}</td>
          <td class="number">${item.shortageQty.toLocaleString("en-IN")}</td>
          <td class="number">${pending.toLocaleString("en-IN")}</td>
          <td>${display(item.remarks)}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="10" class="empty">No goods lines</td></tr>`;

  const statusWatermark =
    grn.status === "DRAFT" ? `<div class="status-watermark">DRAFT</div>` : "";

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
  .stationery-watermark { position: absolute; z-index: 0; top: 110mm; left: 50%; width: 115mm; height: 115mm; object-fit: contain; transform: translateX(-50%); opacity: 0.07; }
  .status-watermark { position: absolute; top: 120mm; left: 8mm; right: 8mm; z-index: 2; text-align: center; transform: rotate(-22deg); color: rgba(0,0,0,.06); font-size: 88px; font-weight: 800; letter-spacing: 14px; }
  .page > * { position: relative; z-index: 1; }
  .letterhead { text-align: center; border-bottom: 1.5px solid #111; padding-bottom: 2mm; }
  .letterhead-top { display: flex; justify-content: space-between; font-size: 7px; padding: 0 1mm 1mm; }
  .brand-logo { width: 100%; height: 17mm; object-fit: fill; }
  .company-line { margin-top: 1px; font-size: 7.5px; }
  .blank-letterhead { height: 28mm; }
  .title-row { display: grid; grid-template-columns: 1fr 62mm; align-items: stretch; border: 1px solid #111; border-top: 0; }
  .doc-title { align-self: center; text-align: center; font-size: 13px; font-weight: 800; letter-spacing: .6px; }
  .doc-title span { display: inline-block; padding: 2px 16px; background: #f4d43f; }
  .doc-meta { border-left: 1px solid #111; font-size: 9px; font-weight: 700; }
  .doc-meta > div { padding: 3px 6px; }
  .doc-meta > div + div { border-top: 1px solid #111; }
  .mono { font-family: "Courier New", monospace; }
  .line-row { border: 1px solid #111; border-top: 0; padding: 3px 6px; }
  .split { display: grid; gap: 8px; }
  .split-3 { grid-template-columns: 1fr 1fr 1fr; }
  .split-4 { grid-template-columns: repeat(4, 1fr); }
  .small { font-size: 7.5px; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 3px 5px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; font-size: 7.5px; }
  .number { text-align: right; white-space: nowrap; }
  .empty { text-align: center; color: #777; }
  section.block { margin-top: 4px; }
  h2 { margin: 0 0 3px; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #111; padding-bottom: 1px; }
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
      ${
        withLetterhead
          ? `<div class="letterhead-top"><span>Subject to Jalgaon Jurisdiction</span><span>CIN: U63000MH2004PTC148258</span></div>
             <img class="brand-logo" src="${logoSrc}" alt="${esc(company?.name)}" />
             <div class="company-line"><strong>Corporate Office:</strong> S K Tower, A-52, Ayodhya Nagar Road, Old MIDC, Jalgaon - 425003</div>
             <div class="company-line">Tel.: ${display(company?.contactPhone ?? "0257-2270651, 2270010")} &nbsp;&bull;&nbsp; Web: www.sktranslines.com</div>`
          : `<div class="blank-letterhead"></div>`
      }
    </header>

    <div class="title-row">
      <div class="doc-title"><span>BRANCH GRN</span><div class="small">Rakehead Wagon Unloading at Destination Branch</div></div>
      <div class="doc-meta">
        <div><strong>Ref.:</strong> <span class="mono">${esc(docNo)}</span></div>
        <div><strong>Date:</strong> ${esc(fmtDate(grn.createdAt))}</div>
        <div><strong>Status:</strong> ${esc(grn.status)}</div>
      </div>
    </div>

    <div class="line-row split split-3">
      <span><strong>Rake No.:</strong> ${display(rake.rakeNumber)}</span>
      <span><strong>Railway Rake:</strong> ${display(rake.railwayRakeNumber)}</span>
      <span><strong>Schedule:</strong> ${display(rake.vpSchedule.scheduleNumber)}</span>
    </div>
    <div class="line-row split split-3">
      <span><strong>From Branch:</strong> ${display(rake.fromBranch.name)}</span>
      <span><strong>To Branch:</strong> ${display(rake.toBranch.name)}</span>
      <span><strong>Route:</strong> ${display(rake.vpSchedule.sourceArea?.name)} &rarr; ${display(rake.vpSchedule.destinationArea?.name)}</span>
    </div>
    <div class="line-row split split-4">
      <span><strong>VP No.:</strong> ${display(row.vpNo)}</span>
      <span><strong>Wagon:</strong> ${display(row.wagon?.name)}</span>
      <span><strong>MR/RR No.:</strong> ${display(row.mrRrNo)}</span>
      <span><strong>Seal No.:</strong> ${display(row.sealNo)}</span>
    </div>
    <div class="line-row split split-4">
      <span><strong>In:</strong> ${esc(fmtDateTime(grn.inDateTime))}</span>
      <span><strong>Out:</strong> ${esc(fmtDateTime(grn.outDateTime))}</span>
      <span><strong>Unloading Min.:</strong> ${display(grn.unloadingMinutes)}</span>
      <span><strong>Damages By:</strong> ${display(grn.damagesBy)}</span>
    </div>
    <div class="line-row split split-4">
      <span><strong>Labour Count:</strong> ${display(grn.labourCount)}</span>
      <span><strong>Labour Leader:</strong> ${display(grn.labourLeader?.name)}</span>
      <span><strong>Supervisor:</strong> ${display(grn.unloadingSupervisor?.name)}</span>
      <span><strong>Labour Charge:</strong> ${fmtMoney(grn.labourCharge)}</span>
    </div>

    <section class="block">
      <h2>Goods Received from Wagon</h2>
      <table>
        <thead>
          <tr><th>#</th><th>LR No.</th><th>Goods</th><th>Source GRN</th><th class="number">Loaded</th><th class="number">Received</th><th class="number">Damage</th><th class="number">Shortage</th><th class="number">Pending</th><th>Remarks</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <th colspan="4">Total</th>
            <th class="number">${grn.totalLoadedQty.toLocaleString("en-IN")}</th>
            <th class="number">${grn.totalReceivedQty.toLocaleString("en-IN")}</th>
            <th class="number">${grn.totalDamageQty.toLocaleString("en-IN")}</th>
            <th class="number">${grn.totalShortageQty.toLocaleString("en-IN")}</th>
            <th colspan="2"></th>
          </tr>
        </tfoot>
      </table>
    </section>

    <div class="line-row" style="margin-top:4px;"><strong>Remarks:</strong> ${display(grn.remarks)}</div>

    <div class="foot">
      <div class="sign">Unloading Supervisor</div>
      <div class="sign">Branch In-charge</div>
      <div class="sign">For SK Translines</div>
    </div>
    <div class="gen">Printed: ${esc(fmtDateTime(new Date()))} &nbsp;&bull;&nbsp; By: ${personName(
      grn.submittedBy ?? grn.createdBy,
    )} &nbsp;&bull;&nbsp; ${esc(docNo)} (${esc(grn.status)})${
      grn.submittedAt ? ` &nbsp;&bull;&nbsp; Submitted ${esc(fmtDateTime(grn.submittedAt))}` : ""
    }${withLetterhead ? " &nbsp;&bull;&nbsp; System generated, no signature required" : ""}</div>
  </div>
</body>
</html>`;
};
