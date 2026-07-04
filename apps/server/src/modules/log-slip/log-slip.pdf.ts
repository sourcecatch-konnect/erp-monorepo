import path from "node:path";
import { Prisma } from "../../../generated/prisma/index.js";
import type { PdfDocument, PdfTable } from "../../templetes/pdf/pdf.type.js";
import { imageToBase64Src } from "../_shared/pdf.helper.js";
import { paiseToRupees } from "../../lib/money.js";
import { logSlipInclude } from "./log-slip.service.js";

const headerImageSrc = imageToBase64Src(
  path.resolve(process.cwd(), "public/skt_logo.svg"),
);

export type LogSlipPdfData = Prisma.LogSlipGetPayload<{
  include: typeof logSlipInclude;
}>;

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

const formatDate = (date: Date | null | undefined) =>
  date ? new Date(date).toLocaleDateString("en-IN") : "-";

const amount = (paise: bigint | number | null | undefined): string => {
  if (paise === null || paise === undefined) return "-";
  return `${paiseToRupees(Number(paise)).toLocaleString("en-IN")} /-`;
};

const qty = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : value.toLocaleString("en-IN");

export const buildLogSlipPdfDocument = (slip: LogSlipPdfData): PdfDocument => {
  const generatedByName = slip.generatedBy
    ? `${slip.generatedBy.firstName} ${slip.generatedBy.lastName}`
    : undefined;

  const linesOf = (type: string) =>
    slip.lines.filter((l) => l.lineType === type);

  const freightTable: PdfTable = {
    title: "Trip Legs & Freight",
    columns: ["#", "Leg", "Freight"],
    rows: linesOf("TRIP_FREIGHT").map((l, i) => [
      i + 1,
      l.description,
      amount(l.amountPaise),
    ]),
  };

  const advanceTable: PdfTable = {
    title: "Driver Advances",
    columns: ["#", "Advance", "Amount"],
    rows: linesOf("ADVANCE").map((l, i) => [
      i + 1,
      l.description,
      amount(l.amountPaise),
    ]),
  };

  const dieselTable: PdfTable = {
    title: "Diesel",
    columns: ["#", "Fill", "Qty (L)", "Rate", "Amount"],
    rows: linesOf("DIESEL").map((l, i) => [
      i + 1,
      l.description,
      qty(l.quantity),
      amount(l.ratePaise),
      amount(l.amountPaise),
    ]),
  };

  const expenseTable: PdfTable = {
    title: "Other Expenses",
    columns: ["#", "Expense", "Amount"],
    rows: linesOf("EXPENSE").map((l, i) => [
      i + 1,
      l.description,
      amount(l.amountPaise),
    ]),
  };

  return {
    layout: "compact-form",
    title: "Log Slip",
    documentNo: slip.logSlipNumber ?? "(draft)",
    date: formatDate(slip.logSlipDate),
    status: slip.status,

    createdAt: formatDateTime(slip.generatedAt ?? slip.createdAt),
    createdBy: generatedByName,

    company: {
      headerImageSrc,
      name: "S K TRANS LINES PVT. LTD.",
      address:
        "Corporate Off.: S K TOWER, A-52, Ground Floor, Ayodhya Nagar Road, OLD MIDC, Jalgaon - 425003",
      cin: "U63000MH2004PTC148258",
      email: "customercare@sktranslines.com",
      website: "www.sktranslines.com",
    },

    sections: [
      {
        title: `Journey ${slip.journey.journeyNumber}`,
        columns: 3,
        fields: [
          { label: "Vehicle", value: slip.vehicle.vehicleNumber },
          { label: "Driver", value: slip.driver.name },
          { label: "FY", value: slip.fyCode },
          { label: "Started", value: formatDateTime(slip.journey.startedAt) },
          { label: "Returned", value: formatDateTime(slip.journey.closedAt) },
          { label: "Total Days", value: slip.totalDays },
          { label: "Opening KM", value: slip.openingKm },
          { label: "Closing KM", value: slip.closingKm },
          { label: "Total KM", value: slip.totalKm },
        ],
      },
      {
        title: "Diesel Account",
        columns: 3,
        fields: [
          { label: "Diesel Qty (L)", value: qty(slip.totalDieselQty) },
          {
            label: "Previous Qty (L)",
            value: qty(slip.previousDieselQty),
          },
          { label: "Diesel Amount", value: amount(slip.totalDieselAmountPaise) },
          { label: "Standard Avg (KM/L)", value: qty(slip.standardAverage) },
          { label: "Actual Avg (KM/L)", value: qty(slip.actualAverage) },
          { label: "Short Diesel (L)", value: qty(slip.shortDieselQty) },
        ],
      },
    ],

    tables: [freightTable, advanceTable, dieselTable, expenseTable].filter(
      (t) => t.rows.length > 0,
    ),

    summary: [
      { label: "Total Freight", value: amount(slip.totalFreightPaise) },
      { label: "Total Advance", value: amount(slip.totalAdvancePaise) },
      { label: "Cash Expenses", value: amount(slip.totalCashExpensePaise) },
      { label: "Credit Expenses", value: amount(slip.totalCreditExpensePaise) },
      { label: "Total Expenses", value: amount(slip.totalExpensePaise) },
      {
        label:
          Number(slip.driverPayablePaise) > 0
            ? "Payable to Driver"
            : "Receivable from Driver",
        value: amount(
          Number(slip.driverPayablePaise) > 0
            ? slip.driverPayablePaise
            : slip.driverReceivablePaise,
        ),
      },
      { label: "Net Vehicle Result", value: amount(slip.netVehicleResultPaise) },
    ],

    notes: slip.remarks ? [slip.remarks] : undefined,
    signatures: ["Driver", "Operations", "Accounts"],
  };
};
