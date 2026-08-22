"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { IconDownload, IconLoader2, IconRefresh } from "@tabler/icons-react";

import {
  deliveryWorklistApi,
  deliveryWorklistKeys,
} from "./lorry-receipt.service";
import {
  exportUnloadingReportCsv,
  LRUnloadingReportRow,
  normalizeReportFilters,
  ReportFilters,
} from "./components/lr-unloading-report.util";
import { UnloadingReportSummary } from "./components/lr-unloadingSummary";
import { UnloadingReportFilters } from "./components/lr-unloading.filter";
import { UnloadingReportTable } from "./components/lr-unloading-table";

export default function LRUnloadingReportPage() {
  const [draft, setDraft] = React.useState<ReportFilters>({});

  const [filters, setFilters] = React.useState<ReportFilters>({});

  const [filterError, setFilterError] = React.useState<string>();

  const query = useQuery({
    queryKey: deliveryWorklistKeys.unloadingReport(filters),
    queryFn: () => deliveryWorklistApi.unloadingReport(filters),
  });

  const rows = (query.data ?? []) as LRUnloadingReportRow[];

  const applyFilters = () => {
    const normalized = normalizeReportFilters(draft);

    if (
      normalized.dateFrom &&
      normalized.dateTo &&
      normalized.dateFrom > normalized.dateTo
    ) {
      setFilterError("From date cannot be later than To date.");
      return;
    }

    setFilterError(undefined);
    setDraft(normalized);
    setFilters(normalized);
  };

  const resetFilters = () => {
    setFilterError(undefined);
    setDraft({});
    setFilters({});
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">LR Unloading</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            A compact delivery worklist with complete details available per LR.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={!rows.length || query.isFetching}
          onClick={() => exportUnloadingReportCsv(rows)}
        >
          {query.isFetching ? (
            <IconLoader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <IconDownload size={16} className="mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      <UnloadingReportSummary rows={rows} isLoading={query.isLoading} />

      <UnloadingReportFilters
        draft={draft}
        error={filterError}
        isFetching={query.isFetching}
        onDraftChange={setDraft}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-medium text-destructive">
              Unable to load the unloading report
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {query.error instanceof Error
                ? query.error.message
                : "An unexpected error occurred."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
          >
            <IconRefresh size={16} className="mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        <UnloadingReportTable
          rows={rows}
          isLoading={query.isLoading}
          onClearFilters={resetFilters}
        />
      )}
    </div>
  );
}
