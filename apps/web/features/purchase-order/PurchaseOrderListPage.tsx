"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { StatusTabs, TablePaginationFooter, TableSearchInput } from "@/components/data-table";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { formatPaise } from "@/lib/money";
import {
  purchaseOrderApi,
  LOOKUP_PAGE_SIZE,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "./api/purchase-order.service";
import { purchaseOrderKeys } from "./api/purchase-order.keys";
import { PurchaseOrderStatusBadge } from "./purchaseOrderStatusBadge";
import { PurchaseOrderFormDialog } from "./PurchaseOrderFormDialog";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "APPROVED", label: "Approved" },
  { key: "SENT", label: "Sent" },
  { key: "PARTIALLY_RECEIVED", label: "Partially received" },
  { key: "RECEIVED", label: "Received" },
  { key: "CLOSED", label: "Closed" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

/** Purchase Order — commitment-only document (never moves stock or posts to
 *  the ledger). Header + a line-item grid, one page, matching the "search
 *  instead of drill-down" screen philosophy agreed for this module. */
export function PurchaseOrderListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = useCan(PERMS.WORKSHOP.PO_MANAGE);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<PurchaseOrder | null>(null);

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [supplierFilterId, setSupplierFilterId] = React.useState("");
  const [supplierFilterSearch, setSupplierFilterSearch] = React.useState("");
  const debouncedSupplierFilterSearch = useDebouncedValue(supplierFilterSearch, 300);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const listParams = {
    page,
    size,
    status: statusFilter === "ALL" ? undefined : (statusFilter as PurchaseOrderStatus),
    supplierId: supplierFilterId || undefined,
    search: debouncedSearch || undefined,
  };

  const list = useQuery({
    queryKey: purchaseOrderKeys.list(listParams),
    queryFn: () => purchaseOrderApi.list(listParams),
  });
  const orders = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;

  // Independent of the create/edit form's own supplier picker — this one
  // powers the filter bar and stays available even while that dialog is
  // closed.
  const supplierFilterOptions = useInfiniteQuery({
    queryKey: ["purchase-order", "suppliers", "filter", debouncedSupplierFilterSearch],
    queryFn: ({ pageParam = 0 }) =>
      purchaseOrderApi.suppliers({
        page: pageParam,
        size: LOOKUP_PAGE_SIZE,
        search: debouncedSupplierFilterSearch,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;
      if (typeof total === "number") return loaded < total ? allPages.length : undefined;
      return lastPage.data.length === LOOKUP_PAGE_SIZE ? allPages.length : undefined;
    },
  });
  const supplierFilterList = React.useMemo(
    () => supplierFilterOptions.data?.pages.flatMap((page) => page.data) ?? [],
    [supplierFilterOptions.data],
  );

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (po: PurchaseOrder) => {
    setEditTarget(po);
    setFormOpen(true);
  };

  // Detail page's Edit button routes back here with ?edit=<id> since the
  // multi-line edit form only exists in this list page's dialog.
  const editParamId = searchParams.get("edit");
  React.useEffect(() => {
    if (!editParamId) return;
    const target = orders.find((p) => p.id === editParamId);
    if (target) {
      openEdit(target);
      router.replace("/workshop/purchase-orders");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParamId, orders]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Commitment to buy spare parts from a supplier. Creating or approving a PO never
            moves stock — only an Inward posted against it does.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <IconPlus size={15} className="mr-1" /> New PO
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <StatusTabs
          tabs={STATUS_TABS}
          active={statusFilter}
          onChange={(key) => {
            setStatusFilter(key);
            setPage(0);
          }}
          layoutId="po-status-tabs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Search PO number or supplier..."
          />
          <div className="w-64">
            <Combobox
              options={supplierFilterList}
              value={supplierFilterId}
              onChange={(v) => {
                setSupplierFilterId(v);
                setPage(0);
              }}
              searchValue={supplierFilterSearch}
              onSearchChange={setSupplierFilterSearch}
              placeholder="Filter by supplier..."
              searchPlaceholder="Type to search..."
              emptyText={supplierFilterOptions.isLoading ? "Loading suppliers..." : "No suppliers found"}
              hasMore={Boolean(supplierFilterOptions.hasNextPage)}
              isLoadingMore={supplierFilterOptions.isFetchingNextPage}
              onScrollEnd={() => {
                if (supplierFilterOptions.hasNextPage && !supplierFilterOptions.isFetchingNextPage) {
                  supplierFilterOptions.fetchNextPage();
                }
              }}
            />
          </div>
          {supplierFilterId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSupplierFilterId("");
                setSupplierFilterSearch("");
                setPage(0);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Estimated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!list.isLoading && orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            )}
            {orders.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer"
                onClick={() => router.push(`/workshop/purchase-orders/${po.id}`)}
              >
                <TableCell className="font-medium text-primary hover:underline">{po.poNumber ?? "—"}</TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell>{po.branch.name}</TableCell>
                <TableCell>{new Date(po.poDate).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <PurchaseOrderStatusBadge status={po.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(po.estimatedPaise)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/workshop/purchase-orders/${po.id}`);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationFooter
          total={total}
          page={page}
          size={size}
          onPageChange={setPage}
          onSizeChange={handleSizeChange}
        />
      </div>

      <PurchaseOrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editTarget={editTarget}
      />
    </div>
  );
}
