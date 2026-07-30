import * as React from "react";

import { cn } from "@/lib/utils";

export type RailRakeOperationStatus =
    | "DRAFT"
    | "SUBMITTED"
    | "CANCELLED";

const STATUS_LABELS: Record<RailRakeOperationStatus, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<RailRakeOperationStatus, string> = {
    DRAFT: "border-slate-500/20 bg-slate-500/10 text-slate-600",
    SUBMITTED:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    CANCELLED: "border-red-500/20 bg-red-500/10 text-red-700",
};

const isRailRakeOperationStatus = (
    status: string | null | undefined,
): status is RailRakeOperationStatus =>
    status === "DRAFT" ||
    status === "SUBMITTED" ||
    status === "CANCELLED";

export function RailRakeOperationStatusBadge({
    status,
    className,
}: {
    status?: string | null;
    className?: string;
}) {
    if (!isRailRakeOperationStatus(status)) {
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

export const RAIL_RAKE_OPERATION_STATUS_ORDER: {
    key: "ALL" | RailRakeOperationStatus;
    label: string;
}[] = [
        { key: "ALL", label: "All" },
        { key: "DRAFT", label: "Draft" },
        { key: "SUBMITTED", label: "Submitted" },
        { key: "CANCELLED", label: "Cancelled" },
    ];