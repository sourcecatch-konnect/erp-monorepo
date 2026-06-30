// apps/web/features/MRRR/mrrrListPage.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import type { ListQuery } from "@/features/masters/_shared/master-api";



import { useMRRRList } from "./hook/useMrrr";
import MRRRTable from "./mrrrTable";

export function MRRRListPage() {
  const router = useRouter();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");

  const debouncedSearch = useDebouncedValue(search);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, status]);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
      ...(status !== "ALL"
        ? {
            filter: {
              status,
            },
          }
        : {}),
    }),
    [page, size, debouncedSearch, status],
  );

  const mrrrQuery = useMRRRList(listQuery);

  const data = mrrrQuery.data?.data ?? [];
  const total = mrrrQuery.data?.meta?.total ?? 0;

  const totalPages = Math.ceil(total / size);
  const hasPrevPage = page > 0;
  const hasNextPage = page + 1 < totalPages;

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">MR/RR</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage MR/RR documents from VP schedules.
          </p>
        </div>

        <Button onClick={() => router.push("/vp-management/mrrr/new")}>
          <IconPlus size={16} className="mr-1" />
          Add MR/RR
        </Button>
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by MR/RR number, VP schedule, branch..."
            className="sm:max-w-sm"
          />

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[160px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <MRRRTable data={data} isLoading={mrrrQuery.isLoading} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {data.length} of {total} MR/RR documents
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(size)}
            onValueChange={(value) => handleSizeChange(Number(value))}
          >
            <SelectTrigger className="h-9 w-[90px] bg-background">
              <SelectValue placeholder="Size" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="30">30</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages || 1}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}