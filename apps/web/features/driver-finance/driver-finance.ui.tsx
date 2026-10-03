"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

import { cn } from "@/lib/utils";
import { branchApi } from "@/features/masters/branch/branch.service";
import { money } from "@/features/vendor-payment/vendor-payment.ui";
import {
  driverFinanceApi,
  type DriverFinanceEntryStatus,
  type DriverSalaryRunStatus,
  type FundingAccount,
  type PaymentMode,
} from "./driver-finance.service";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
};

/**
 * Plain words for a signed driver balance (positive = driver owes us).
 * Returns the amount we owe as a positive bigint for callers that cap a
 * payment at it.
 */
export function describeDriverBalance(balancePaise: string | bigint) {
  const balance = BigInt(balancePaise);
  if (balance < 0n)
    return { text: `We owe ${money(-balance)}`, owedPaise: -balance, tone: "owed" as const };
  if (balance > 0n)
    return { text: `Driver owes ${money(balance)}`, owedPaise: 0n, tone: "owes" as const };
  return { text: "Settled — nothing due", owedPaise: 0n, tone: "settled" as const };
}

/** Cash goes out of a cash account; bank transfer / UPI / cheque out of a bank
 *  account. The server enforces the same rule. */
export const fundingGroupFor = (mode: PaymentMode) => (mode === "CASH" ? "CASH" : "BANK");

/** Cash / bank accounts with their balance — shared by every pay screen. */
export function useFundingAccounts() {
  const query = useQuery({
    queryKey: ["driver-finance", "funding-accounts"],
    queryFn: () => driverFinanceApi.fundingAccounts(),
  });
  const byId = React.useMemo(
    () => new Map((query.data ?? []).map((a) => [a.id, a])),
    [query.data],
  );
  return { ...query, byId };
}

/** True when `amountPaise` is more than the account holds (or it isn't loaded). */
export const isShort = (account: FundingAccount | undefined, amountPaise: bigint) =>
  Boolean(account) && amountPaise > BigInt(account!.balancePaise);

/** "Available ₹44,480" under an account, red when the amount is too big. */
export function AvailableNote({
  account,
  amountPaise,
}: {
  account: FundingAccount | undefined;
  amountPaise: bigint;
}) {
  if (!account) return null;
  const balance = BigInt(account.balancePaise);
  const short = amountPaise > balance;
  return (
    <p className={cn("text-xs", short ? "text-destructive" : "text-muted-foreground")}>
      Available in {account.name}: {balance < 0n ? `−${money(-balance)}` : money(balance)}
      {short ? ` — not enough for ${money(amountPaise)}` : ""}
      {!account.hasOpeningBalance ? " (opening balance not set)" : ""}
    </p>
  );
}

export function FundingLedgerSelect({
  id,
  mode,
  value,
  onChange,
  exclude,
}: {
  id?: string;
  mode: PaymentMode;
  value: string;
  onChange: (value: string) => void;
  /** Accounts already used elsewhere in the same payment. */
  exclude?: string[];
}) {
  const ledgers = useFundingAccounts();
  const group = fundingGroupFor(mode);
  const options = React.useMemo(
    () =>
      (ledgers.data ?? []).filter(
        (ledger) => ledger.group === group && (ledger.id === value || !exclude?.includes(ledger.id)),
      ),
    [ledgers.data, group, exclude, value],
  );

  // Switching Cash <-> Bank clears an account that no longer fits the mode.
  React.useEffect(() => {
    if (value && ledgers.data && !options.some((ledger) => ledger.id === value)) onChange("");
  }, [value, options, ledgers.data, onChange]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={!value || undefined}>
        <SelectValue
          placeholder={
            ledgers.isLoading ? "Loading…" : group === "CASH" ? "Select cash account" : "Select bank account"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((ledger) => (
          <SelectItem key={ledger.id} value={ledger.id}>
            {ledger.name} · {money(ledger.balancePaise)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PaymentModeSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: PaymentMode;
  onChange: (value: PaymentMode) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentMode)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PAYMENT_MODE_LABELS).map(([mode, label]) => (
          <SelectItem key={mode} value={mode}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BranchSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const branches = useQuery({
    queryKey: ["driver-finance", "branches"],
    queryFn: () => branchApi.list({ page: 0, size: 100 }),
  });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={!value || undefined}>
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {(branches.data?.data ?? []).map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const RUN_STATUS: Record<DriverSalaryRunStatus, { label: string; style: string }> = {
  DRAFT: {
    label: "Draft",
    style: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",
  },
  APPROVED: {
    label: "Approved",
    style: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  PAID: {
    label: "Paid",
    style: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  CANCELLED: {
    label: "Cancelled",
    style: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
};

export function SalaryRunStatusBadge({ status }: { status: DriverSalaryRunStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold",
        RUN_STATUS[status].style,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {RUN_STATUS[status].label}
    </span>
  );
}

const STATUS_STYLES: Record<DriverFinanceEntryStatus, string> = {
  POSTED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  REVERSED: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function EntryStatusBadge({ status }: { status: DriverFinanceEntryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status],
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {status === "POSTED" ? "Posted" : "Reversed"}
    </span>
  );
}
