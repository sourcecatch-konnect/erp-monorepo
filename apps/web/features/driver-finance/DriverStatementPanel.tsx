"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";

import { useCan } from "@/features/auth";
import { LedgerTable } from "@/features/ledger/components/LedgerTable";
import { CompactMoney } from "@/features/ledger/components/CompactMoney";
import { formatDate, money } from "@/features/vendor-payment/vendor-payment.ui";
import {
  driverFinanceApi,
  driverFinanceKeys,
  type DriverStatement,
  type DriverStatementKind,
} from "./driver-finance.service";
import { describeDriverBalance } from "./driver-finance.ui";
import { NewSalaryAdvanceDialog } from "./NewSalaryAdvanceDialog";
import { PayDriverDialog, type PayDriverTarget } from "./PayDriverDialog";

const KIND_BADGE: Record<DriverStatementKind, string> = {
  LOG_SLIP: "bg-blue-50 text-blue-700",
  SALARY_ADVANCE: "bg-amber-50 text-amber-700",
  PAYMENT: "bg-red-50 text-red-700",
  SALARY: "bg-emerald-50 text-emerald-700",
  REVERSAL: "bg-muted text-muted-foreground",
  OTHER: "bg-muted text-muted-foreground",
};

const KIND_LABEL: Record<DriverStatementKind, string> = {
  LOG_SLIP: "Log slip",
  SALARY_ADVANCE: "Salary advance",
  PAYMENT: "Payment",
  SALARY: "Salary",
  REVERSAL: "Reversal",
  OTHER: "Journal",
};

const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const rupeeCell = (paise: number) => (paise / 100).toFixed(2);
const drCr = (paise: number) => (paise >= 0 ? "Dr" : "Cr");

