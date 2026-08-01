"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { OneLapTracker } from "@skerp/types";
import { IconGps } from "@tabler/icons-react";

function formatDate(value: string | null): string {
    if (!value) return "Never";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
}

function formatLabel(value: string): string {
    return value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({
    value,
    type,
}: {
    value: string;
    type: "erp" | "signal" | "provider";
}) {
    let className = "bg-muted text-muted-foreground";

    if (
        value === "AVAILABLE" ||
        value === "LIVE" ||
        value.toLowerCase() === "online"
    ) {
        className = "bg-emerald-100 text-emerald-700";
    }

    if (value === "ASSIGNED") {
        className = "bg-blue-100 text-blue-700";
    }

    if (value === "DELAYED") {
        className = "bg-amber-100 text-amber-700";
    }

    if (
        value === "STALE" ||
        value === "EXPIRED" ||
        value.toLowerCase() === "offline"
    ) {
        className = "bg-red-100 text-red-700";
    }

    if (value === "DISABLED" || value === "MISSING_ON_PROVIDER") {
        className = "bg-slate-200 text-slate-700";
    }

    const label =
        type === "provider" ? formatLabel(value || "unknown") : formatLabel(value);

    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
        >
            {label}
        </span>
    );
}

export const oneLapTrackerColumns: ColumnDef<OneLapTracker>[] = [
    {
        accessorKey: "name",
        header: "Tracker",
        enableHiding: false,
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <IconGps size={16} />
                </span>

                <div className="flex flex-col">
                    <span className="font-medium">{row.original.name}</span>
                    <span className="text-xs text-muted-foreground">
                        Device ID: {row.original.oneLapDeviceId}
                    </span>
                </div>
            </div>
        ),
    },
    {
        accessorKey: "uniqueId",
        header: "IMEI",
    },
    {
        accessorKey: "providerStatus",
        header: "OneLap Status",
        cell: ({ row }) => (
            <StatusPill
                value={row.original.providerStatus ?? "unknown"}
                type="provider"
            />
        ),
    },
    {
        accessorKey: "signalHealth",
        header: "Signal",
        cell: ({ row }) => (
            <StatusPill value={row.original.signalHealth} type="signal" />
        ),
    },
    {
        accessorKey: "erpStatus",
        header: "ERP Status",
        cell: ({ row }) => (
            <StatusPill value={row.original.erpStatus} type="erp" />
        ),
    },
    {
        id: "assignment",
        header: "Assignment",
        cell: ({ row }) => {
            const assignment = row.original.activeAssignment;

            if (!assignment) {
                return <span className="text-muted-foreground">Available</span>;
            }

            return (
                <div className="flex flex-col">
                    <span className="font-medium">
                        {assignment.scheduleNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {assignment.rakeNumber ?? "Rake not generated"} ·{" "}
                        {assignment.installedOnVpNo}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "lastProviderUpdateAt",
        header: "Last Signal",
        cell: ({ row }) => formatDate(row.original.lastProviderUpdateAt),
    },
    {
        accessorKey: "lastSyncedAt",
        header: "Last Sync",
        cell: ({ row }) => formatDate(row.original.lastSyncedAt),
    },
];

export function OneLapTrackerExpandedRow({
    tracker,
}: {
    tracker: OneLapTracker;
}) {
    const assignment = tracker.activeAssignment;

    return (
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Phone" value={tracker.phone ?? "—"} />
            <Detail
                label="Vehicle Number"
                value={tracker.vehicleNumber ?? "—"}
            />
            <Detail
                label="Validity"
                value={formatDate(tracker.validityAt)}
            />
            <Detail
                label="Provider Record"
                value={tracker.isPresentOnProvider ? "Present" : "Missing"}
            />

            {assignment ? (
                <>
                    <Detail
                        label="Schedule"
                        value={assignment.scheduleNumber}
                    />
                    <Detail
                        label="Rake"
                        value={assignment.rakeNumber ?? "Not generated"}
                    />
                    {/* <Detail
                        label="Installed On"
                        value={assignment.installedOnVpNo}
                    /> */}
                    <Detail
                        label="Assigned At"
                        value={formatDate(assignment.assignedAt)}
                    />
                </>
            ) : null}
        </div>
    );
}

function Detail({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="mt-1 text-sm font-medium">{value}</p>
        </div>
    );
}