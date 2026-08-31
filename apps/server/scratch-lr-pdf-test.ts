import { buildLrPdfHtml } from "./src/modules/lorry-receipt/lorry-receipt.pdf.js";

const fakeLr: any = {
  id: "x", lrNumber: "SKT/TEST/00001", status: "FINALISED", createdAt: new Date(),
  totalWeight: 100, unit: "KG", invoiceNumber: null, invoiceAmount: null,
  cancelReason: null,
  group: {
    isMarketVehicle: true, marketVehicleNumber: "MH12AB1234", marketDriverName: "Test Driver",
    transportType: "Road", tripLegType: "DIRECT", hub: null, order: null, groupNumber: "SKG/TEST/00001",
    sealNumber: null, baseFreightAmount: null, cancelReason: null,
    consignor: { name: "Consignor Co", address: "Addr", gstNo: "GST1", mobileNo: "123", contactPhone: null, city: { name: "Pune" }, state: { name: "MH" } },
    consignee: { name: "Consignee Co", address: "Addr2", gstNo: "GST2", mobileNo: "456", contactPhone: null, city: { name: "Guwahati" }, state: { name: "AS" } },
    originBranch: { name: "Origin Branch", branchCode: "PB001", address: "A", contactPhone: "1", gstNo: "GSTBRANCH" },
    destinationBranch: { name: "Dest Branch", branchCode: "DB001", address: "B", contactPhone: "2" },
    primaryTrip: null, secondaryTrip: null,
  },
  loadingLocation: null, unloadingLocation: null,
  goods: [], ewayBill: null, delivery: null, acknowledgement: null,
  createdBy: { firstName: "Test", lastName: "User" },
};

const withLh = buildLrPdfHtml(fakeLr, { withLetterhead: true });
const withoutLh = buildLrPdfHtml(fakeLr, { withLetterhead: false });

console.log("WITH letterhead contains <img brand-logo>:", withLh.includes('class="brand-logo"'));
console.log("WITH letterhead contains letterhead-space div:", withLh.includes('<div class="letterhead-space">'));
console.log("WITHOUT letterhead contains <img brand-logo>:", withoutLh.includes('class="brand-logo"'));
console.log("WITHOUT letterhead contains letterhead-space div:", withoutLh.includes('<div class="letterhead-space">'));
console.log("WITHOUT letterhead still contains LR number:", withoutLh.includes('SKT/TEST/00001'));
console.log("WITHOUT letterhead contains Corporate Off address:", withoutLh.includes('Corporate Off'));