/** Same rows as the screen, opened cleanly by Excel (plain numbers, no ₹). */
function downloadStatementCsv(data: DriverStatement, from?: string, to?: string) {
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN");
  const rows: string[][] = [
    ["Driver statement", data.driver.name],
    ["Licence", data.driver.licenseNo ?? ""],
    ["Period", `${from ? day(from) : day(data.startDate)} to ${to ? day(to) : "today"}`],
    ["Dr = driver owes us, Cr = we owe the driver"],
    [],
    ["Date", "Type", "Particulars", "Voucher no.", "Debit", "Credit", "Balance", "Dr/Cr"],
    ["", "", "Opening balance", "", "", "", rupeeCell(Math.abs(data.openingBalancePaise)), drCr(data.openingBalancePaise)],
    ...data.lines.map((l) => [
      day(l.date),
      KIND_LABEL[l.kind],
      l.particulars,
      l.voucherNumber ?? "",
      l.debitPaise ? rupeeCell(l.debitPaise) : "",
      l.creditPaise ? rupeeCell(l.creditPaise) : "",
      rupeeCell(Math.abs(l.runningBalancePaise)),
      drCr(l.runningBalancePaise),
    ]),
    [
      "",
      "",
      "Closing balance",
      "",
      rupeeCell(data.totals.debitPaise),
      rupeeCell(data.totals.creditPaise),
      rupeeCell(Math.abs(data.closingBalancePaise)),
      drCr(data.closingBalancePaise),
    ],
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `driver-statement-${data.driver.name.replace(/[^A-Za-z0-9]+/g, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Licence status line: expired (red), within 30 days (amber), or plain. */
function LicenceStatus({ licenseNo, expiry }: { licenseNo: string | null; expiry: string | null }) {
  if (!expiry) return <span>Licence {licenseNo ?? "—"} · no expiry date recorded</span>;
  const day = expiry.slice(0, 10);
  const daysLeft = Math.floor((Date.parse(day) - Date.parse(todayIso())) / 86_400_000);
  if (daysLeft < 0)
    return (
      <span className="inline-flex items-center gap-1 font-medium text-destructive">
        <IconAlertTriangle size={14} /> Licence {licenseNo ?? ""} expired on {formatDate(day)} — cannot be
        put on a trip
      </span>
    );
  if (daysLeft <= 30)
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
        <IconAlertTriangle size={14} /> Licence {licenseNo ?? ""} expires on {formatDate(day)} ({daysLeft}{" "}
        day{daysLeft === 1 ? "" : "s"} left)
      </span>
    );
  return (
    <span>
      Licence {licenseNo ?? "—"} · valid till {formatDate(day)}
    </span>
  );
}

/**
 * Ledgers → Driver tab: one driver's statement (log slips, salary advances,
 * payments, salary) with a running balance, plus Pay / Salary advance.
 */
export function DriverStatementPanel({
  driverId,
  from,
  to,
}: {
  driverId: string;
  from?: string;
  to?: string;
}) {
  const canPay = useCan(PERMS.DRIVER_FINANCE.PAY);
  const canAdvance = useCan(PERMS.DRIVER_FINANCE.ADVANCE_MANAGE);
  const [payOpen, setPayOpen] = React.useState(false);
  const [advanceOpen, setAdvanceOpen] = React.useState(false);

  const range = { from: from || undefined, to: to || undefined };
  const statement = useQuery({
    queryKey: driverFinanceKeys.statement(driverId, range),
    queryFn: () => driverFinanceApi.statement(driverId, range),
  });
  const data = statement.data;

  // What can be paid by hand right now — the real current balance (not the
  // filtered period), less approved salary, which is paid from its run.
  const current = useQuery({
    queryKey: driverFinanceKeys.balance(driverId),
    queryFn: () => driverFinanceApi.balance(driverId),
    enabled: canPay,
  });
  const payableNowPaise = (() => {
    if (!current.data) return 0n;
    const owed = describeDriverBalance(current.data.balancePaise).owedPaise;
    const salaryDue = BigInt(current.data.salaryDue.amountPaise);
    return owed > salaryDue ? owed - salaryDue : 0n;
  })();

  const payTarget = React.useMemo<PayDriverTarget>(
    () => ({ kind: "MANUAL", driverId, driverName: data?.driver.name }),
    [driverId, data?.driver.name],
  );

  const closing = data?.closingBalancePaise ?? 0;
  const balance = describeDriverBalance(BigInt(closing));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="space-y-1 text-sm">
          <p className="text-base font-semibold">{data?.driver.name ?? "…"}</p>
          {data ? (
            <p className="text-muted-foreground">
              <LicenceStatus licenseNo={data.driver.licenseNo} expiry={data.driver.licenseExpiryDate} />
            </p>
          ) : null}
          {data ? (
            <p>
              <span
                className={
                  balance.tone === "owed"
                    ? "font-semibold text-emerald-700 dark:text-emerald-400"
                    : balance.tone === "owes"
                      ? "font-semibold text-amber-700 dark:text-amber-400"
                      : "font-semibold"
                }
              >
                {balance.text}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · since {formatDate(data.startDate)}
                {to ? `, up to ${formatDate(to)}` : ""}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!data}
            onClick={() => data && downloadStatementCsv(data, from, to)}
          >
            Export CSV
          </Button>
          {canAdvance ? (
            <Button variant="outline" onClick={() => setAdvanceOpen(true)}>
              Salary advance
            </Button>
          ) : null}
          {canPay ? (
            <Button
              onClick={() => setPayOpen(true)}
              disabled={payableNowPaise === 0n}
              title={
                payableNowPaise === 0n
                  ? current.data && BigInt(current.data.salaryDue.amountPaise) > 0n
                    ? "Nothing to pay by hand — approved salary is paid with Pay salaries on the salary run"
                    : "Nothing is owed to this driver right now"
                  : undefined
              }
            >
              {payableNowPaise > 0n ? `Pay ${money(payableNowPaise)}` : "Pay driver"}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        Log slips, salary advances, payments and salary in date order. Dr = the driver owes us, Cr = we
        owe the driver. Entries before {data ? formatDate(data.startDate) : "the go-live date"} were
        settled outside the ERP and are not shown. Reversed entries (and their reversals) cancel out
        and are left out — Driver Payments and Salary Advances still list them.
      </p>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <LedgerTable
          variant="statement"
          entries={[]}
          openingBalance={0}
          balanceConvention="asset"
          statementBalanceConvention="asset"
          statementKindBadge={KIND_BADGE}
          statementKindLabel={KIND_LABEL}
          statementRows={data?.lines ?? []}
          statementOpeningPaise={data?.openingBalancePaise ?? 0}
          isLoading={statement.isLoading}
          emptyLabel="No entries in this range"
          maxHeight={480}
        />
        <div className="grid grid-cols-3 gap-px border-t bg-border text-sm">
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total debit (driver owes)</p>
            <CompactMoney className="text-base font-semibold" value={data?.totals.debitPaise ?? 0} />
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total credit (we owe)</p>
            <CompactMoney className="text-base font-semibold" value={data?.totals.creditPaise ?? 0} />
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Closing balance</p>
            <span className="inline-flex items-baseline gap-1">
              <CompactMoney className="text-base font-semibold" value={Math.abs(closing)} />
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {closing >= 0 ? "Dr" : "Cr"}
              </span>
            </span>
          </div>
        </div>
      </div>

      <PayDriverDialog open={payOpen} onOpenChange={setPayOpen} target={payTarget} />
      <NewSalaryAdvanceDialog open={advanceOpen} onOpenChange={setAdvanceOpen} driverId={driverId} />
    </div>
  );
}
