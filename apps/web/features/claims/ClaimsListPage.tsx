"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { IconChartBar, IconDownload, IconPlus, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { downloadBlob } from "@/features/masters/_shared/master-api";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { PERMS, type ClaimCause, type ClaimStatus, type ClaimType } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { SortHeader, TablePaginationFooter, TableSearchInput } from "@/components/data-table";

import { useAuth, useCan } from "@/features/auth";
import { branchApi } from "@/features/masters/branch/branch.service";
import { customerApi } from "@/features/masters/Customer/customer.service";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { claimApi, type ClaimFilters } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { NewClaimDialog } from "./NewClaimDialog";
import {
  CLAIM_CAUSE_LABELS,
  CLAIM_STATUS,
  CLAIM_TYPE_LABELS,
  ClaimStatusBadge,
  isEstimatedAmount,
} from "./claim.ui";

const COLUMN_COUNT = 12;
const ALL = "ALL";
const DEFAULT_SORT = "claimDate:desc";

/** Status strip: click a tile to filter the register to that status. */
function StatusSummary({
  filters,
  active,
  onToggle,
}: {
  filters: ClaimFilters;
  active: ClaimStatus | undefined;
  onToggle: (status: ClaimStatus) => void;
}) {
  const summary = useQuery({
    queryKey: claimKeys.summary(filters),
    queryFn: () => claimApi.summary(filters),
    placeholderData: keepPreviousData,
  });

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {(summary.data ?? []).map((row) => {
        const isActive = active === row.status;
        const amount =
          row.status === "SETTLED" ? row.settledAmountPaise : row.claimedAmountPaise;
        return (
          <button
            key={row.status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(row.status)}
            className={cn(
              "rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/40",
              isActive && "border-primary ring-2 ring-primary/15",
            )}
          >
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", CLAIM_STATUS[row.status].dot)} />
              {CLAIM_STATUS[row.status].label}
            </span>
            <span className="mt-1 block text-lg font-semibold tabular-nums">{row.count}</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {formatPaise(amount)} {row.status === "SETTLED" ? "settled" : "claimed"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Customer filter: server search, with the chosen customer kept as an option. */
function CustomerFilter({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null;
  onChange: (customer: { id: string; name: string } | null) => void;
}) {
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const results = useQuery({
    queryKey: ["claims", "customer-filter", debounced],
    queryFn: () => customerApi.search(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const options: ComboboxOption[] = [
    { value: ALL, label: "All customers" },
    ...(value ? [{ value: value.id, label: value.name }] : []),
    ...(results.data ?? [])
      .filter((customer) => customer.id !== value?.id)
      .map((customer) => ({ value: customer.id, label: customer.name })),
  ];

  return (
    <Combobox
      options={options}
      value={value?.id ?? ALL}
      onChange={(id) => {
        if (id === ALL) return onChange(null);
        const picked = options.find((option) => option.value === id);
        onChange(picked ? { id, name: picked.label } : null);
      }}
      placeholder="All customers"
      searchPlaceholder="Type 2+ letters of a customer"
      emptyText={debounced.trim().length >= 2 ? "No customer found" : "Type to search"}
      searchValue={search}
      onSearchChange={setSearch}
      className="min-h-9 w-56 rounded-md"
    />
  );
}

export function ClaimsListPage() {
  const { user } = useAuth();
  const canCreate = useCan(PERMS.CLAIM.CREATE);
  const [newOpen, setNewOpen] = React.useState(false);

  const [size, setSize] = React.useState(20);
  const [sort, setSort] = React.useState(DEFAULT_SORT);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ClaimStatus | undefined>();
  const [claimType, setClaimType] = React.useState<ClaimType | typeof ALL>(ALL);
  const [causedBy, setCausedBy] = React.useState<ClaimCause | typeof ALL>(ALL);
  const [branchId, setBranchId] = React.useState<string>(ALL);
  const [customer, setCustomer] = React.useState<{ id: string; name: string } | null>(null);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  // Branch options: only the branches this user can see (the server refuses others).
  const branches = useQuery({
    queryKey: ["claims", "branch-filter"],
    queryFn: () => branchApi.list({ page: 0, size: 200 }),
  });
  const visibleBranches = (branches.data?.data ?? []).filter(
    (branch) => user?.branchScope === "ALL" || user?.branchIds?.includes(branch.id),
  );

  const filters: ClaimFilters = {
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(claimType !== ALL ? { claimType } : {}),
    ...(causedBy !== ALL ? { causedBy } : {}),
    ...(branchId !== ALL ? { branchId } : {}),
    ...(customer ? { customerId: customer.id } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  // The page belongs to one set of filters: any filter change shows page 1 again.
  const filterKey = JSON.stringify({ filters, status, sort, size });
  const [pageState, setPageState] = React.useState({ filterKey, page: 0 });
  const page = pageState.filterKey === filterKey ? pageState.page : 0;
  const setPage = (next: number) => setPageState({ filterKey, page: next });

  const listParams = { ...filters, ...(status ? { status } : {}), page, size, sort };

  const list = useQuery({
    queryKey: claimKeys.list(listParams),
    queryFn: () => claimApi.list(listParams),
    placeholderData: keepPreviousData,
  });
  const claims = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;

  // Export exactly what the register shows: same filters, status and order.
  const [exporting, setExporting] = React.useState<"csv" | "xlsx" | null>(null);
  const exportAs = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      const blob = await claimApi.exportFile(
        { ...filters, ...(status ? { status } : {}), sort },
        format,
      );
      downloadBlob(blob, `damage-claims-${new Date().toISOString().slice(0, 10)}.${format}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const hasFilters = Object.keys(filters).length > 0 || status !== undefined;
  const clearFilters = () => {
    setSearch("");
    setStatus(undefined);
    setClaimType(ALL);
    setCausedBy(ALL);
    setBranchId(ALL);
    setCustomer(null);
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Damage Claims</h1>
          <p className="text-sm text-muted-foreground">
            Every damage or shortage on an LR: what the customer claimed, what we settled, and what
            we recovered from whoever caused it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/claims/reports">
              <IconChartBar size={15} /> Reports
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting !== null || total === 0}>
                <IconDownload size={15} /> {exporting ? "Exporting…" : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportAs("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("csv")}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate && (
            <Button onClick={() => setNewOpen(true)}>
              <IconPlus size={15} /> New claim
            </Button>
          )}
        </div>
      </div>
      <NewClaimDialog open={newOpen} onOpenChange={setNewOpen} />

      <StatusSummary
        filters={filters}
        active={status}
        onToggle={(next) => setStatus((current) => (current === next ? undefined : next))}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search claim no. or LR no."
          />
        </div>
        <Select value={claimType} onValueChange={(v) => setClaimType(v as ClaimType | typeof ALL)}>
          <SelectTrigger className="w-36" aria-label="Claim type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={causedBy} onValueChange={(v) => setCausedBy(v as ClaimCause | typeof ALL)}>
          <SelectTrigger className="w-40" aria-label="Caused by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any cause</SelectItem>
            {Object.entries(CLAIM_CAUSE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {visibleBranches.length > 1 && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-44" aria-label="Branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {visibleBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <CustomerFilter value={customer} onChange={setCustomer} />
        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="Claim date from"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-40"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="Claim date to"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <IconX size={14} /> Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader label="Claim No" field="claimNumber" sort={sort} onSortChange={setSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Date" field="claimDate" sort={sort} onSortChange={setSort} />
              </TableHead>
              <TableHead>LR No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Caused by</TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Claimed"
                  field="claimedAmountPaise"
                  sort={sort}
                  onSortChange={setSort}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Settled"
                  field="settledAmountPaise"
                  sort={sort}
                  onSortChange={setSort}
                />
              </TableHead>
              <TableHead className="text-right">Recovered</TableHead>
              <TableHead className="text-right">Net loss</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!list.isLoading && claims.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {hasFilters
                    ? "No claims match these filters."
                    : "No claims yet. A claim appears here when an LR acknowledgement or GRN records damage or shortage."}
                </TableCell>
              </TableRow>
            )}
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="whitespace-nowrap font-medium">
                  <Link href={`/claims/${claim.id}`} className="text-primary hover:underline">
                    {claim.claimNumber}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(claim.claimDate)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/lorry-receipts/${claim.lr.groupId}`}
                    className="text-primary hover:underline"
                  >
                    {claim.lr.lrNumber}
                  </Link>
                </TableCell>
                <TableCell>{claim.customer.name}</TableCell>
                <TableCell>{claim.branch.name}</TableCell>
                <TableCell>{CLAIM_TYPE_LABELS[claim.claimType]}</TableCell>
                <TableCell>{claim.causedBy ? CLAIM_CAUSE_LABELS[claim.causedBy] : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.claimedAmountPaise)}
                  {/* An unassessed GRN claim shows a pro-rata guess off the
                      LR invoice, not a figure the customer asked for. */}
                  {isEstimatedAmount(claim) ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      estimated
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.settledAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.recoveredAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.netLossPaise)}
                </TableCell>
                <TableCell>
                  <ClaimStatusBadge status={claim.status} />
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
          onSizeChange={setSize}
        />
      </div>
    </div>
  );
}
