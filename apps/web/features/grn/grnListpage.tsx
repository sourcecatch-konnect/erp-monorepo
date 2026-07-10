"use client";

import * as React from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { useGRNs } from "./useHook/useGRN";
import GRNTable, { type GRNListItem } from "./components/GRNTable";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";

export default function GrnListPage() {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");

  const debouncedSearch = useDebouncedValue(search);
  const size = 25;

  const canCreate = useCan(PERMS.GRN.CREATE);
  const canUpdate = useCan(PERMS.GRN.UPDATE);


  const canDelete = useCan(PERMS.GRN.DELETE);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const grns = useGRNs({
    page,
    size,
    search: debouncedSearch.trim(),
  });

  const payload = grns.data as any;

  const rows = payload?.data ?? [];
  const total = payload?.meta?.total ?? payload?.total ?? payload?.count ?? 0;

  const handleDelete = (grn: GRNListItem) => {
    // Later open confirm dialog here
    console.log("Delete GRN", grn);
    // Example:
    // setDeleteTarget(grn);
    // setDeleteOpen(true);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">GRN</h1>
          <p className="text-sm text-muted-foreground">
            Goods Receipt Note list
          </p>
        </div>

        {canCreate ? (
          <Button asChild>
            <Link href="/vp-management/grn/new">
              <IconPlus size={16} className="mr-1" />
              Create GRN
            </Link>
          </Button>
        ) : null}
      </div>

      <GRNTable
        data={rows}
        total={total}
        page={page}
        size={size}
        onPageChange={setPage}
        search={search}
        onSearchChange={setSearch}
        isLoading={grns.isLoading}
        isError={grns.isError}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onDelete={handleDelete}
      />
    </div>
  );
}