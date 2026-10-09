"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconExternalLink,
  IconFileInvoice,
  IconTrash,
} from "@tabler/icons-react";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";
import { Card, CardContent } from "@skerp/ui/components/Card";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { Popover, PopoverContent, PopoverTrigger } from "@skerp/ui/components/popver";
import { StatusTabs, TableSearchInput } from "@/components/data-table";
import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { cn } from "@/lib/utils";
import { formatDate, money, rupeesToPaise } from "@/features/vendor-payment/vendor-payment.ui";
import {
  driverFinanceApi,
  driverFinanceKeys,
  type DriverSalaryLine,
  type SalaryRunLineEdit,
} from "./driver-finance.service";
import { PAYMENT_MODE_LABELS, SalaryRunStatusBadge } from "./driver-finance.ui";
import { PaySalaryRunDialog, outstandingOf } from "./PaySalaryRunDialog";
import { LeftDriversWarning } from "./LeftDriversWarning";

type Edit = { absent: string; salary: string; remove?: boolean };

const rupeeInput = (paise: string) => String(Number(paise) / 100);

const LINE_FILTERS = [
  { key: "all", label: "All" },
  { key: "absent", label: "Absent days" },
  { key: "deductions", label: "Has deductions" },
  { key: "negative", label: "Negative (carried)" },
  { key: "due", label: "Not paid yet" },
  { key: "paid", label: "Paid" },
] as const;
type LineFilter = (typeof LINE_FILTERS)[number]["key"];

function matchesFilter(line: DriverSalaryLine, filter: LineFilter): boolean {
  switch (filter) {
    case "absent":
      return line.absentDays > 0;
    case "deductions":
      return BigInt(totalDeductionOf(line)) !== 0n;
    case "negative":
      return BigInt(line.netPaise) < 0n;
    case "due":
      return BigInt(line.netPaise) - BigInt(line.paidPaise) > 0n;
    case "paid":
      return BigInt(line.paidPaise) > 0n;
    default:
      return true;
  }
}

/** Everything taken off (positive) or added to (negative) the earned salary. */
const totalDeductionOf = (l: DriverSalaryLine) =>
  (
    BigInt(l.salaryAdvancePaise) +
    BigInt(l.logSlipBalancePaise) +
    BigInt(l.otherPaymentsPaise) +
    BigInt(l.previousBalancePaise)
  ).toString();

/** A deduction: positive is taken off the pay (shown "−₹"); negative is money
 *  we owe the driver and is added to it (shown green "+₹"). */
function DeductionAmount({ paise }: { paise: string }) {
  const value = BigInt(paise);
  if (value === 0n) return <span className="text-muted-foreground">—</span>;
  if (value < 0n)
    return (
      <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{money(-value)}</span>
    );
  return <span className="tabular-nums">−{money(value)}</span>;
}

type DeductionKey =
  | "salaryAdvancePaise"
  | "logSlipBalancePaise"
  | "otherPaymentsPaise"
  | "previousBalancePaise";

const DEDUCTION_PARTS: { key: DeductionKey; label: string; hint: string }[] = [
  { key: "salaryAdvancePaise", label: "Salary advance", hint: "Advances given this month" },
  { key: "logSlipBalancePaise", label: "Log slip", hint: "This month's log slips, net of Paid in cash" },
  { key: "otherPaymentsPaise", label: "Other paid", hint: "Manual payments this month" },
  { key: "previousBalancePaise", label: "Previous", hint: "Carried from earlier months / late entries" },
];

