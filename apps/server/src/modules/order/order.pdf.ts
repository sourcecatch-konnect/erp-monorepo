import { Prisma } from "../../../generated/prisma/index.js";
import type { PdfDocument } from "../../templetes/pdf/pdf.type.js";
import path from "node:path";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import { paiseToRupees } from "../../lib/money.js";

const headerImageSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.svg")
);

export const orderPdfInclude = {
  customer: true,
  fromBranch: true,
  toBranch: true,
  vehicleType: true,
  customerLocation: true,
  city: true,
  createdBy: true,
  approvedBy: true,
  // items: {
  //   include: {
  //     goods: true,
  //   },
  // },
} satisfies Prisma.OrderInclude;

export type OrderPdfData = Prisma.OrderGetPayload<{
  include: typeof orderPdfInclude;
}>;

const formatDate = (date: Date | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN");
};

const formatDateTime = (date: Date | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const pdfValue = (value: unknown): string | number | null | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
};

const pdfMoneyFromPaise = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === "") return undefined;

  const amountInPaise = Number(value);
  if (Number.isNaN(amountInPaise)) return undefined;

  const amount = paiseToRupees(amountInPaise);

  return `${Number(amount).toLocaleString("en-IN")} /-`;
};

const userFullName = (
  user:
    | { firstName: string; middleName?: string | null; lastName: string; userName?: string }
    | null
    | undefined
) => {
  if (!user) return undefined;
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
};
const readText = (row: unknown, key: string) => {
  if (!row || typeof row !== "object") return undefined;
  const value = (row as Record<string, unknown>)[key];
  return pdfValue(value);
};
export const buildOrderPdfDocument = (order: OrderPdfData): PdfDocument => {
  const showApprovalDetails = order.status !== "PendingApproval";
  return {
    layout: "compact-form",

    title: "Order Details",
    documentNo: order.orderNumber,
    date: formatDate(order.createdAt),
    status: order.status,

    // Meta row below the last table
    createdAt: formatDateTime(order.createdAt),
    createdBy: userFullName(order.createdBy) ?? undefined,

    company: {
      headerImageSrc,
      name: "S K TRANS LINES PVT. LTD.",
      address:
        "Corporate Off.: S K TOWER, A-52, Ground Floor, Ayodhya Nagar Road, OLD MIDC, Jalgaon - 425003",
      cin: "U63000MH2004PTC148258",
      email: "customercare@sktranslines.com",
      website: "www.sktranslines.com",
    },

    footerContacts: [
      { city: "Guwahati", phone: "9435568914" },
      { city: "Kolkata", phone: "8336925540" },
      { city: "Mumbai", phone: "91+2572270651" },
      { city: "Nashik", phone: "9422770142" },
      { city: "Pondicherry", phone: "9626709983" },
      { city: "Pune", phone: "9373770144" },
    ],

    sections: [
      // ── Consignor / Consignee ─────────────────────────────────────────
      {
        title: "Consignor & Consignee",
        variant: "consignor-consignee",
        fields: [], // required by type; unused in this variant
        consignor: {
          name: pdfValue(order.customer?.name),
          address:
            readText(order.customer, "address") ??
            readText(order.customer, "billingAddress") ??
            readText(order.customer, "registeredAddress") ??
            pdfValue(order.pickupAddressOverride),
          gstin:
            readText(order.customer, "gstNo") ??
            readText(order.customer, "gstin"),
          extra: [
            { label: "From Branch", value: pdfValue(order.fromBranch?.name) },
          ],
        },
        consignee: {
          name: pdfValue(order.customerLocation?.name ?? order.customer?.name),
          address:
            readText(order.customerLocation, "address") ??
            readText(order.customerLocation, "deliveryAddress") ??
            pdfValue(order.city?.name),
          gstin:
            readText(order.customerLocation, "gstNo") ??
            readText(order.customerLocation, "gstin"),
          extra: [
            { label: "To Branch", value: pdfValue(order.toBranch?.name) },
            { label: "Delivery At", value: pdfValue(order.customerLocation?.name ?? order.city?.name) },
            { label: "By", value: pdfValue(order.orderType) },
          ],
        },
      },

      // ── Approval Details (conditional) ───────────────────────────────
      ...(showApprovalDetails
        ? [
          {
            title: "Approval Details",
            columns: 2 as const,
            fields: [
              { label: "Approved By", value: pdfValue(userFullName(order.approvedBy)) },
              { label: "Approved At", value: formatDate(order.approvedAt) },
              { label: "Rejection Reason", value: pdfValue(order.rejectionReason) },
              { label: "Cancel Reason", value: pdfValue(order.cancelReason) },
            ],
          },
        ]
        : []),

      // ── Order Details ─────────────────────────────────────────────────
      {
        title: "Order Details",
        columns: 2,
        fields: [
          { label: "Order No", value: pdfValue(order.orderNumber) },
          { label: "Order Type", value: pdfValue(order.orderType) },
          { label: "Pickup Date", value: formatDate(order.pickupDate) },
          { label: "Created Date", value: formatDate(order.createdAt) },
          { label: "Truck Quantity", value: pdfValue(order.truckQuantity) },
          { label: "Booking Freight", value: pdfMoneyFromPaise(order.bookingFreightAmount) },
          { label: "Override Reason", value: pdfValue(order.freightOverrideReason) },
        ],
      },

      // ── Vehicle / Freight ─────────────────────────────────────────────
      {
        title: "Vehicle / Freight Details",
        columns: 2,
        fields: [
          { label: "Vehicle Type", value: pdfValue(order.vehicleType?.name) },
          { label: "Truck Quantity", value: pdfValue(order.truckQuantity) },
          { label: "Booking Freight", value: pdfMoneyFromPaise(order.bookingFreightAmount) },
          { label: "Override Reason", value: pdfValue(order.freightOverrideReason) },
        ],
      },
    ],


    summary: [
      {
        label: "Booking Freight Amount",
        value: pdfMoneyFromPaise(order.bookingFreightAmount) || 0,
      },
    ],

    notes: order.specialInstructions ? [`Special Instructions: ${order.specialInstructions}`] : [],
  };
};