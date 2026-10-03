"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconFileInvoice, IconArrowBackUp } from "@tabler/icons-react";
import { PERMS, type PermissionKey } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import {
  LoadMoreFooter,
  SkeletonTableRows,
  formatDate,
  money,
} from "@/features/vendor-payment/vendor-payment.ui";
import { driverFinanceKeys, type DriverFinanceEntryStatus } from "./driver-finance.service";
import { EntryStatusBadge, PAYMENT_MODE_LABELS } from "./driver-finance.ui";
import { useDriverFinanceList } from "./useDriverFinanceList";

type RegisterRow = {
  id: string;
  number: string;
  driverName: string;
  amountPaise: string;
  paidAt: string;
  mode: keyof typeof PAYMENT_MODE_LABELS;
  fundingName: string;
  detail: string;
  status: DriverFinanceEntryStatus;
  journalEntryId: string | null;
};

type RegisterProps<K extends "salary-advances" | "payouts"> = {
  kind: K;
  title: string;
  emptyText: string;
  detailHeading: string;
  toRow: (row: ReturnType<typeof useDriverFinanceList<K>>["rows"][number]) => RegisterRow;
  reverse: (id: string, reason: string) => Promise<unknown>;
  reversePermission: PermissionKey;
  reverseHint: string;
};

export function DriverFinanceRegister<K extends "salary-advances" | "payouts">({
  kind,
  title,
  emptyText,
  detailHeading,
  toRow,
  reverse,
  reversePermission,
  reverseHint,
}: RegisterProps<K>) {
  const queryClient = useQueryClient();
  const canReverse = useCan(reversePermission);
  const canViewVoucher = useCan(PERMS.LEDGER.VOUCHER_VIEW);
  const { search, setSearch, isSearching, debouncedSearch, query, rows, total } =
    useDriverFinanceList(kind);

  const [reverseTarget, setReverseTarget] = React.useState<RegisterRow | null>(null);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: Boolean(voucherId),
  });

  const reverseMutation = useMutation({
    mutationFn: (reason: string) => reverse(reverseTarget!.id, reason),
    onSuccess: () => {
      toast.success(`${reverseTarget?.number} reversed`);
      setReverseTarget(null);
      queryClient.invalidateQueries({ queryKey: driverFinanceKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const view = rows.map(toRow);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isSearching ? `${total} matching “${debouncedSearch}”.` : `${total} in total.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by number or driver name..."
          aria-label={`Search ${title.toLowerCase()}`}
          className="sm:max-w-sm"
        />

        {query.isLoading ? (
          <Skeleton className="h-72" />
        ) : query.isError ? (
          <div className="py-10 text-center">
            <p className="font-medium">Could not load the list</p>
            <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : !view.length ? (
          <div className="py-10 text-center">
            <p className="font-medium">{isSearching ? "Nothing matches" : "Nothing yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSearching ? "No entry matches that number or driver." : emptyText}
            </p>
          </div>
        ) : (
          <div
            aria-busy={query.isPlaceholderData}
            className={query.isPlaceholderData ? "opacity-60" : undefined}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>{detailHeading}</TableHead>
                    <TableHead>Paid from</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.number}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.paidAt)}</TableCell>
                      <TableCell className="text-sm">{row.driverName}</TableCell>
                      <TableCell className="max-w-56 truncate text-sm" title={row.detail}>
                        {row.detail}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.fundingName} · {PAYMENT_MODE_LABELS[row.mode]}
                      </TableCell>
                      <TableCell>
                        <EntryStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.amountPaise)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {canViewVoucher && row.journalEntryId ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`View voucher for ${row.number}`}
                              title="View voucher"
                              onClick={() => setVoucherId(row.journalEntryId)}
                            >
                              <IconFileInvoice size={16} />
                            </Button>
                          ) : null}
                          {canReverse && row.status === "POSTED" ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Reverse ${row.number}`}
                              title="Reverse"
                              onClick={() => setReverseTarget(row)}
                            >
                              <IconArrowBackUp size={16} />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {query.isFetchingNextPage ? <SkeletonTableRows columns={8} /> : null}
                </TableBody>
              </Table>
            </div>
            <LoadMoreFooter
              shown={view.length}
              total={total}
              hasNextPage={Boolean(query.hasNextPage)}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={() => query.fetchNextPage()}
            />
          </div>
        )}
      </CardContent>

      <ReasonDialog
        open={Boolean(reverseTarget)}
        onOpenChange={(open) => !open && setReverseTarget(null)}
        title={`Reverse ${reverseTarget?.number ?? ""}?`}
        description={reverseHint}
        confirmLabel="Reverse"
        destructive
        isPending={reverseMutation.isPending}
        onConfirm={(reason) => reverseMutation.mutate(reason)}
      />
      <VoucherDialog
        open={Boolean(voucherId)}
        onOpenChange={(open) => !open && setVoucherId(null)}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
      />
    </Card>
  );
}
