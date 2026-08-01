import * as React from "react";

import { cn } from "@/lib/utils";

export type RailBranchGRNStatus = "DRAFT" | "SUBMITTED";

const STATUS_LABELS: Record<RailBranchGRNStatus, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
};

const STATUS_STYLES: Record<RailBranchGRNStatus, string> = {
    DRAFT: "border-slate-500/20 bg-slate-500/10 text-slate-600",
    SUBMITTED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
};

const isRailBranchGRNStatus = (
    status: string | null | undefined,
): status is RailBranchGRNStatus =>
    status === "DRAFT" || status === "SUBMITTED";

export function RailBranchGRNStatusBadge({
    status,
    className,
}: {
    status?: string | null;
    className?: string;
}) {
    if (!isRailBranchGRNStatus(status)) {
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
                    "text-xs font-semibold shadow-sm",
                    "border-border bg-muted text-muted-foreground",
                    className,
                )}
            >
                <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                —
            </span>
        );
    }

    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
                "text-xs font-semibold shadow-sm",
                STATUS_STYLES[status],
                className,
            )}
        >
            <span className="h-2 w-2 rounded-full bg-current" />
            {STATUS_LABELS[status]}
        </span>
    );
}

export const RAIL_BRANCH_GRN_STATUS_ORDER: {
    key: "ALL" | RailBranchGRNStatus;
    label: string;
}[] = [
        { key: "ALL", label: "All" },
        { key: "DRAFT", label: "Draft" },
        { key: "SUBMITTED", label: "Submitted" },
    ];

export const formatRailBranchGRNDate = (
    value?: string | Date | null,
) => {
    if (!value) return "—";

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export const formatRailBranchGRNDateTime = (
    value?: string | Date | null,
) => {
    if (!value) return "—";

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};