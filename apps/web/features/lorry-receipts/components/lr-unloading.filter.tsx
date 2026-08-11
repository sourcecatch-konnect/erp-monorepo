"use client";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
    IconFilter,
    IconLoader2,
    IconRefresh,
    IconSearch,
} from "@tabler/icons-react";
import { ReportFilters } from "./lr-unloading-report.util";


type UnloadingReportFiltersProps = {
    draft: ReportFilters;
    error?: string;
    isFetching: boolean;
    onDraftChange: (filters: ReportFilters) => void;
    onApply: () => void;
    onReset: () => void;
};

export function UnloadingReportFilters({
    draft,
    error,
    isFetching,
    onDraftChange,
    onApply,
    onReset,
}: UnloadingReportFiltersProps) {
    const hasFilters = Boolean(
        draft.search ||
        draft.status ||
        draft.dateFrom ||
        draft.dateTo,
    );

    return (
        <form
            className="rounded-xl border bg-card p-4 shadow-sm"
            onSubmit={(event) => {
                event.preventDefault();
                onApply();
            }}
        >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_180px_180px_210px_auto]">
                <div className="space-y-1.5">
                    <label
                        htmlFor="report-search"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Search
                    </label>

                    <div className="relative">
                        <IconSearch
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />

                        <Input
                            id="report-search"
                            className="pl-9"
                            placeholder="LR, client or consignee"
                            value={draft.search ?? ""}
                            onChange={(event) =>
                                onDraftChange({
                                    ...draft,
                                    search: event.target.value || undefined,
                                })
                            }
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="report-date-from"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        From date
                    </label>

                    <Input
                        id="report-date-from"
                        type="date"
                        value={draft.dateFrom ?? ""}
                        onChange={(event) =>
                            onDraftChange({
                                ...draft,
                                dateFrom: event.target.value || undefined,
                            })
                        }
                    />
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="report-date-to"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        To date
                    </label>

                    <Input
                        id="report-date-to"
                        type="date"
                        value={draft.dateTo ?? ""}
                        onChange={(event) =>
                            onDraftChange({
                                ...draft,
                                dateTo: event.target.value || undefined,
                            })
                        }
                    />
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="report-status"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        POD status
                    </label>

                    <select
                        id="report-status"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={draft.status ?? ""}
                        onChange={(event) =>
                            onDraftChange({
                                ...draft,
                                status:
                                    (event.target.value ||
                                        undefined) as ReportFilters["status"],
                            })
                        }
                    >
                        <option value="">All statuses</option>
                        <option value="DELIVERED">Pending POD</option>
                        <option value="ACKNOWLEDGED">Acknowledged</option>
                    </select>
                </div>

                <div className="flex items-end gap-2">
                    <Button
                        type="submit"
                        className="flex-1"
                        disabled={isFetching}
                    >
                        {isFetching ? (
                            <IconLoader2
                                size={16}
                                className="mr-2 animate-spin"
                            />
                        ) : (
                            <IconFilter size={16} className="mr-2" />
                        )}

                        Apply
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={!hasFilters}
                        onClick={onReset}
                        title="Reset filters"
                    >
                        <IconRefresh size={16} />
                    </Button>
                </div>
            </div>

            {error && (
                <p className="mt-3 text-sm text-destructive">
                    {error}
                </p>
            )}
        </form>
    );
}