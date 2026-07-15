"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ColumnDef,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { LRGroupListItem } from "@skerp/types";
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
  IconAlertTriangle,
  IconBan,
  IconBuilding,
  IconBuildingStore,
  IconCalendar,
  IconChevronRight,
  IconCurrencyRupee,
  IconDotsVertical,
  IconEye,
  IconFileDescription,
  IconFlag,
  IconHash,
  IconMapPin,
  IconTag,
  IconTruck,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
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
import {
  LRStatusBadge,
  SOURCE_LABELS,
  LR_STATUS_ORDER,
  lrGroupDisplay,
  RouteInline,
} from "../lorry-receipt-ui";

type Props = {
  data: LRGroupListItem[];
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
  canCancel: boolean;
  onCancel: (group: LRGroupListItem) => void;
  onRowClick: (group: LRGroupListItem) => void;
};

/**
 * The reorderable columns, in default order. Expand stays pinned first,
 * Status/Actions stay pinned right — outside the user's control.
 */
export const DEFAULT_LR_COLUMN_ORDER = [
  "group",
  "consignor",
  "consignee",
  "origin",
  "destination",
  "vehicle",
  "lrs",
  "freight",
  "source",
  "date",
] as const;

const COLUMN_META: ColumnMeta = {
  group: { label: "LR / Group #", icon: IconHash },
  consignor: { label: "Consignor", icon: IconBuilding },
  consignee: { label: "Consignee", icon: IconBuildingStore },
  origin: { label: "Origin", icon: IconMapPin },
  destination: { label: "Destination", icon: IconFlag },
  vehicle: { label: "Vehicle", icon: IconTruck },
  lrs: { label: "LRs", icon: IconFileDescription },
  freight: { label: "Freight", icon: IconCurrencyRupee },
  source: { label: "Source", icon: IconTag },
  date: { label: "Date", icon: IconCalendar },
};

const SKELETON_WIDTHS: Record<string, string> = {
  expand: "w-4",
  group: "w-28",
  consignor: "w-28",
  consignee: "w-28",
  origin: "w-20",
  destination: "w-20",
  vehicle: "w-24",
  lrs: "w-10",
  freight: "ml-auto w-16",
  source: "w-16",
  date: "w-20",
  status: "w-20",
  actions: "ml-auto w-8",
};

