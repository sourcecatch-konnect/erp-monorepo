"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Order } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  IconBan,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconCurrencyRupee,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFileText,
  IconHash,
  IconListDetails,
  IconMapPin,
  IconTag,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import {
  ColumnPickerPopover,
  PIN_CELL_BG,
  PIN_HEAD_BG,
  SortHeader,
  StatusTabs,
  TableEmptyState,
  TablePaginationFooter,
  TableSearchInput,
  pinStyle,
  type ColumnMeta,
} from "@/components/data-table";
import { StatusBadge, formatDate, STATUS_ORDER } from "./order-ui";

export type OrderRowActions = {
  onQuickView: (order: Order) => void;
  onApprove: (order: Order) => void;
  onReject: (order: Order) => void;
  onCancel: (order: Order) => void;
  onCreateLR: (order: Order) => void;
  onDownloadPdf: (order: Order) => void;
  onDelete: (order: Order) => void;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  canUpdate: boolean;
  canCreateLR: boolean;
  canDelete: boolean;
  canDownloadPdf: boolean;
};

type Props = OrderRowActions & {
  data: Order[];
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: React.Dispatch<
    React.SetStateAction<VisibilityState>
  >;
  columnOrder: string[];
  onColumnOrderChange: (order: string[]) => void;
  counts: Record<string, number>;
  isLoading?: boolean;
};

/**
 * The reorderable columns, in default order. Status/Actions stay pinned
 * right — outside the user's control.
 */
export const DEFAULT_ORDER_COLUMN_ORDER = [
  "order",
  "customer",
  "route",
  "type",
  "pickup",
  "freight",
  "createdBy",
] as const;

const COLUMN_META: ColumnMeta = {
  order: { label: "Order No", icon: IconHash },
  customer: { label: "Customer", icon: IconBuilding },
  route: { label: "Route", icon: IconMapPin },
  type: { label: "Type", icon: IconTag },
  pickup: { label: "Pickup", icon: IconCalendar },
  freight: { label: "Freight", icon: IconCurrencyRupee },
  createdBy: { label: "Created by", icon: IconUser },
};

const SKELETON_WIDTHS: Record<string, string> = {
  order: "w-24",
  customer: "w-28",
  route: "w-32",
  type: "w-20",
  pickup: "w-20",
  freight: "ml-auto w-16",
  createdBy: "w-24",
  status: "w-24",
  actions: "ml-auto w-8",
};

const routeLabel = (o: Order) => {
  const source = o.route?.sourceCity?.name;
  const destination = o.route?.destinationCity?.name;

  if (source || destination) {
    return `${source ?? "?"} → ${destination ?? "?"}`;
  }

  return "—";
};

const typeLabel = (o: Order) =>
  o.orderType === "Truck"
    ? `${o.truckQuantity ?? ""} × ${o.vehicleType?.name ?? "Truck"}`.trim()
    : `Item (${o.items?.length ?? 0})`;

