"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";
import { Card } from "@skerp/ui/components/Card";
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
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { cn } from "@/lib/utils";
import { formatDate, money } from "@/features/vendor-payment/vendor-payment.ui";
import { ledgerApi, type OpeningBalanceRow } from "./api/ledger.service";

/** The day driver payments started in the ERP — the usual opening date. */
const DEFAULT_AS_OF = "2026-10-01";

/** Signed rupees typed by the user (e.g. "-2500.50") → paise string. */
const toPaise = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n * 100)) : "";
};

function SignedMoney({ paise }: { paise: string }) {
  const v = BigInt(paise);
  return (
    <span className={cn("tabular-nums", v < 0n && "text-destructive")}>
      {v < 0n ? `−${money(-v)}` : money(v)}
    </span>
  );
}

function OpeningRow({ row, canEdit }: { row: OpeningBalanceRow; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [asOf, setAsOf] = React.useState(row.opening?.asOf.slice(0, 10) ?? DEFAULT_AS_OF);
  const [amount, setAmount] = React.useState(
    row.opening ? String(Number(row.opening.amountPaise) / 100) : "",
  );

  const amountPaise = amount.trim() ? toPaise(amount) : "";
  const changed =
    amountPaise !== "" &&
    (!row.opening ||
      amountPaise !== row.opening.amountPaise ||
      asOf !== row.opening.asOf.slice(0, 10));

  const save = useMutation({
    mutationFn: () => ledgerApi.setOpeningBalance(row.id, { asOf, amountPaise }),
    onSuccess: () => {
      toast.success(`${row.name}: opening balance saved`);
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["driver-finance"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.type === "BANK"
            ? [row.bankName, row.accountLast4 ? `••${row.accountLast4}` : null]
                .filter(Boolean)
                .join(" ") || "Bank"
            : "Cash"}
        </p>
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Input
            type="date"
            aria-label={`Opening date for ${row.name}`}
            className="h-9 w-40"
            value={asOf}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setAsOf(e.target.value)}
          />
        ) : row.opening ? (
          formatDate(row.opening.asOf)
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <Input
            inputMode="decimal"
            aria-label={`Opening balance for ${row.name}`}
            placeholder="Real balance, e.g. 40000"
            className="ml-auto h-9 w-44 text-right"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        ) : row.opening ? (
          <SignedMoney paise={row.opening.amountPaise} />
        ) : (
          <span className="text-muted-foreground">Not set</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <SignedMoney paise={row.balancePaise} />
        {!row.opening ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">No opening balance yet</p>
        ) : null}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.opening
          ? `${formatDate(row.opening.updatedAt)}${
              row.opening.updatedBy
                ? ` · ${row.opening.updatedBy.firstName} ${row.opening.updatedBy.lastName}`
                : ""
            }`
          : "—"}
      </TableCell>
      {canEdit ? (
        <TableCell className="text-right">
          <Button
            size="sm"
            variant={changed ? "default" : "outline"}
            disabled={!changed || !asOf || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : row.opening ? "Update" : "Save"}
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

/**
 * Finance → Opening Balances. The ERP only knows money it recorded; this is
 * where the real cash / bank balance at the start is typed once per account,
 * so "available balance" checks on payments are right.
 */
export function OpeningBalancesPage() {
  const canEdit = useCan(PERMS.LEDGER.MANAGE);
  const query = useQuery({
    queryKey: ["ledger", "opening-balances"],
    queryFn: () => ledgerApi.openingBalances(),
  });
  const rows = query.data ?? [];
  const missing = rows.filter((r) => !r.opening).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opening balances</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Type the <strong>real</strong> balance of each cash box and bank account on the start
          date — cash counted, bank as per the statement. The ERP posts the difference so its own
          balance matches from that day, and payments are checked against it. A negative amount
          means an overdrawn bank. You can correct it later; the old entry is reversed.
        </p>
      </div>

      {missing > 0 && !query.isLoading ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {missing} account{missing === 1 ? "" : "s"} still {missing === 1 ? "has" : "have"} no
          opening balance — the ERP shows {missing === 1 ? "its" : "their"} balance from ₹0, so it
          is lower than the real money.
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Account</TableHead>
                  <TableHead>As on</TableHead>
                  <TableHead className="text-right">Opening balance (real)</TableHead>
                  <TableHead className="text-right">Balance in ERP now</TableHead>
                  <TableHead>Last set</TableHead>
                  {canEdit ? <TableHead className="w-24" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <OpeningRow key={row.id} row={row} canEdit={canEdit} />
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No active cash or bank accounts.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
