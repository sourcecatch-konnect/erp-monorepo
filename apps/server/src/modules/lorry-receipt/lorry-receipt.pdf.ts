import path from "node:path";
import { Prisma } from "../../../generated/prisma/index.js";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import { paiseToRupees } from "../../lib/money.js";

const logoSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.svg"),
);

/* ------------------------------------------------------------------ */
/* Data shape                                                          */
/* ------------------------------------------------------------------ */

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
        },
      },
      destinationBranch: {
        select: { name: true, branchCode: true, address: true, contactPhone: true },
      },
      hub: { select: { name: true } },
      order: { select: { orderNumber: true } },
      primaryTrip: { select: tripSelect },
      secondaryTrip: { select: tripSelect },
    },
  },
  loadingLocation: { select: locationSelect },
  unloadingLocation: { select: locationSelect },
  goods: true,
  ewayBill: true,
  delivery: true,
  acknowledgement: true,
  createdBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.LorryReceiptInclude;

export type LrPdfData = Prisma.LorryReceiptGetPayload<{
  include: typeof lrPdfInclude;
}>;

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

const text = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  return esc(value);
};

const fmtDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
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
  return `₹ ${paiseToRupees(paise).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtWeight = (
  weight: Prisma.Decimal | number | null | undefined,
  unit?: string | null,
) => {
  if (weight === null || weight === undefined) return "—";
  const n = Number(weight);
  if (Number.isNaN(n)) return "—";
  const value = n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${value} ${esc(unit)}` : value;
};

const TRANSPORT_LABELS: Record<string, string> = {
  Road: "By Road",
  Rail: "By Rail",
  RoadAndRail: "Road & Rail",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "DRAFT — NOT FINALISED",
  FINALISED: "FINALISED",
  DELIVERED: "DELIVERED",
  ACKNOWLEDGED: "DELIVERED — POD RECEIVED",
  CANCELLED: "CANCELLED",
};

/* ------------------------------------------------------------------ */
/* Fragment builders                                                   */
/* ------------------------------------------------------------------ */

const cell = (label: string, value: string, extraStyle = "") => `
  <div class="cell" style="${extraStyle}">
    <div class="cell-label">${esc(label)}</div>
    <div class="cell-value">${value}</div>
  </div>`;

const partyBox = (
  role: string,
  party: LrPdfData["group"]["consignor"] | null | undefined,
  point: LrPdfData["loadingLocation"],
  pointLabel: string,
) => {
  const cityState = [party?.city?.name, party?.state?.name]
    .filter(Boolean)
    .join(", ");
  const phone = party?.mobileNo || party?.contactPhone;
  return `
  <div class="party">
    <div class="party-role">${esc(role)}</div>
    <div class="party-body">
      <div class="party-name">${text(party?.name)}</div>
      ${
        party?.address || cityState
          ? `<div class="party-line">${[party?.address, cityState].filter(Boolean).map(esc).join(", ")}</div>`
          : ""
      }
      <div class="party-line"><span class="inline-label">GSTIN:</span> ${text(party?.gstNo)}${phone ? ` &nbsp;&nbsp;<span class="inline-label">Phone:</span> ${esc(phone)}` : ""}</div>
      <div class="party-line"><span class="inline-label">${esc(pointLabel)}:</span> ${
        point
          ? [point.name, point.address, point.city?.name]
              .filter(Boolean)
              .map(esc)
              .join(", ")
          : "—"
      }</div>
    </div>
  </div>`;
};

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

