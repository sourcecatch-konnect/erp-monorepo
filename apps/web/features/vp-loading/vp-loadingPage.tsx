"use client";

import * as React from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";

import { useVPWagonLoadings } from "./hook/useVP-loading";

import VPLoadingTable, {
  type VPLoadingTableRow,
} from "./components/vp-loadingTable";

export default function VPLoadingListPage() {
  const [search, setSearch] =
    React.useState("");

  const [page, setPage] =
    React.useState(0);

  const size = 10;

  const debouncedSearch =
    useDebouncedValue(search, 300);

  const canCreate: boolean =
    useCan(PERMS.VP_LOADING.CREATE);

  // One item represents one VP wagon loading.
  const wagons = useVPWagonLoadings();

  const loadingRows =
    React.useMemo<VPLoadingTableRow[]>(
      () => {
        const query = debouncedSearch
          .trim()
          .toLowerCase();

        const rows = wagons.data ?? [];

        if (!query) {
          return rows;
        }

        return rows.filter((row) => {
          const searchableValues = [
            row.schedule.scheduleNumber,
            row.schedule.scheduleName,

            row.schedule.fromBranch?.name,
            row.schedule.toBranch?.name,

            row.schedule.sourceArea?.name,
            row.schedule.destinationArea?.name,

            row.mrRrRow.vpNo,
            row.mrRrRow.rowLabel,
            row.mrRrRow.wagon?.name,

            row.status,

            row.allocationCount,
            row.totalLoadedQty,
          ];

          return searchableValues.some(
            (value) =>
              String(value ?? "")
                .toLowerCase()
                .includes(query),
          );
        });
      },
      [wagons.data, debouncedSearch],
    );

  const total = loadingRows.length;

  const pageCount = Math.max(
    1,
    Math.ceil(total / size),
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  React.useEffect(() => {
    if (page >= pageCount) {
      setPage(
        Math.max(pageCount - 1, 0),
      );
    }
  }, [page, pageCount]);

  const rows = React.useMemo(() => {
    const start = page * size;

    return loadingRows.slice(
      start,
      start + size,
    );
  }, [loadingRows, page, size]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            VP Loading
          </h1>

          <p className="text-sm text-muted-foreground">
            Load submitted GRN and LR goods
            into scheduled railway wagons.
          </p>
        </div>

        {canCreate ? (
          <Button asChild>
            <Link href="/vp-management/vp-loading/new">
              <IconPlus
                size={16}
                className="mr-1"
              />
              Create VP Loading
            </Link>
          </Button>
        ) : null}
      </div>

      <VPLoadingTable
        data={rows}
        total={total}
        page={page}
        size={size}
        search={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        isLoading={wagons.isLoading}
        isFetching={wagons.isFetching}
        isError={wagons.isError}
        onRetry={() => wagons.refetch()}
      />
    </div>
  );
}
