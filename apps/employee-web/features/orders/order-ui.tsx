import * as React from "react";
import type { OrderStatus } from "@skerp/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<OrderStatus, string> = {
    PendingApproval: "Pending Approval",
    Confirmed: "Confirmed",
    Rejected: "Rejected",
    Cancelled: "Cancelled",
    InProgress: "In Progress",
    Completed: "Completed",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
    PendingApproval: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    Confirmed: "bg-green-500/10 text-green-700 border-green-500/20",
    Rejected: "bg-red-500/10 text-red-700 border-red-500/20",
    Cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    InProgress: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
                "text-xs font-semibold shadow-sm",
                STATUS_STYLES[status],
            )}
        >
            <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
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
    { key: "InProgress", label: "In Progress" },
    { key: "Completed", label: "Completed" },
];