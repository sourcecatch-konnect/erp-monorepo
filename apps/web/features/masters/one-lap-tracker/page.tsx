"use client";

import * as React from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import type {
    OneLapTracker,
    OneLapTrackerStatusCounts,
} from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
    DropdownMenuItem,
} from "@skerp/ui/components/dropdown";
import {
    IconPower,
    IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";

import MasterListPage from "../_shared/MasterListPage";
import type { ListQuery } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import getErrorMessage from "../_shared/hooks/useMasterMutation";
import { ProtectedRoute } from "../../auth/components/ProtectedRoute";
import { useCan } from "../../auth/hooks/useCan";

import { oneLapTrackerApi } from "./one-lap-tracker.service";
import { oneLapTrackerKeys } from "./one-lap-tracker.key";
import {
    OneLapTrackerExpandedRow,
    oneLapTrackerColumns,
} from "./one-lap-trackerTable";

export default function OneLapTrackerPage() {
    return (
        <ProtectedRoute permission={PERMS.MASTERS.ONE_LAP_TRACKER.VIEW}>
            <OneLapTrackerMaster />
        </ProtectedRoute>
    );
}

function OneLapTrackerMaster() {
    const queryClient = useQueryClient();
    const canSync = useCan(PERMS.MASTERS.ONE_LAP_TRACKER.SYNC);
    const canUpdate = useCan(PERMS.MASTERS.ONE_LAP_TRACKER.UPDATE);

    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(10);

    const debouncedSearch = useDebouncedValue(search);

    const listQuery = React.useMemo<ListQuery>(
        () => ({
            page,
            size,
            ...(debouncedSearch.trim()
                ? { search: debouncedSearch.trim() }
                : {}),
        }),
        [page, size, debouncedSearch],
    );

    React.useEffect(() => {
        setPage(0);
    }, [debouncedSearch, size]);

    const trackers = useQuery({
        queryKey: oneLapTrackerKeys.list(listQuery),
        queryFn: () => oneLapTrackerApi.list(listQuery),
    });

    const counts = useQuery({
        queryKey: oneLapTrackerKeys.statusCounts,
        queryFn: oneLapTrackerApi.statusCounts,
    });

    const syncTrackers = useMutation({
        mutationFn: oneLapTrackerApi.sync,
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({
                queryKey: oneLapTrackerKeys.all,
            });

            toast.success(
                `OneLap sync completed: ${result.created} created, ` +
                `${result.updated} updated, ${result.markedMissing} missing`,
            );
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const updateTracker = useMutation({
        mutationFn: ({
            id,
            isEnabled,
        }: {
            id: string;
            isEnabled: boolean;
        }) => oneLapTrackerApi.update(id, { isEnabled }),

        onSuccess: async (tracker) => {
            await queryClient.invalidateQueries({
                queryKey: oneLapTrackerKeys.all,
            });

            toast.success(
                `${tracker.name} ${tracker.isEnabled ? "enabled" : "disabled"}`,
            );
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    return (
        <MasterListPage
            title="OneLap Trackers"
            data={trackers.data?.data ?? []}
            columns={oneLapTrackerColumns}
            isLoading={trackers.isLoading}
            search={search}
            onSearchChange={setSearch}
            page={page}
            size={size}
            total={trackers.data?.meta?.total ?? 0}
            onPageChange={setPage}
            onSizeChange={setSize}
            defaultHiddenColumns={["lastSyncedAt"]}
            summary={
                <TrackerSummary
                    counts={counts.data}
                    isLoading={counts.isLoading}
                />
            }
            headerActions={
                canSync ? (
                    <Button
                        variant="outline"
                        onClick={() => syncTrackers.mutate()}
                        disabled={syncTrackers.isPending}
                        className="gap-2"
                    >
                        <IconRefresh
                            size={16}
                            className={
                                syncTrackers.isPending ? "animate-spin" : ""
                            }
                        />
                        {syncTrackers.isPending
                            ? "Syncing..."
                            : "Sync from OneLap"}
                    </Button>
                ) : null
            }
            extraRowActions={
                canUpdate
                    ? (tracker) => {
                        const cannotDisable =
                            tracker.isEnabled &&
                            Boolean(tracker.activeAssignment);

                        return (
                            <DropdownMenuItem
                                disabled={
                                    updateTracker.isPending || cannotDisable
                                }
                                onClick={() =>
                                    updateTracker.mutate({
                                        id: tracker.id,
                                        isEnabled: !tracker.isEnabled,
                                    })
                                }
                            >
                                <IconPower size={16} className="mr-2" />
                                {cannotDisable
                                    ? "Assigned tracker cannot be disabled"
                                    : tracker.isEnabled
                                        ? "Disable"
                                        : "Enable"}
                            </DropdownMenuItem>
                        );
                    }
                    : undefined
            }
            renderExpandedRow={(tracker) => (
                <OneLapTrackerExpandedRow tracker={tracker} />
            )}
            expandOnRowClick
        />
    );
}

function TrackerSummary({
    counts,
    isLoading,
}: {
    counts?: OneLapTrackerStatusCounts;
    isLoading: boolean;
}) {
    const items = [
        { label: "Total", value: counts?.total },
        { label: "Available", value: counts?.available },
        { label: "Assigned", value: counts?.assigned },
        { label: "Disabled", value: counts?.disabled },
        { label: "Live Signal", value: counts?.live },
        { label: "Stale Signal", value: counts?.stale },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="rounded-lg border bg-card px-4 py-3"
                >
                    <p className="text-xs text-muted-foreground">
                        {item.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                        {isLoading ? "—" : (item.value ?? 0)}
                    </p>
                </div>
            ))}
        </div>
    );
}
