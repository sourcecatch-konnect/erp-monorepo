import { Prisma } from "@prisma/client";
import type { PdfDocument } from "../../templetes/pdf/pdf.type.js";
import path from "node:path";
// import { imageToBase64Src } from "../utils/image-to-base64.js";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
const headerImageSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/SKT.jpg")
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
  items: {
    include: {
      goods: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderPdfData = Prisma.OrderGetPayload<{
  include: typeof orderPdfInclude;
}>;

const formatDate = (date: Date | null | undefined) => {
  if (!date) return "-";
  return date.toLocaleDateString("en-IN");
};

const pdfValue = (value: unknown): string | number | null | undefined => {
  if (value === null || value === undefined || value === "") return undefined;

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return String(value);
};
const userFullName = (
  user:
    | {
        firstName: string;
        middleName?: string | null;
        lastName: string;
        userName?: string;
      }
    | null
    | undefined
) => {
  if (!user) return undefined;

  return [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
};
export const buildOrderPdfDocument = (order: OrderPdfData): PdfDocument => {
  return {
    layout: "compact-form",

    title: "Order Details",
    documentNo: order.orderNumber,
    date: new Date(order.createdAt).toLocaleDateString("en-IN"),

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
      {
        title: "Customer Details",
        columns: 2,
        fields: [
          { label: "Customer Name", value: pdfValue(order.customer?.name) },
          { label: "Contact Person", value: pdfValue(order.contactPersonName) },
          { label: "Contact Mobile", value: pdfValue(order.contactMobile) },
          { label: "Contact Email", value: pdfValue(order.contactEmail) },
        ],
      },
      {
        title: "Order Details",
        columns: 3,
        fields: [
          { label: "Order No", value: pdfValue(order.orderNumber) },
          { label: "Order Type", value: pdfValue(order.orderType) },
          { label: "Status", value: pdfValue(order.status) },
          { label: "Financial Year", value: pdfValue(order.fyCode) },
          { label: "Pickup Date", value: formatDate(order.pickupDate) },
          { label: "Created Date", value: formatDate(order.createdAt) },
        ],
      },
      {
        title: "Route Details",
        columns: 2,
        fields: [
          { label: "From Branch", value: pdfValue(order.fromBranch?.name) },
          { label: "To Branch", value: pdfValue(order.toBranch?.name) },
          { label: "City", value: pdfValue(order.city?.name) },
          { label: "Pickup Address", value: pdfValue(order.pickupAddressOverride) },
        ],
      },
      {
        title: "Vehicle / Freight Details",
        columns: 2,
        fields: [
          { label: "Vehicle Type", value: pdfValue(order.vehicleType?.name) },
          { label: "Truck Quantity", value: pdfValue(order.truckQuantity) },
          { label: "Booking Freight Amount", value: pdfValue(order.bookingFreightAmount) },
          { label: "Freight Override Reason", value: pdfValue(order.freightOverrideReason) },
        ],
      },
      {
        title: "Approval Details",
        columns: 2,
        fields: [
          { label: "Created By", value: pdfValue(userFullName(order.createdBy)) },
          { label: "Approved By", value: pdfValue(userFullName(order.approvedBy)) },
          { label: "Approved At", value: formatDate(order.approvedAt) },
          { label: "Rejection Reason", value: pdfValue(order.rejectionReason) },
          { label: "Cancel Reason", value: pdfValue(order.cancelReason) },
        ],
      },
    ],

    tables: [
      {
        title: "Goods Details",
        columns: ["Goods", "Quantity", "Unit", "Weight"],
        rows: order.items.map((item) => [
          pdfValue(item.goods?.name),
          pdfValue(item.quantity),
          pdfValue(item.unit),
          pdfValue(item.weight),
        ]),
      },
    ],

    summary: [
      {
        label: "Booking Freight Amount",
        value: pdfValue(order.bookingFreightAmount) || 0,
      },
    ],

    notes: [
      order.specialInstructions
        ? `Special Instructions: ${order.specialInstructions}`
        : "This is a system-generated document.",
    ],

  
  };
};