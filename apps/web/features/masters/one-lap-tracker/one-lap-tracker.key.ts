import type { ListQuery } from "../_shared/master-api";

export const oneLapTrackerKeys = {
    all: ["one-lap-trackers"] as const,

    list: (query?: ListQuery) =>
        [...oneLapTrackerKeys.all, "list", query] as const,

    detail: (id: string) =>
        [...oneLapTrackerKeys.all, "detail", id] as const,

    statusCounts: [
        ...["one-lap-trackers"],
        "status-counts",
    ] as const,
};