"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconFileInvoice, IconEye } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { Checkbox } from "@skerp/ui/components/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { serviceBillApi } from "./api/service-bill.service";
import { serviceBillKeys } from "./api/service-bill.keys";
import { ServiceBillStatusBadge } from "./serviceBillStatusBadge";

const today = () => new Date().toISOString().slice(0, 10);


export function ServiceBillListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.SERVICEBILL_MANAGE);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [branchId, setBranchId] = React.useState("");
  const [serviceProviderId, setServiceProviderId] = React.useState("");
  const [uptoDate, setUptoDate] = React.useState(today());
  const [billDate, setBillDate] = React.useState(today());
  const [providerInvoiceNo, setProviderInvoiceNo] = React.useState("");
  const [providerInvoiceDate, setProviderInvoiceDate] = React.useState("");
  const [discount, setDiscount] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [selectedLineIds, setSelectedLineIds] = React.useState<Set<string>>(new Set());
  const [providerSearch, setProviderSearch] = React.useState("");
  const debouncedProviderSearch = useDebouncedValue(providerSearch, 300);

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const listQuery = React.useMemo(() => ({ page, size }), [page, size]);

  const list = useQuery({
    queryKey: serviceBillKeys.list(listQuery),
    queryFn: () => serviceBillApi.list(listQuery),
  });
  // Single-workshop-at-HO: this is always the same one branch, so cache it
  // indefinitely instead of refetching on every screen open.
  const headOfficeBranch = useQuery({
    queryKey: serviceBillKeys.branches,
    queryFn: serviceBillApi.headOfficeBranch,
    staleTime: Infinity,
  });
  React.useEffect(() => {
    if (headOfficeBranch.data && !branchId) setBranchId(headOfficeBranch.data.id);
  }, [headOfficeBranch.data, branchId]);
  const providers = useQuery({
    queryKey: serviceBillKeys.serviceProviders(debouncedProviderSearch),
    queryFn: () => serviceBillApi.serviceProviders(debouncedProviderSearch),
    enabled: createOpen,
  });
  const unbilled = useQuery({
    queryKey: serviceBillKeys.unbilledLines(serviceProviderId, uptoDate),
    queryFn: () => serviceBillApi.unbilledLines(serviceProviderId, uptoDate),
    enabled: Boolean(serviceProviderId),
  });
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: voucherOpen && Boolean(voucherId),
  });

  const resetForm = () => {
    setBranchId("");
    setServiceProviderId("");
    setProviderSearch("");
    setUptoDate(today());
    setBillDate(today());
    setProviderInvoiceNo("");
    setProviderInvoiceDate("");
    setDiscount("");
    setRemarks("");
    setSelectedLineIds(new Set());
  };

  const toggleLine = (id: string) =>
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const grossPaise = (unbilled.data ?? [])
    .filter((l) => selectedLineIds.has(l.id))
    .reduce((sum, l) => sum + Number(l.amountPaise), 0);
  const discountPaise = rupeesToPaise(Number(discount) || 0);
  const netPaise = grossPaise - discountPaise;

  const canSubmit =
    Boolean(branchId) && Boolean(serviceProviderId) && Boolean(billDate) &&
    Boolean(providerInvoiceNo.trim()) && selectedLineIds.size > 0 && discountPaise <= grossPaise;

  const create = useMutation({
    mutationFn: () =>
      serviceBillApi.create({
        branchId,
        serviceProviderId,
        billDate,
        providerInvoiceNo: providerInvoiceNo.trim(),
        providerInvoiceDate: providerInvoiceDate || undefined,
        discountPaise: discountPaise || undefined,
        remarks: remarks.trim() || undefined,
        jobCardServiceLineIds: Array.from(selectedLineIds),
      }),
    onSuccess: (bill) => {
      toast.success(`Service Bill posted — ${bill.serviceBillNumber}`);
      queryClient.invalidateQueries({ queryKey: serviceBillKeys.all });
      setCreateOpen(false);
      resetForm();
      if (bill.journalEntry) {
        setVoucherId(bill.journalEntry.id);
        setVoucherOpen(true);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not post bill"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Service Bills</h1>
          <p className="text-sm text-muted-foreground">
            Bills a provider&apos;s completed, not-yet-billed Job Card services in one batch —
            the only place their cost posts to accounts.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus size={15} className="mr-1" /> New Service Bill
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No service bills yet.
                </TableCell>
              </TableRow>
            )}
            {list.data?.data.map((bill) => {
              const pending = Number(bill.netAmountPaise) - Number(bill.paidAmountPaise);
              return (
                <TableRow
                  key={bill.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/workshop/service-bills/${bill.id}`)}
                >
                  <TableCell className="font-medium">{bill.serviceBillNumber ?? "—"}</TableCell>
                  <TableCell>{bill.serviceProvider.name}</TableCell>
                  <TableCell>{new Date(bill.billDate).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>
                    <ServiceBillStatusBadge status={bill.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(bill.netAmountPaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(bill.paidAmountPaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPaise(pending)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {bill.journalEntry && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVoucherId(bill.journalEntry!.id);
                            setVoucherOpen(true);
                          }}
                        >
                          <IconFileInvoice size={15} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/workshop/service-bills/${bill.id}`);
                        }}
                      >
                        <IconEye size={15} className="mr-1" /> View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePaginationFooter
          total={list.data?.meta?.total ?? 0}
          page={page}
          size={size}
          onPageChange={setPage}
          onSizeChange={(next) => { setSize(next); setPage(0); }}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="w-[95vw] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Service Bill</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Branch</label>
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                {headOfficeBranch.data?.name ?? "—"}{" "}
                <span className="ml-1 text-xs">(single workshop — fixed)</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Service Provider</label>
              <Combobox
                options={providers.data ?? []}
                value={serviceProviderId}
                onChange={(v) => { setServiceProviderId(v); setSelectedLineIds(new Set()); }}
                searchValue={providerSearch}
                onSearchChange={setProviderSearch}
                placeholder="Search provider..."
                searchPlaceholder="Type to search..."
                emptyText={providers.isLoading ? "Loading providers..." : "No providers found"}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Up to date</label>
              <Input type="date" value={uptoDate} onChange={(e) => setUptoDate(e.target.value)} />
            </div>
          </div>

          {serviceProviderId && (
            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
                Completed, unbilled services {unbilled.isLoading && <span className="text-muted-foreground">(loading...)</span>}
              </div>
              <div className="max-h-64 divide-y overflow-y-auto">
                {unbilled.data?.map((line) => (
                  <label key={line.id} className="flex items-center gap-3 p-2.5 text-sm hover:bg-muted/30">
                    <Checkbox
                      checked={selectedLineIds.has(line.id)}
                      onCheckedChange={() => toggleLine(line.id)}
                    />
                    <span className="flex-1">
                      {line.jobCard.jobCardNumber} — {line.sparePart.name}
                      {line.description && <span className="text-muted-foreground"> ({line.description})</span>}
                    </span>
                    <span className="tabular-nums">{formatPaise(line.amountPaise)}</span>
                  </label>
                ))}
                {unbilled.data?.length === 0 && !unbilled.isLoading && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No unbilled services for this provider up to this date.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bill date</label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Provider&apos;s bill no.</label>
              <Input value={providerInvoiceNo} onChange={(e) => setProviderInvoiceNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Discount (₹) <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-sm font-medium">
                Remarks <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="resize-none" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-6 rounded-md border bg-muted/20 px-4 py-2.5 text-sm">
            <span>
              Gross <span className="font-semibold tabular-nums">{formatPaise(grossPaise)}</span>
            </span>
            <span>
              Net <span className="font-semibold tabular-nums">{formatPaise(netPaise)}</span>
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Posting..." : "Post Service Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
      />
    </div>
  );
}
