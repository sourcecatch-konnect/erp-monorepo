import { formatDate, formatDateTime } from "@/lib/format";


export type ReportStatus = "DELIVERED" | "ACKNOWLEDGED";

export type ReportFilters = {
  search?: string;
  status?: ReportStatus;
  dateFrom?: string;
  dateTo?: string;
};
export type DateValue = string | null | undefined;

export type LRUnloadingReportRow = {
  id: string;
  lrNumber: string;
  lrDate: DateValue;

  consignorName?: string | null;
  consigneeName?: string | null;

  originBranchName?: string | null;
  destinationBranchName?: string | null;

  challanNumbers?: string[] | null;

  reportedAt?: DateValue;
  unloadingAt?: DateValue;
  deliveredAt?: DateValue;

  receiverName?: string | null;
  podReceivedAt?: DateValue;

  courierName?: string | null;
  courierDocketNo?: string | null;

  detentionDays?: number | null;
  detentionAmount?: number | string | null;

  status: ReportStatus;
};
export function normalizeReportFilters(
  filters: ReportFilters,
): ReportFilters {
  return {
    search: filters.search?.trim() || undefined,
    status: filters.status || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

export function formatAmount(
  value?: number | string | null,
): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function exportUnloadingReportCsv(
  rows: LRUnloadingReportRow[],
) {
  const headings = [
    "LR Number",
    "LR Date",
    "Consignor / Client",
    "Consignee",
    "Origin Branch",
    "Destination Branch",
    "Delivery Challans",
    "Reported At",
    "Unloading Completed At",
    "Receiver Handover At",
    "Receiver Name",
    "POD Received At",
    "Courier",
    "Docket Number",
    "Detention Days",
    "Detention Amount",
    "Status",
  ];

  const lines = rows.map((row) =>
    [
      row.lrNumber,
      formatDate(row.lrDate),
      row.consignorName,
      row.consigneeName,
      row.originBranchName,
      row.destinationBranchName,
      row.challanNumbers?.join(", "),
      formatDateTime(row.reportedAt),
      formatDateTime(row.unloadingAt),
      formatDateTime(row.deliveredAt),
      row.receiverName,
      formatDateTime(row.podReceivedAt),
      row.courierName,
      row.courierDocketNo,
      row.detentionDays,
      row.detentionAmount,
      row.status,
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = [
    headings.map(csvCell).join(","),
    ...lines,
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `lr-unloading-report-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}