export const buildLrPdfHtml = (lr: LrPdfData): string => {
  const g = lr.group;
  const isMarket = g.isMarketVehicle;

  const vehicleNumber = isMarket
    ? g.marketVehicleNumber
    : g.primaryTrip?.vehicle?.vehicleNumber;
  const driver = isMarket ? null : g.primaryTrip?.driver;
  const driverName = isMarket ? g.marketDriverName : driver?.name;

  const goodsRows = lr.goods.map(
    (item, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c">${item.quantity.toLocaleString("en-IN")}</td>
        <td class="c">${text(item.unit)}</td>
        <td>${esc(item.name)}${item.description ? ` <span class="soft">— ${esc(item.description)}</span>` : ""}</td>
        <td class="r">${fmtWeight(item.weight)}</td>
      </tr>`,
  );
  // Pad so the printed form always leaves handwriting room.
  const minRows = 5;
  for (let i = goodsRows.length; i < minRows; i++) {
    goodsRows.push(
      `<tr class="filler"><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td></tr>`,
    );
  }
  const totalQty = lr.goods.reduce((sum, item) => sum + item.quantity, 0);

  const routeVia = g.hub?.name && g.tripLegType !== "DIRECT" ? g.hub.name : null;

  const watermark =
    lr.status === "CANCELLED"
      ? `<div class="watermark">CANCELLED</div>`
      : lr.status === "DRAFT"
        ? `<div class="watermark" style="color:rgba(0,0,0,0.055);">DRAFT</div>`
        : "";

  const delivery = lr.delivery;
  const ack = lr.acknowledgement;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    line-height: 1.35;
    color: #000;
    background: #fff;
  }
  b { font-weight: 700; }
  .soft { color: #444; }
  .inline-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #555; letter-spacing: 0.3px; }

  .watermark {
    position: fixed;
    top: 40%;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 88px;
    font-weight: 800;
    letter-spacing: 14px;
    transform: rotate(-22deg);
    color: rgba(150, 0, 0, 0.07);
    z-index: 0;
  }

  /* The whole document sits inside one ruled frame — classic LR form. */
  .frame {
    position: relative;
    z-index: 1;
    border: 1.6px solid #000;
  }
  .rule-b { border-bottom: 1px solid #000; }

  /* ── Masthead ───────────────────────────────────────────────────── */
  .masthead { display: flex; align-items: stretch; }
  .masthead-brand { flex: 1; padding: 8px 10px 6px; }
  .brand-logo { height: 38px; max-width: 220px; object-fit: contain; object-position: left center; display: block; }
  .brand-sub { margin-top: 4px; font-size: 7.5px; color: #333; line-height: 1.45; }
  .masthead-doc {
    width: 200px;
    border-left: 1px solid #000;
    display: flex;
    flex-direction: column;
  }
  .doc-title {
    padding: 5px 8px 4px;
    text-align: center;
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 2px;
    border-bottom: 1px solid #000;
  }
  .doc-title small { display: block; font-size: 7px; font-weight: 700; letter-spacing: 2.2px; color: #444; margin-top: 1px; }
  .doc-no-row { display: flex; flex: 1; }
  .doc-no-row > div { flex: 1; padding: 4px 8px; }
  .doc-no-row > div + div { border-left: 1px solid #000; }
  .doc-no { font-family: "Courier New", monospace; font-size: 10.5px; font-weight: 700; margin-top: 1px; white-space: nowrap; }

  .caution-band {
    display: flex;
    justify-content: space-between;
    padding: 2.5px 10px;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    background: #efefef;
  }

  /* ── Generic ruled cell strips ──────────────────────────────────── */
  .strip { display: flex; }
  .cell { flex: 1; padding: 4px 8px; min-width: 0; }
  .cell + .cell { border-left: 1px solid #000; }
  .cell-label { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  .cell-value { font-size: 9.5px; font-weight: 700; margin-top: 1px; word-break: break-word; }
  .mono { font-family: "Courier New", monospace; font-size: 8.5px; white-space: nowrap; letter-spacing: -0.2px; }

  /* ── Section heading band ───────────────────────────────────────── */
  .band {
    padding: 2.5px 10px;
    background: #efefef;
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  /* ── Parties ────────────────────────────────────────────────────── */
  .parties { display: flex; }
  .party { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .party + .party { border-left: 1px solid #000; }
  .party-role {
    padding: 2.5px 8px;
    background: #efefef;
    border-bottom: 1px solid #000;
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .party-body { padding: 5px 8px 6px; }
  .party-name { font-size: 11px; font-weight: 800; }
  .party-line { margin-top: 2px; }

  /* ── Tables ─────────────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; }
  th {
    padding: 3px 7px;
    background: #efefef;
    border-bottom: 1px solid #000;
    border-left: 1px solid #000;
    font-size: 7px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: left;
  }
  td {
    padding: 3.5px 7px;
    border-bottom: 1px solid #999;
    border-left: 1px solid #000;
    vertical-align: top;
    font-size: 9px;
  }
  th:first-child, td:first-child { border-left: none; }
  tbody tr:last-child td { border-bottom: none; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  tr.filler td { height: 13px; border-bottom: 1px dotted #bbb; }
  tfoot td { border-top: 1.2px solid #000; border-bottom: none; font-weight: 800; background: #f7f7f7; }

  /* ── Freight / payment block ────────────────────────────────────── */
  .commercial { display: flex; }
  .commercial-left { flex: 1.35; border-right: 1px solid #000; }
  .commercial-right { flex: 1; display: flex; flex-direction: column; }
  .charge-row { display: flex; justify-content: space-between; padding: 3px 8px; border-bottom: 1px solid #ccc; }
  .charge-row:last-child { border-bottom: none; }
  .charge-row .write { flex: 0 0 90px; border-bottom: 1px dotted #888; text-align: right; font-weight: 700; }
  .charge-row.total { border-top: 1.2px solid #000; font-weight: 800; background: #f7f7f7; }
  .paymode { display: flex; gap: 14px; padding: 4px 8px; border-bottom: 1px solid #000; }
  .paymode-opt { display: flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 700; }
  .tick { width: 9px; height: 9px; border: 1.2px solid #000; display: inline-block; }
  .gst-note { padding: 4px 8px; font-size: 7.5px; color: #333; line-height: 1.45; }

  /* ── POD block ──────────────────────────────────────────────────── */
  .pod-body { display: flex; }
  .pod-lines { flex: 1; padding: 6px 10px 7px; }
  .pod-declaration { font-size: 8px; color: #222; font-style: italic; }
  .write-line { display: flex; gap: 6px; margin-top: 9px; align-items: flex-end; }
  .write-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; white-space: nowrap; }
  .write-slot { flex: 1; border-bottom: 1px dotted #777; min-height: 11px; font-size: 9px; font-weight: 700; padding: 0 3px; }
  .stamp-box {
    width: 125px;
    border-left: 1px solid #000;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding: 5px;
    text-align: center;
  }
  .stamp-hint { font-size: 6.5px; text-transform: uppercase; letter-spacing: 0.7px; color: #666; }

  /* ── Signature strip ────────────────────────────────────────────── */
  .signs { display: flex; }
  .sign { flex: 1; min-height: 52px; padding: 5px 8px; display: flex; flex-direction: column; justify-content: space-between; }
  .sign + .sign { border-left: 1px solid #000; }
  .sign-info { font-size: 7.5px; color: #333; }
  .sign-role { font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; text-align: center; border-top: 1px solid #999; padding-top: 2px; }

  /* ── Terms + footer ─────────────────────────────────────────────── */
  .terms { padding: 4px 10px 5px; }
  .terms-title { font-size: 6.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #444; }
  .terms ol { padding-left: 11px; columns: 2; column-gap: 18px; font-size: 6.5px; color: #444; line-height: 1.45; margin-top: 1px; }
  .footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 3px 10px;
    border-top: 1px solid #000;
    font-size: 6.8px;
    color: #333;
    background: #efefef;
  }
</style>
</head>
<body>
${watermark}
<div class="frame">

  <!-- Masthead -->
  <div class="masthead rule-b">
    <div class="masthead-brand">
      <img class="brand-logo" src="${logoSrc}" alt="S K Trans Lines Pvt. Ltd." />
      <div class="brand-sub">
        Corporate Off.: S K TOWER, A-52, Ground Floor, Ayodhya Nagar Road, OLD MIDC, Jalgaon - 425003<br />
        CIN: U63000MH2004PTC148258 &nbsp;•&nbsp; E-mail: customercare@sktranslines.com &nbsp;•&nbsp; www.sktranslines.com
        ${g.originBranch?.gstNo ? `<br />GSTIN (${esc(g.originBranch.branchCode ?? "")}): ${esc(g.originBranch.gstNo)}` : ""}
      </div>
    </div>
    <div class="masthead-doc">
      <div class="doc-title">LORRY RECEIPT<small>CONSIGNMENT NOTE</small></div>
      <div class="doc-no-row">
        <div>
          <div class="cell-label">LR Number</div>
          <div class="doc-no">${esc(lr.lrNumber)}</div>
        </div>
      </div>
      <div class="doc-no-row" style="border-top:1px solid #000;">
        <div>
          <div class="cell-label">LR Date</div>
          <div class="cell-value">${esc(fmtDate(lr.createdAt))}</div>
        </div>
        <div>
          <div class="cell-label">Status</div>
          <div class="cell-value">${esc(STATUS_LABELS[lr.status] ?? lr.status)}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="caution-band rule-b">
    <span>At Owner's Risk</span>
    <span>Insurance not arranged by the carrier</span>
    <span>Subject to Jalgaon Jurisdiction</span>
  </div>

  ${
    lr.status === "CANCELLED"
      ? `<div class="band rule-b" style="background:#000;color:#fff;">Cancelled — ${esc(g.cancelReason ?? lr.cancelReason ?? "reason not recorded")}</div>`
      : ""
  }

  <!-- Booking references -->
  <div class="strip rule-b">
    ${cell("Booking Branch", text(g.originBranch?.name))}
    ${cell("Delivery Branch", text(g.destinationBranch?.name))}
    ${routeVia ? cell("Via (Hub)", esc(routeVia)) : ""}
    ${cell("Mode", text(TRANSPORT_LABELS[g.transportType] ?? g.transportType))}
    ${cell("Order No", `<span class="mono">${text(g.order?.orderNumber)}</span>`)}
    ${cell("Truckload No", `<span class="mono">${text(g.groupNumber)}</span>`)}
  </div>

  <!-- Parties -->
  <div class="parties rule-b">
    ${partyBox("Consignor (From)", g.consignor, lr.loadingLocation, "Pickup point")}
    ${partyBox("Consignee (To)", g.consignee, lr.unloadingLocation, "Delivery point")}
  </div>

  <!-- Vehicle -->
  <div class="strip rule-b">
    ${cell("Vehicle No", `<span class="mono" style="font-size:10.5px;">${text(vehicleNumber)}</span>`)}
    ${cell("Driver", text(driverName))}
    ${cell("Driver Mobile", text(driver?.mobile))}
    ${cell("Licence No", text(driver?.licenseNo))}
    ${cell("Seal No", text(g.sealNumber))}
    ${cell("Trip No", text(isMarket ? "Market vehicle" : g.primaryTrip?.tripNumber))}
  </div>

  <!-- Goods -->
  <div class="band rule-b">Particulars of Goods (said to contain)</div>
  <table class="rule-b">
    <thead>
      <tr>
        <th class="c" style="width:24px;">Sr</th>
        <th class="c" style="width:58px;">Packages</th>
        <th class="c" style="width:52px;">Unit</th>
        <th>Description of Goods</th>
        <th class="r" style="width:78px;">Weight</th>
      </tr>
    </thead>
    <tbody>${goodsRows.join("")}</tbody>
    <tfoot>
      <tr>
        <td></td>
        <td class="c">${totalQty ? totalQty.toLocaleString("en-IN") : "—"}</td>
        <td></td>
        <td>Total</td>
        <td class="r">${fmtWeight(lr.totalWeight, lr.unit)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Invoice / e-way references + freight -->
  <div class="commercial rule-b">
    <div class="commercial-left">
      <div class="band" style="border-bottom:1px solid #000;">Invoice &amp; E-Way Bill</div>
      <div class="strip" style="border-bottom:1px solid #000;">
        ${cell("Invoice No", `<span class="mono">${text(lr.invoiceNumber)}</span>`)}
        ${cell("Invoice Value", text(lr.invoiceAmount != null ? fmtMoney(lr.invoiceAmount) : null))}
      </div>
      <div class="strip">
        ${cell("E-Way Bill No", `<span class="mono">${text(lr.ewayBill?.ewayBillNo)}</span>`)}
        ${cell("Valid Till", text(lr.ewayBill ? fmtDate(lr.ewayBill.expiresAt) : null))}
      </div>
      <div class="gst-note" style="border-top:1px solid #000;">
        GST on freight payable under <b>Reverse Charge Mechanism (RCM)</b> by the
        consignor / consignee as applicable — SAC 9965 (Goods Transport Agency).
        The carrier does not collect GST on this consignment unless agreed otherwise.
      </div>
    </div>
    <div class="commercial-right">
      <div class="band" style="border-bottom:1px solid #000;">Freight Particulars</div>
      <div class="paymode">
        <span class="paymode-opt"><span class="tick"></span> Paid</span>
        <span class="paymode-opt"><span class="tick"></span> To Pay</span>
        <span class="paymode-opt"><span class="tick"></span> To Be Billed</span>
      </div>
      <div class="charge-row"><span>Base Freight</span><span class="write">${g.baseFreightAmount != null ? esc(fmtMoney(g.baseFreightAmount)) : ""}</span></div>
      <div class="charge-row"><span>Hamali / Loading</span><span class="write"></span></div>
      <div class="charge-row"><span>Detention</span><span class="write"></span></div>
      <div class="charge-row"><span>Other Charges</span><span class="write"></span></div>
      <div class="charge-row total"><span>Total</span><span class="write">${g.baseFreightAmount != null ? esc(fmtMoney(g.baseFreightAmount)) : ""}</span></div>
    </div>
  </div>

  ${
    delivery
      ? `<div class="band rule-b">Delivery Record</div>
        <div class="strip rule-b">
          ${cell("Delivered On", esc(fmtDateTime(delivery.deliveredAt)))}
          ${cell("Vehicle Reported", esc(fmtDateTime(delivery.reportedAt)))}
          ${cell("Received By", `${text(delivery.receiverName)}${delivery.receiverPhone ? ` (${esc(delivery.receiverPhone)})` : ""}`)}
          ${cell("POD Received", text(ack ? fmtDate(ack.receivedAt) : null))}
          ${cell("Remark", text(delivery.remark))}
        </div>`
      : ""
  }

  <!-- Consignee acknowledgement -->
  <div class="band rule-b">Consignee Acknowledgement — Proof of Delivery</div>
  <div class="pod-body rule-b">
    <div class="pod-lines">
      <div class="pod-declaration">
        Received the above-described consignment in good order and condition, complete
        as per this Lorry Receipt.
      </div>
      <div class="write-line">
        <span class="write-label">Received by (name)</span>
        <span class="write-slot">${delivery?.receiverName ? esc(delivery.receiverName) : ""}</span>
        <span class="write-label">Mobile</span>
        <span class="write-slot" style="max-width:110px;">${delivery?.receiverPhone ? esc(delivery.receiverPhone) : ""}</span>
      </div>
      <div class="write-line">
        <span class="write-label">Date</span>
        <span class="write-slot" style="max-width:100px;">${delivery ? esc(fmtDate(delivery.deliveredAt)) : ""}</span>
        <span class="write-label">Time</span>
        <span class="write-slot" style="max-width:80px;"></span>
        <span class="write-label">Condition of goods</span>
        <span class="write-slot"></span>
      </div>
      <div class="write-line">
        <span class="write-label">Shortage / damage remarks</span>
        <span class="write-slot"></span>
      </div>
    </div>
    <div class="stamp-box">
      <div style="flex:1;"></div>
      <div class="stamp-hint">Consignee Seal &amp; Stamp</div>
    </div>
    <div class="stamp-box">
      <div style="flex:1;"></div>
      <div class="stamp-hint">Consignee Signature</div>
    </div>
  </div>

  <!-- Signatures -->
  <div class="signs rule-b">
    <div class="sign">
      <div class="sign-info">Prepared by: <b>${text([lr.createdBy?.firstName, lr.createdBy?.lastName].filter(Boolean).join(" "))}</b><br />Branch: ${text(g.originBranch?.name)}</div>
      <div class="sign-role">Booking Clerk</div>
    </div>
    <div class="sign">
      <div class="sign-info">Name: ${text(driverName)}</div>
      <div class="sign-role">Driver's Signature</div>
    </div>
    <div class="sign">
      <div class="sign-info">For <b>S K Trans Lines Pvt. Ltd.</b></div>
      <div class="sign-role">Authorised Signatory</div>
    </div>
  </div>

  <!-- Terms -->
  <div class="terms">
    <div class="terms-title">Terms &amp; Conditions of Carriage</div>
    <ol>
      <li>Goods are transported entirely at the owner's risk. The carrier is not responsible for leakage, breakage, evaporation or damage arising from causes beyond its control.</li>
      <li>Delivery is made only against this consignment note or written authorisation from the consignee named herein.</li>
      <li>The consignor is responsible for the correctness of the description of goods, invoice and e-way bill particulars declared on this receipt.</li>
      <li>Detention will be charged if the vehicle is held beyond the free period at loading or unloading points.</li>
      <li>Claims for shortage or damage must be noted on this receipt at the time of delivery; claims raised afterwards will not be entertained.</li>
      <li>All disputes are subject to Jalgaon jurisdiction only.</li>
    </ol>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Guwahati: 9435568914 | Kolkata: 8336925540 | Mumbai: 91+2572270651 | Nashik: 9422770142 | Pondicherry: 9626709983 | Pune: 9373770144</span>
    <span style="white-space:nowrap;">System-generated &nbsp;•&nbsp; ${esc(fmtDateTime(new Date()))}</span>
  </div>

</div>
</body>
</html>`;
};