/** Deductions total with a details popup — like the journey route chain. */
function DeductionsCell({ line }: { line: DriverSalaryLine }) {
  const parts = DEDUCTION_PARTS.filter((p) => BigInt(line[p.key]) !== 0n);
  if (!parts.length) return <span className="text-muted-foreground">—</span>;
  const net = BigInt(line.netPaise);
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      <DeductionAmount paise={totalDeductionOf(line)} />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted/80"
            aria-label={`Deduction details for ${line.driver.name}`}
          >
            {parts.length > 1 ? `${parts.length} items` : "Details"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">{line.driver.name}</p>
            <p className="text-xs text-muted-foreground">− is taken off the salary, + is added to it</p>
          </div>
          <div className="space-y-2 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span>Earned</span>
              <span className="tabular-nums">{money(line.earnedPaise)}</span>
            </div>
            {parts.map((p) => (
              <div key={p.key} className="flex justify-between gap-3">
                <span>
                  {p.label}
                  <span className="block text-xs text-muted-foreground">{p.hint}</span>
                </span>
                <DeductionAmount paise={line[p.key]} />
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Net pay</span>
              <span className={cn("tabular-nums", net < 0n && "text-destructive")}>
                {net < 0n ? `−${money(-net)}` : money(net)}
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** "Joined 15 Oct" / "Left 20 Oct" when that date falls in the run's month. */
function EmploymentNote({
  driver,
  month,
}: {
  driver: { joiningDate: string | null; leavingDate: string | null };
  month: string;
}) {
  const inMonth = (d: string | null) => (d && d.slice(0, 7) === month ? d : null);
  const label = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const joined = inMonth(driver.joiningDate);
  const left = inMonth(driver.leavingDate);
  if (!joined && !left) return null;
  return (
    <p className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-400">
      {[joined ? `Joined ${label(joined)}` : null, left ? `Left ${label(left)}` : null]
        .filter(Boolean)
        .join(" · ")}
    </p>
  );
}

/** First vehicle, the rest behind "+N". */
function VehiclesCell({ vehicles }: { vehicles: string[] }) {
  if (!vehicles.length)
    return <p className="text-xs text-muted-foreground">No journey this month</p>;
  if (vehicles.length === 1)
    return <p className="whitespace-nowrap text-xs text-muted-foreground">{vehicles[0]}</p>;
  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
      {vehicles[0]}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-primary hover:bg-muted/80"
          >
            +{vehicles.length - 1}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <p className="border-b px-4 py-2 text-sm font-semibold">Vehicles driven this month</p>
          <ul className="space-y-1 px-4 py-2 text-sm">
            {vehicles.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            His salary is split across them by days driven (Vehicle P&amp;L).
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function SalaryRunDetailPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.DRIVER_FINANCE.SALARY_MANAGE);
  const canApprove = useCan(PERMS.DRIVER_FINANCE.SALARY_APPROVE);
  const canPay = useCan(PERMS.DRIVER_FINANCE.PAY);
  const canViewVoucher = useCan(PERMS.LEDGER.VOUCHER_VIEW);
  const canEditDriverMaster = useCan(PERMS.MASTERS.DRIVER.UPDATE);

  const runQuery = useQuery({
    queryKey: driverFinanceKeys.salaryRun(id),
    queryFn: () => driverFinanceApi.salaryRun(id),
  });
  const run = runQuery.data;

  const [edits, setEdits] = React.useState<Record<string, Edit>>({});
  const [payOpen, setPayOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [salaryConfirmOpen, setSalaryConfirmOpen] = React.useState(false);
  const [alsoUpdateMaster, setAlsoUpdateMaster] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<LineFilter>("all");
  // A single driver's salary payment voucher (Dr driver / Cr bank or cash).
  const [paymentVoucherId, setPaymentVoucherId] = React.useState<string | null>(null);

  // Fresh server data wipes local edits — they were either saved or discarded.
  React.useEffect(() => setEdits({}), [run?.version]);

  const voucher = useQuery({
    queryKey: ["ledger", "voucher", run?.journalEntryId],
    queryFn: () => ledgerApi.voucher(run!.journalEntryId!),
    enabled: voucherOpen && Boolean(run?.journalEntryId),
  });
  const paymentVoucher = useQuery({
    queryKey: ["ledger", "voucher", paymentVoucherId],
    queryFn: () => ledgerApi.voucher(paymentVoucherId!),
    enabled: Boolean(paymentVoucherId),
  });

  const onDone = (message: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: driverFinanceKeys.all });
  };

  const changes: SalaryRunLineEdit[] = React.useMemo(() => {
    if (!run) return [];
    return run.salaries.flatMap((line) => {
      const edit = edits[line.driverId];
      if (!edit) return [];
      const absentDays = Number(edit.absent);
      const baseSalaryPaise = rupeesToPaise(edit.salary);
      const changed =
        edit.remove ||
        absentDays !== line.absentDays ||
        baseSalaryPaise !== String(BigInt(line.baseSalaryPaise));
      return changed
        ? [{ driverId: line.driverId, absentDays, baseSalaryPaise, remove: edit.remove || undefined }]
        : [];
    });
  }, [run, edits]);
  const dirty = changes.length > 0;

  // Salary changes get a confirmation that can also update the Driver master.
  const salaryChanges = React.useMemo(() => {
    if (!run) return [];
    return changes.flatMap((change) => {
      if (change.remove) return [];
      const line = run.salaries.find((l) => l.driverId === change.driverId);
      if (!line || change.baseSalaryPaise === String(BigInt(line.baseSalaryPaise))) return [];
      return [{ name: line.driver.name, from: line.baseSalaryPaise, to: change.baseSalaryPaise }];
    });
  }, [run, changes]);

  const invalidDays =
    run?.salaries.some((line) => {
      const edit = edits[line.driverId];
      if (!edit || edit.remove) return false;
      const n = Number(edit.absent);
      return !Number.isInteger(n) || n < 0 || n > line.presentDays + line.absentDays;
    }) ?? false;

  const save = useMutation({
    mutationFn: (updateMaster: boolean) =>
      driverFinanceApi.updateSalaryRun(id, {
        version: run!.version,
        lines: changes,
        updateMaster: updateMaster || undefined,
      }),
    onSuccess: (_data, updateMaster) => {
      setSalaryConfirmOpen(false);
      onDone(
        updateMaster
          ? "Saved — salary also updated in Driver master"
          : dirty
            ? "Saved and recalculated"
            : "Recalculated from the latest entries",
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const approve = useMutation({
    mutationFn: () => driverFinanceApi.approveSalaryRun(id, run!.version),
    onSuccess: (updated) => onDone(`${updated.runNumber} approved — salary posted to the driver ledgers`),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => driverFinanceApi.cancelSalaryRun(id, run!.version, reason),
    onSuccess: (updated) => {
      setCancelOpen(false);
      onDone(`${updated.runNumber} cancelled`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (runQuery.isLoading) return <Skeleton className="h-96" />;
  if (!run) return <p className="text-sm text-muted-foreground">Salary run not found.</p>;

  const isDraft = run.status === "DRAFT";
  const editable = isDraft && canManage;
  const showPaid = run.status === "APPROVED" || run.status === "PAID";

  const anyPaid = BigInt(run.paidPaise) > 0n;
  const dueCount = run.salaries.filter((l) => outstandingOf(l) > 0n).length;

  const edit = (line: DriverSalaryLine): Edit =>
    edits[line.driverId] ?? {
      absent: String(line.absentDays),
      salary: rupeeInput(line.baseSalaryPaise),
    };
  const setEdit = (line: DriverSalaryLine, patch: Partial<Edit>) =>
    setEdits((prev) => ({ ...prev, [line.driverId]: { ...edit(line), ...patch } }));

  const visible = run.salaries.filter((line) => !edits[line.driverId]?.remove);
  const term = search.trim().toLowerCase();
  const counts = Object.fromEntries(
    LINE_FILTERS.map((f) => [f.key, visible.filter((l) => matchesFilter(l, f.key)).length]),
  );
  const shown = visible.filter(
    (line) =>
      matchesFilter(line, filter) &&
      (!term ||
        line.driver.name.toLowerCase().includes(term) ||
        line.vehicles.some((v) => v.toLowerCase().includes(term))),
  );
  const isFiltered = shown.length !== visible.length;
  // Footer totals follow what is shown (search / filter).
  const sum = (pick: (l: DriverSalaryLine) => string) =>
    visible.reduce((s, l) => s + BigInt(pick(l)), 0n).toString();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-md border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3">
            <Button size="icon-sm" variant="ghost" asChild>
              <Link href="/accounts/driver-salary-runs" aria-label="Back to salary runs">
                <IconArrowLeft size={16} />
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Driver salary · {run.monthLabel}</h1>
                <SalaryRunStatusBadge status={run.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {run.runNumber} · {run.branch.name} · {run.daysInMonth} days in month
                {run.approvedAt ? ` · Approved ${formatDate(run.approvedAt)}` : ""}
                {run.cancelReason ? ` · Cancelled: ${run.cancelReason}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {editable ? (
              <Button
                variant={dirty ? "default" : "outline"}
                onClick={() => {
                  if (salaryChanges.length) {
                    setAlsoUpdateMaster(canEditDriverMaster);
                    setSalaryConfirmOpen(true);
                  } else save.mutate(false);
                }}
                disabled={save.isPending || invalidDays}
              >
                {save.isPending ? "Saving…" : dirty ? "Save & recalculate" : "Recalculate"}
              </Button>
            ) : null}
            {isDraft && canApprove ? (
              <Button
                onClick={() => approve.mutate()}
                disabled={dirty || approve.isPending || !run.canApproveNow}
                title={
                  !run.canApproveNow
                    ? `Approval opens on ${formatDate(run.approvableFrom)}, the last day of the month`
                    : dirty
                      ? "Save your changes first"
                      : undefined
                }
              >
                {approve.isPending ? "Approving…" : "Approve"}
              </Button>
            ) : null}
            {run.status === "APPROVED" && canPay ? (
              <Button onClick={() => setPayOpen(true)} disabled={!dueCount}>
                Pay salaries
              </Button>
            ) : null}
            {run.journalEntryId && canViewVoucher ? (
              <Button variant="outline" onClick={() => setVoucherOpen(true)}>
                View voucher
              </Button>
            ) : null}
            {(isDraft || (run.status === "APPROVED" && !anyPaid)) && canApprove ? (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                Cancel run
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <LeftDriversWarning />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Drivers", value: String(run.salaries.length) },
          { label: "Earned salary", value: money(run.totalEarnedPaise) },
          { label: "Net pay", value: money(run.totalNetPaise) },
          { label: "Paid", value: money(run.paidPaise) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-base font-semibold tabular-nums">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {run.paidFrom.length ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Paid from: </span>
          {run.paidFrom
            .map(
              (a) =>
                `${a.name} ${money(a.amountPaise)} (${a.count} driver${a.count === 1 ? "" : "s"})`,
            )
            .join(" · ")}
        </p>
      ) : null}

      {isDraft && !run.canApproveNow ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          This run can be checked and edited now, but <strong>approved only from{" "}
            {formatDate(run.approvableFrom)}</strong> — the last day of {run.monthLabel}. Until then the
          office can still record &quot;Paid in cash&quot; on this month&apos;s log slips.
        </p>
      ) : null}

      {isDraft ? (
        <p className="text-sm text-muted-foreground">
          Type <strong>absent days</strong> (and change a salary for this month if needed), then{" "}
          <strong>Save &amp; recalculate</strong>. Deduction columns come from the ERP: a{" "}
          <span className="text-emerald-700 dark:text-emerald-400">+</span> amount is money we owe the
          driver and is added to his pay. A negative net pay is not paid — it carries into next month.
        </p>
      ) : null}

      {/* Search + quick filters (client side — a run holds every driver). */}
      <div className="space-y-3">
        <TableSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search driver or vehicle…"
        />
        <StatusTabs
          tabs={LINE_FILTERS}
          active={filter}
          onChange={(key) => setFilter(key as LineFilter)}
          counts={counts}
          layoutId="salary-run-lines"
        />
      </div>

      {/* The salary sheet — deductions collapse into one column with a
          Details popup, vehicles into the driver cell, to keep it short. */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead
                  className="text-right"
                  title="Typed by the office. Journey days underneath are a hint only — a driver off a journey may still be at work (waiting for load, workshop)."
                >
                  Absent
                </TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead
                  className="text-right"
                  title="Salary advance + log slip + other paid + previous balance. Click the button for the split."
                >
                  Deductions
                </TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                {showPaid ? <TableHead className="text-right">Paid</TableHead> : null}
                {editable ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((line) => {
                const e = edit(line);
                const net = BigInt(line.netPaise);
                const stale = Boolean(edits[line.driverId]);
                return (
                  <TableRow key={line.driverId}>
                    <TableCell>
                      <Link
                        href={`/masters/driver?open=${line.driverId}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 whitespace-nowrap font-medium hover:text-primary hover:underline"
                        title="Open in Driver master (new tab)"
                      >
                        {line.driver.name}
                        <IconExternalLink size={12} className="text-muted-foreground" />
                      </Link>
                      <VehiclesCell vehicles={line.vehicles} />
                      <EmploymentNote driver={line.driver} month={run.month} />
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input
                          id={`salary-${line.driverId}`}
                          aria-label={`Salary for ${line.driver.name}`}
                          inputMode="decimal"
                          className="ml-auto h-8 w-24 text-right"
                          value={e.salary}
                          onChange={(ev) => setEdit(line, { salary: ev.target.value })}
                        />
                      ) : (
                        <span className="tabular-nums">{money(line.baseSalaryPaise)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input
                          id={`absent-${line.driverId}`}
                          aria-label={`Absent days for ${line.driver.name}`}
                          inputMode="numeric"
                          className="ml-auto h-8 w-16 text-right"
                          value={e.absent}
                          onChange={(ev) => setEdit(line, { absent: ev.target.value })}
                        />
                      ) : (
                        <span className="tabular-nums">{line.absentDays}</span>
                      )}
                      <p
                        className={cn(
                          "mt-0.5 whitespace-nowrap text-xs text-muted-foreground",
                          stale && "opacity-50",
                        )}
                      >
                        {line.presentDays} present · {line.journeyDays} d journey
                      </p>
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", stale && "opacity-50")}>
                      {money(line.earnedPaise)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeductionsCell line={line} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        net < 0n && "text-destructive",
                        stale && "opacity-50",
                      )}
                      title={net < 0n ? "Driver owes this — carried into next month" : undefined}
                    >
                      {net < 0n ? `−${money(-net)}` : money(net)}
                    </TableCell>
                    {showPaid ? (
                      <TableCell className="text-right tabular-nums">
                        {BigInt(line.paidPaise) > 0n ? money(line.paidPaise) : "—"}
                        {line.payouts.map((p) => (
                          <div
                            key={p.id}
                            className={cn(
                              "mt-0.5 flex items-center justify-end gap-1 whitespace-nowrap text-xs text-muted-foreground",
                              p.status === "REVERSED" && "line-through",
                            )}
                            title={`${p.payoutNumber} · ${formatDate(p.paidAt)}${p.status === "REVERSED" ? " · reversed" : ""}`}
                          >
                            {p.fundingLedger.name} · {PAYMENT_MODE_LABELS[p.mode]}
                            {canViewVoucher && p.journalEntryId ? (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="size-6"
                                aria-label={`View payment voucher ${p.payoutNumber}`}
                                onClick={() => setPaymentVoucherId(p.journalEntryId)}
                              >
                                <IconFileInvoice size={14} />
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </TableCell>
                    ) : null}
                    {editable ? (
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove ${line.driver.name} from this run`}
                          title="Remove from this run"
                          onClick={() => setEdit(line, { remove: true })}
                        >
                          <IconTrash size={15} />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
              {!shown.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No driver matches this search / filter.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  {isFiltered ? `Total (${shown.length} of ${visible.length} drivers)` : "Total"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {money(sum((l) => l.earnedPaise))}
                </TableCell>
                <TableCell className="text-right">
                  <DeductionAmount paise={sum(totalDeductionOf)} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {money(
                    shown.reduce((t, l) => t + (BigInt(l.netPaise) > 0n ? BigInt(l.netPaise) : 0n), 0n),
                  )}
                </TableCell>
                {showPaid ? (
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money(sum((l) => l.paidPaise))}
                  </TableCell>
                ) : null}
                {editable ? <TableCell /> : null}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
      {dirty ? (
        <p className="text-xs text-muted-foreground">
          Faded figures are from before your changes — <strong>Save &amp; recalculate</strong> to update
          them.
        </p>
      ) : null}

      {run.status === "APPROVED" ? (
        <PaySalaryRunDialog open={payOpen} onOpenChange={setPayOpen} run={run} />
      ) : null}
      <Dialog open={salaryConfirmOpen} onOpenChange={setSalaryConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salary changed</DialogTitle>
            <DialogDescription>
              These salaries change for {run.monthLabel}. Absent days and everything else stay as typed.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 rounded-md border px-3 py-2 text-sm">
            {salaryChanges.map((c) => (
              <li key={c.name} className="flex justify-between gap-3">
                <span className="font-medium">{c.name}</span>
                <span className="tabular-nums">
                  {money(c.from)} → {money(c.to)}
                </span>
              </li>
            ))}
          </ul>
          {canEditDriverMaster ? (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                id="salary-update-master"
                checked={alsoUpdateMaster}
                onCheckedChange={(v) => setAlsoUpdateMaster(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                Also update in <strong>Driver master</strong>
                <span className="block text-xs text-muted-foreground">
                  Ticked: his salary from now on (next months start from it). Unticked: this month
                  only.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              This changes this month only. Your role can&apos;t edit the Driver master.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSalaryConfirmOpen(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => save.mutate(alsoUpdateMaster)} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save & recalculate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel ${run.runNumber}?`}
        description={
          run.status === "APPROVED"
            ? "The salary journal is reversed and every driver is freed for a new run of this month."
            : "The draft is cancelled and every driver is freed for a new run of this month."
        }
        confirmLabel="Cancel run"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
        fallbackVoucherNumber={run.runNumber}
      />
      <VoucherDialog
        open={Boolean(paymentVoucherId)}
        onOpenChange={(open) => !open && setPaymentVoucherId(null)}
        voucher={paymentVoucher.data}
        isLoading={paymentVoucher.isLoading}
        isError={paymentVoucher.isError}
        errorMessage={
          paymentVoucher.error instanceof Error ? paymentVoucher.error.message : undefined
        }
      />
    </div>
  );
}