/** Nested per-LR breakdown shown when a group row is expanded. */
function LRChildRows({ group }: { group: LRGroupListItem }) {
  const childRows = group.lorryReceipts ?? [];
  return (
    <div className="px-4 py-3">
      <Table className="min-w-[720px] bg-background">
        <TableHeader>
          <TableRow>
            {["LR #", "Route", "Goods", "Invoice", "E-way bill", "Status"].map(
              (label) => (
                <TableHead
                  key={label}
                  className="h-9 text-xs font-semibold uppercase text-muted-foreground"
                >
                  {label}
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {childRows.map((lr) => (
            <TableRow key={lr.id}>
              <TableCell className="font-mono font-medium text-primary">
                <Link
                  href={`/lorry-receipts/${encodeURIComponent(lr.lrNumber)}`}
                  className="hover:underline"
                >
                  {lr.lrNumber}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <RouteInline
                    from={lr.loadingLocation?.name}
                    to={lr.unloadingLocation?.name}
                    className="max-w-64 text-sm"
                  />
                  {(!lr.loadingLocation || !lr.unloadingLocation) && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <IconAlertTriangle size={13} />
                      Location pending
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {(lr.goods?.length ?? 0) > 0 ? (
                  <span className="inline-flex min-w-6 justify-center rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
                    {lr.goods?.length}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <IconAlertTriangle size={13} />
                    Goods not added
                  </span>
                )}
              </TableCell>
              <TableCell>
                {lr.invoiceNumber ? (
                  <div>
                    <p className="font-mono text-sm">{lr.invoiceNumber}</p>
                    {lr.invoiceAmount != null ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatPaise(lr.invoiceAmount)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {lr.ewayBill ? (
                  <div>
                    <p className="font-mono text-sm">
                      {lr.ewayBill.ewayBillNo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(lr.ewayBill.expiresAt)}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <LRStatusBadge status={lr.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function LRTable(props: Props) {
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
    canCancel,
    onCancel,
    onRowClick,
  } = props;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const columns = React.useMemo<ColumnDef<LRGroupListItem>[]>(
    () => [
      {
        id: "expand",
        header: "",
        size: 36,
        enableHiding: false,
        cell: ({ row }) => {
          const lrs = row.original.lorryReceipts ?? [];
          // A single LR has nothing extra to reveal — its identity IS the row.
          // Only true truckloads (2+ LRs) get the expand affordance.
          if (lrs.length < 2) return null;
          const isExpanded = Boolean(expanded[row.original.id]);
          return (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={isExpanded ? "Collapse LRs" : "Expand LRs"}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((current) => ({
                  ...current,
                  [row.original.id]: !current[row.original.id],
                }));
              }}
            >
              <IconChevronRight
                size={16}
                className={cn(
                  "transition-transform duration-200",
                  isExpanded && "rotate-90",
                )}
              />
            </Button>
          );
        },
      },
      {
        id: "group",
        header: "LR / Group #",
        cell: ({ row }) => {
          const d = lrGroupDisplay(row.original);
          // Truckloads preview their LR sequence numbers so a specific LR can
          // be spotted without expanding the row.
          const lrPreview =
            d.lrCount === 0
              ? "No LRs yet"
              : `LRs ${d.lrNumbers
                  .slice(0, 3)
                  .map((n) => n.slice(n.lastIndexOf("/") + 1))
                  .join(" · ")}${d.lrCount > 3 ? ` +${d.lrCount - 3}` : ""}`;
          return (
            <Link
              href={`/lorry-receipts/${encodeURIComponent(d.title)}`}
              className="block"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-1.5">
                {d.isSingleton ? (
                  <IconFileDescription
                    size={14}
                    className="shrink-0 text-muted-foreground"
                  />
                ) : (
                  <IconTruck size={14} className="shrink-0 text-primary" />
                )}
                <span className="font-medium text-primary hover:underline">
                  {d.title}
                </span>
                {!d.isSingleton && (
                  <span className="inline-flex shrink-0 items-center rounded-sm border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    {d.lrCount > 0 ? `${d.lrCount} LRs` : "Empty"}
                  </span>
                )}
              </span>
              <span className="block pl-[22px] font-mono text-xs text-muted-foreground">
                {d.isSingleton ? d.subtitle : lrPreview}
              </span>
            </Link>
          );
        },
      },
      {
        id: "consignor",
        header: "Consignor",
        cell: ({ row }) => {
          const c = row.original.consignor;
          if (!c) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="min-w-0 max-w-44">
              <span className="block truncate font-medium">{c.name}</span>
              {c.shortName ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {c.shortName}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "consignee",
        header: "Consignee",
        cell: ({ row }) => {
          const c = row.original.consignee;
          if (!c) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="min-w-0 max-w-44">
              <span className="block truncate font-medium">{c.name}</span>
              {c.shortName ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {c.shortName}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "origin",
        header: "Origin",
        cell: ({ row }) => {
          const name = row.original.originBranch?.name;
          if (!name) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground" />
              {name}
            </span>
          );
        },
      },
      {
        id: "destination",
        header: "Destination",
        cell: ({ row }) => {
          const name = row.original.destinationBranch?.name;
          if (!name) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              {name}
            </span>
          );
        },
      },
      {
        id: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => {
          const g = row.original;
          const number = g.isMarketVehicle
            ? g.marketVehicleNumber
            : g.primaryTrip?.vehicle?.vehicleNumber;
          const driver = g.isMarketVehicle
            ? g.marketDriverName
            : g.primaryTrip?.driver?.name;
          if (!number) return <span className="text-muted-foreground">—</span>;
          return (
            <div>
              <span className="inline-flex items-center rounded-sm border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-medium uppercase">
                {number}
              </span>
              {driver ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {driver}
                  {g.isMarketVehicle ? " · Market" : ""}
                </span>
              ) : g.isMarketVehicle ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Market
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "lrs",
        header: "LRs",
        cell: ({ row }) => {
          const hasIncompleteLr = (row.original.lorryReceipts ?? []).some(
            (lr) =>
              !lr.loadingLocation ||
              !lr.unloadingLocation ||
              (lr.goods?.length ?? 0) === 0,
          );
          return (
            <div className="flex flex-col items-start gap-1">
              <span className="inline-flex min-w-6 justify-center rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
                {row.original.lrCount ?? "—"}
              </span>
              {hasIncompleteLr ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                  <IconAlertTriangle size={12} /> Details pending
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "freight",
        header: () => (
          <SortHeader
            label="Freight"
            field="baseFreightAmount"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {row.original.baseFreightAmount != null ? (
              formatPaise(row.original.baseFreightAmount)
            ) : (
              <span className="font-normal text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {row.original.source === "FROM_ORDER" ? (
              <IconFileDescription size={12} />
            ) : (
              <IconTag size={12} />
            )}
            {SOURCE_LABELS[row.original.source]}
          </span>
        ),
      },
      {
        id: "date",
        header: () => (
          <SortHeader
            label="Date"
            field="createdAt"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <IconCalendar size={13} className="shrink-0 text-muted-foreground" />
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 128,
        enableHiding: false,
        cell: ({ row }) => (
          <LRStatusBadge
            status={lrGroupDisplay(row.original).status ?? row.original.status}
          />
        ),
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        size: 72,
        enableHiding: false,
        cell: ({ row }) => {
          const g = row.original;
          const d = lrGroupDisplay(g);
          const cancellable = canCancel && g.status === "DRAFT";
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
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/lorry-receipts/${encodeURIComponent(d.title)}`}
                    >
                      <IconEye size={16} className="mr-2" />{" "}
                      {d.isSingleton ? "View LR" : "View group"}
                    </Link>
                  </DropdownMenuItem>
                  {cancellable ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onCancel(g)}
                      >
                        <IconBan size={16} className="mr-2" /> Cancel
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [expanded, sort, onSortChange, canCancel, onCancel],
  );

  // Pinned columns keep their slots regardless of the user's order.
  const tableColumnOrder = React.useMemo(
    () => ["expand", ...columnOrder, "status", "actions"],
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
        tabs={LR_STATUS_ORDER}
        active={statusFilter}
        onChange={onStatusFilterChange}
        counts={counts}
        layoutId="lr-status-tab"
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search LR, group, invoice or vehicle..."
        />

        <ColumnPickerPopover
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          columnMeta={COLUMN_META}
          defaultOrder={DEFAULT_LR_COLUMN_ORDER}
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
              message="No lorry receipts found"
            />
          ) : (
            table.getRowModel().rows.map((row) => {
              const g = row.original;
              const isExpanded = Boolean(expanded[g.id]);
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    className="group/row cursor-pointer"
                    onClick={() => onRowClick(g)}
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
                  {isExpanded ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={visibleColumnCount} className="p-0">
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <LRChildRows group={g} />
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      <TablePaginationFooter
        total={total}
        page={page}
        size={size}
        onPageChange={onPageChange}
        onSizeChange={onSizeChange}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  );
}
