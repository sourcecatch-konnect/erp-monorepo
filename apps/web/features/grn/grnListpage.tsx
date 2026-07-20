"use client";

import * as React from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { toast } from "sonner";

import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { useCancelGRN, useGRNs } from "./useHook/useGRN";
import GRNTable, { type GRNListItem } from "./components/GRNTable";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";

export default function GrnListPage() {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");

  const debouncedSearch = useDebouncedValue(search);
  const size = 10;

  const canCreate = useCan(PERMS.GRN.CREATE);
  const canUpdate = useCan(PERMS.GRN.UPDATE);
  const canCancel = useCan(PERMS.GRN.CANCEL);
  const cancelGRN = useCancelGRN();

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const grns = useGRNs({
    page,
    size,
    search: debouncedSearch.trim(),
  });

  const rows = grns.data?.data ?? [];
  const total = grns.data?.meta?.total ?? 0;

  const handleCancel = (grn: GRNListItem) => {
    const identifier = grn.grnNumber || grn.id;
    const confirmed = window.confirm(`Cancel GRN ${grn.grnNumber ?? grn.id}?`);

    if (!confirmed) return;

    cancelGRN.mutate(
      {
        id: identifier,
        body: { reason: "Cancelled from GRN list" },
      },
      {
        onSuccess: () => toast.success("GRN cancelled"),
        onError: () => toast.error("Failed to cancel GRN"),
      },
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            Goods Receipt Notes at Rail Head
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all rail head goods receipt notes.
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
        canCancel={canCancel}
        onCancel={handleCancel}
      />
    </div>
  );
}
