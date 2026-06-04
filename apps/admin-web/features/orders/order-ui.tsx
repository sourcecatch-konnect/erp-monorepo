import * as React from "react";
import type { OrderStatus } from "@skerp/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PendingApproval: "bg-amber-100 text-amber-800 ring-amber-200",
  Confirmed: "bg-green-100 text-green-800 ring-green-200",
  Rejected: "bg-red-100 text-red-700 ring-red-200",
  Cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
  InProgress: "bg-blue-100 text-blue-800 ring-blue-200",
  Completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PendingApproval: "Pending Approval",
  Confirmed: "Confirmed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
  InProgress: "In Progress",
  Completed: "Completed",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export const formatMoney = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

export const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const STATUS_ORDER: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PendingApproval", label: "Pending Approval" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Rejected", label: "Rejected" },
  { key: "Cancelled", label: "Cancelled" },
];