export default function OrderTable(props: Props) {
  const {
    data,
    total,
    page,
    size,
    onPageChange,
    onSizeChange,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    sort,
    onSortChange,
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    counts,
    isLoading,
    canDelete,
    onDelete,
    onQuickView,
    onApprove,
    onReject,
    onCancel,
    onCreateLR,
    onDownloadPdf,
    canApprove,
    canReject,
    canCancel,
    canUpdate,
    canCreateLR,
    canDownloadPdf,
  } = props;

  const columns = React.useMemo<ColumnDef<Order>[]>(
    () => [
      {
        id: "order",
        header: "Order No",
        cell: ({ row }) => (
          <Link
            href={`/orders/${encodeURIComponent(row.original.orderNumber)}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => row.original.customer?.name ?? "—",
      },
      {
        id: "route",
        header: "Route",
        cell: ({ row }) => routeLabel(row.original),
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => typeLabel(row.original),
      },
      {
        id: "pickup",
        header: () => (
          <SortHeader
            label="Pickup"
            field="pickupDate"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => formatDate(row.original.pickupDate),
      },
      {
        id: "freight",
        header: () => (
          <SortHeader
            label="Freight"
            field="bookingFreightAmount"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {formatPaise(row.original.bookingFreightAmount)}
          </div>
        ),
      },
      {
        id: "createdBy",
        header: "Created by",
        cell: ({ row }) =>
          row.original.createdBy
            ? `${row.original.createdBy.firstName} ${row.original.createdBy.lastName}`
            : "—",
      },
      {
        id: "status",
        header: "Status",
        size: 148,
        enableHiding: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        size: 72,
        enableHiding: false,
        cell: ({ row }) => {
          const o = row.original;

          const isPending = o.status === "PendingApproval";

          const editable =
            o.status === "PendingApproval" || o.status === "Rejected";

          const deletable =
            o.status === "PendingApproval" ||
            o.status === "Rejected" ||
            o.status === "Cancelled";
          const hasLRGroup =
            Boolean(o.hasLRGroup) || Number(o.lrGroupCount ?? 0) > 0;

          const canCreateLRForOrder =
            canCreateLR &&
            o.status === "Confirmed" &&
            o.orderType === "Truck" &&
            !hasLRGroup;

          const cancellable =
            o.status === "PendingApproval" || o.status === "Confirmed";

          const hasDangerActions =
            (canCancel && cancellable) || (canDelete && deletable);

          return (
            <div
              className="flex items-center justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Row actions">
                    <IconDotsVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/orders/${encodeURIComponent(o.orderNumber)}`}>
                      <IconListDetails size={16} className="mr-2" /> View
                      details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {canApprove && isPending ? (
                    <DropdownMenuItem onClick={() => onApprove(o)}>
                      <IconCheck size={16} className="mr-2" /> Approve
                    </DropdownMenuItem>
                  ) : null}
                  {canReject && isPending ? (
                    <DropdownMenuItem onClick={() => onReject(o)}>
                      <IconX size={16} className="mr-2" /> Reject
                    </DropdownMenuItem>
                  ) : null}
                  {canUpdate && editable ? (
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/orders/${encodeURIComponent(o.orderNumber)}/edit`}
                      >
                        <IconEdit size={16} className="mr-2" /> Edit
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {canCreateLRForOrder ? (
                    <DropdownMenuItem onClick={() => onCreateLR(o)}>
                      <IconFileText size={16} className="mr-2" />
                      Create LR
                    </DropdownMenuItem>
                  ) : hasLRGroup ? (
                    <DropdownMenuItem disabled>
                      <IconFileText size={16} className="mr-2" />
                      LR already created
                    </DropdownMenuItem>
                  ) : null}
                  {canDownloadPdf ? (
                    <DropdownMenuItem onClick={() => onDownloadPdf(o)}>
                      <IconDownload size={16} className="mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                  ) : null}
                  {hasDangerActions ? (
                    <>
                      <DropdownMenuSeparator />
                      {canCancel && cancellable ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onCancel(o)}
                        >
                          <IconBan size={16} className="mr-2" /> Cancel
                        </DropdownMenuItem>
                      ) : null}
                      {canDelete && deletable ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(o)}
                        >
                          <IconTrash size={16} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      sort,
      onSortChange,
      canApprove,
      canReject,
      canCancel,
      canUpdate,
      canCreateLR,
      canDelete,
      canDownloadPdf,
      onApprove,
      onReject,
      onCancel,
      onCreateLR,
      onDelete,
      onDownloadPdf,
    ],
  );

  // Pinned columns keep their slots regardless of the user's order.
  const tableColumnOrder = React.useMemo(
    () => [...columnOrder, "status", "actions"],
    [columnOrder],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange,
    state: {
      columnPinning: { right: ["status", "actions"] },
      columnVisibility,
      columnOrder: tableColumnOrder,
    },
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="w-full space-y-3">
      <StatusTabs
        tabs={STATUS_ORDER}
        active={statusFilter}
        onChange={onStatusFilterChange}
        counts={counts}
        layoutId="orders-status-tab"
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search order no or customer..."
        />

        <ColumnPickerPopover
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          columnMeta={COLUMN_META}
          defaultOrder={DEFAULT_ORDER_COLUMN_ORDER}
        />
      </div>

      <Table className="bg-card">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const pinned = h.column.getIsPinned() === "right";
                return (
                  <TableHead
                    key={h.id}
                    style={pinStyle(h.column)}
                    className={cn(
                      "h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground",
                      pinned && `sticky z-10 ${PIN_HEAD_BG}`,
                      h.column.id === "status" && "border-l border-border",
                      h.column.id === "freight" && "text-right",
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, r) => (
              <TableRow key={r}>
                {table.getVisibleLeafColumns().map((col) => {
                  const pinned = col.getIsPinned() === "right";
                  return (
                    <TableCell
                      key={col.id}
                      style={pinStyle(col)}
                      className={cn(
                        "h-12",
                        pinned && `sticky z-10 ${PIN_CELL_BG}`,
                        col.id === "status" && "border-l border-border",
                      )}
                    >
                      <Skeleton
                        className={cn("h-4", SKELETON_WIDTHS[col.id] ?? "w-24")}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableEmptyState
              colSpan={visibleColumnCount}
              message="No orders found"
            />
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="group/row cursor-pointer"
                onClick={() => onQuickView(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const pinned = cell.column.getIsPinned() === "right";
                  return (
                    <TableCell
                      key={cell.id}
                      style={pinStyle(cell.column)}
                      className={cn(
                        "h-12 text-sm",
                        pinned &&
                          `sticky z-10 ${PIN_CELL_BG} transition-colors`,
                        cell.column.id === "status" &&
                          "border-l border-border",
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TablePaginationFooter
        total={total}
        page={page}
        size={size}
        onPageChange={onPageChange}
        onSizeChange={onSizeChange}
      />
    </div>
  );
}
