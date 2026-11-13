"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PERMS } from "@skerp/types";
import { useCan } from "@/features/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { formatPaise } from "@/lib/money";
import { serviceBillApi } from "./api/service-bill.service";
import { SettlementReversalButton } from "./SettlementReversalButton";

export function LegacyServicePayments({
  id,
  openVoucher,
}: {
  id: string;
  openVoucher: (id: string) => void;
}) {
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search.trim(), 400);
  const [size, setSize] = React.useState(10);
  const key = JSON.stringify([debounced, size, id]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const setPage = (next: number) => setPaging({ key, page: next });
  const canReverse = useCan(PERMS.ACCOUNTS.PAYMENT.CANCEL);
  const query = useQuery({
    queryKey: ["service-bill", id, "legacy-payments", page, size, debounced],
    queryFn: ({ signal }) =>
      serviceBillApi.paymentPage(
        id,
        page,
        size,
        debounced || undefined,
        signal,
      ),
  });
  return (
    <div className="space-y-2">
      <h2 className="font-medium">Legacy direct settlements</h2>
      <Input
        aria-label="Search legacy settlements"
        placeholder="Search reference or funding account..."
        maxLength={200}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.isError && (
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry payment history
        </Button>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Payment</TableHead>
            <TableHead>Cash / TDS</TableHead>
            <TableHead>Status / actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading && (
            <TableRow>
              <TableCell colSpan={3}>Loading...</TableCell>
            </TableRow>
          )}
          {query.data?.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>No legacy direct settlements.</TableCell>
            </TableRow>
          )}
          {query.data?.data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {new Date(row.paymentDate).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
                <p>{row.referenceNumber}</p>
              </TableCell>
              <TableCell>
                {formatPaise(row.paidPaise)} / {formatPaise(row.tdsPaise)}
              </TableCell>
              <TableCell>
                {row.reversedAt ? (
                  <p>Reversed: {row.reversalReason}</p>
                ) : (
                  canReverse && (
                    <SettlementReversalButton
                      reverse={(reason) =>
                        serviceBillApi.reversePayment(id, row.id, reason)
                      }
                    />
                  )
                )}
                {row.journalEntry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openVoucher(row.journalEntry!.id)}
                  >
                    Voucher
                  </Button>
                )}
                {row.reversalJournalEntryId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openVoucher(row.reversalJournalEntryId!)}
                  >
                    Reversal
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {query.data && (
        <TablePaginationFooter
          page={page}
          size={size}
          total={query.data.meta?.total ?? 0}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setPage(0);
            setSize(next);
          }}
        />
      )}
    </div>
  );
}
