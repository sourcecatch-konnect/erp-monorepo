// apps/web/features/vp-schedule/components/VPScheduleListPage.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";

import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import type { ListQuery } from "@/features/masters/_shared/master-api";
import { useVPSchedules } from "./hook/useVPSchedule";
import VPScheduleTable from "./vp-scheduleTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@skerp/ui/components/select";


export function VPScheduleListPage() {
  const router = useRouter();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");

  const debouncedSearch = useDebouncedValue(search);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

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

  const schedules = useVPSchedules(listQuery);

  const data = schedules.data?.data ?? [];
  const total = schedules.data?.meta?.total ?? 0;
  console.log(data, "vp schedule")
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
          <h1 className="text-xl font-semibold tracking-tight">VP Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage railway VP schedules.
          </p>
        </div>

        <Button onClick={() => router.push("/vp-management/vp-schedule/new")}>
          <IconPlus size={16} className="mr-1" />
          Add Schedule
        </Button>
      </div>
         
      <div className="relative w-full sm:max-w-sm">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by schedule name, source, destination or rake no..."
            className="sm:max-w-sm"
          />
        
    
        </div>
      

      <VPScheduleTable data={data} isLoading={schedules.isLoading} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {data.length} of {total} schedules
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