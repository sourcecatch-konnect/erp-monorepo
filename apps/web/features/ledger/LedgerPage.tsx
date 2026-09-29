"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@skerp/ui/components/tabs";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

import { branchApi } from "@/features/masters/branch/branch.service";
import { ledgerApi, type AgeingFilters, type StatementFilters, type VendorType } from "./api/ledger.service";
import { ledgerKeys } from "./api/ledger.keys";
import {
  LedgerPartyPicker,
  type CreditorTypeFilter,
  type LedgerPartyKind,
} from "./components/LedgerPartyPicker";
import {
  LedgerTable,
  sourceBadge,
  sourceLabel,
  type BalanceConvention,
  type GenericStatementRow,
} from "./components/LedgerTable";
import { AgeingTable } from "./components/AgeingTable";
import { StatementExportButton } from "./components/StatementExportButton";
import { CompactMoney } from "./components/CompactMoney";
import { downloadLedgerCsv } from "./components/exportLadgerCSV";
import { recentFyCodes } from "./fy";

const VENDOR_STATEMENT_KIND_BADGE: Record<string, string> = {
  ACCRUAL: "bg-blue-50 text-blue-700",
  PAYMENT: "bg-red-50 text-red-700",
  REVERSAL: "bg-amber-50 text-amber-700",
};
const VENDOR_STATEMENT_KIND_LABEL: Record<string, string> = {
  ACCRUAL: "Accrual",
  PAYMENT: "Payment",
  REVERSAL: "Reversal",
};

const CREDITOR_TYPE_OPTIONS: { label: string; value: CreditorTypeFilter }[] = [
  { label: "All vendors", value: "ALL" },
  { label: "Transporters", value: "TRANSPORTER" },
  { label: "Labour", value: "LABOUR" },
  { label: "Other creditors/suppliers", value: "NON_VENDOR" },
];

type ReportTab = "bank" | "cash" | "debtor" | "creditor" | "expense" | "ageing";

type CashTabConfig = {
  label: string;
  description: string;
  partyKind: LedgerPartyKind | null;
  balanceConvention: BalanceConvention;
};

/** Bank / Cash — plain IN/OUT ledger reads of the legacy LedgerEntry table.
 *  Creditor / Expense now read the real JournalLine/Ledger postings (so
 *  Workshop PO/Inward/Job Card/Service Bill vouchers show up), same as
 *  Debtor + Ageing reading the real Bill/Receipt statement instead of
 *  LedgerEntry. */
const cashTabs: Record<"bank" | "cash" | "creditor" | "driver" | "expense", CashTabConfig> = {
  bank: { label: "Bank", description: "Every entry into/out of one bank account", partyKind: "account-bank", balanceConvention: "asset" },
  cash: { label: "Cash", description: "Every entry into/out of one cash account", partyKind: "account-cash", balanceConvention: "asset" },
  creditor: { label: "Creditor", description: "Everything paid to one creditor", partyKind: "creditor", balanceConvention: "liability" },
  driver: { label: "Driver", description: "One driver's advance vs. settlement position, from posted Log Slips", partyKind: "driver", balanceConvention: "asset" },
  expense: { label: "Expense", description: "Every payment tagged as an expense, across all payees", partyKind: null, balanceConvention: null },
};

const TAB_ORDER: ReportTab[] = ["bank", "cash", "debtor", "creditor", "driver", "expense", "ageing"];
const TAB_LABEL: Record<ReportTab, string> = {
  bank: "Bank",
  cash: "Cash",
  debtor: "Debtor",
  creditor: "Creditor",
  driver: "Driver",
  expense: "Expense",
  ageing: "Ageing",
};

const FY_OPTIONS = recentFyCodes(4);
function LedgerTotals({
  data,
  convention,
  isLoading,
}: {
  data?: {
    totalIn?: number;
    totalOut?: number;
    closingBalance?: number;
  };
  convention: BalanceConvention;
  isLoading: boolean;
}) {
  const closingBalance = data?.closingBalance ?? 0;

  return (
    <section
      aria-label="Ledger totals"
      className="border-t border-border bg-muted/20"
    >
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Period summary
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Totals for the selected ledger and date range
          </p>
        </div>
        {isLoading && (
          <span className="text-xs text-muted-foreground">Updating…</span>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            {convention ? "Total debit" : "Total in"}
          </p>
          <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
            {isLoading ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <CompactMoney value={debitTotal(data, convention)} />
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            {convention ? "Total credit" : "Total out"}
          </p>
          <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
            {isLoading ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <CompactMoney value={creditTotal(data, convention)} />
            )}
          </div>
        </div>

        <div className="bg-primary/[0.05] px-5 py-4">
          <p className="text-xs font-semibold text-foreground">
            Closing balance
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums tracking-tight text-foreground">
              {isLoading ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <CompactMoney value={Math.abs(closingBalance)} />
              )}
            </span>

            {!isLoading && convention && (
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {isDr(closingBalance, convention) ? "Dr" : "Cr"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
/** Bank / Cash / Debtor / Creditor / Expense / Ageing ledger reports. */
export function LedgerPage() {
  const [tab, setTab] = React.useState<ReportTab>("bank");
  const [partyId, setPartyId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [branchId, setBranchId] = React.useState("ALL");
  const [fyCode, setFyCode] = React.useState("ALL");
  const [creditorTypeFilter, setCreditorTypeFilter] = React.useState<CreditorTypeFilter>("ALL");
  // Set by LedgerPartyPicker's onSelectAccount when the picked creditor-tab
  // row is a vendor (VP-8) — null for a plain Creditor/SparePartSupplier row.
  const [selectedVendorType, setSelectedVendorType] = React.useState<VendorType | null>(null);

  const range = { from: from || undefined, to: to || undefined };
  const showStatementFilters = tab === "debtor" || tab === "ageing" || tab === "creditor";
  const isVendorStatement = tab === "creditor" && Boolean(selectedVendorType);

  const changeTab = (next: string) => {
    setTab(next as ReportTab);
    setPartyId("");
    setSelectedVendorType(null);
  };

  const branches = useQuery({
    queryKey: ["ledger", "branches"],
    queryFn: () => branchApi.list({ page: 0, size: 200 }),
  });

  // Bank / Cash (legacy LedgerEntry) and Expense / plain-Creditor
  // (JournalLine, flat IN-OUT). A vendor-typed creditor row instead uses
  // vendorStatementQuery below, which reads VendorPaymentSlip directly.
  const cashQuery = useQuery({
    queryKey:
      tab === "expense"
        ? ledgerKeys.expenses(range)
        : tab === "creditor"
          ? ledgerKeys.creditor(partyId, range)
          : tab === "driver"
            ? ledgerKeys.driver(partyId, range)
            : ledgerKeys.account(partyId, range),
    queryFn: () => {
      if (tab === "expense") return ledgerApi.expenses(range);
      if (tab === "creditor") return ledgerApi.forCreditor(partyId, range);
      if (tab === "driver") return ledgerApi.forDriver(partyId, range);
      return ledgerApi.forAccount(partyId, range);
    },
    enabled:
      (tab === "bank" || tab === "cash" || tab === "expense" || (tab === "creditor" && !selectedVendorType)) &&
      (tab === "expense" || partyId.length > 0),
  });

  const statementFilters: StatementFilters = {
    branchId: branchId === "ALL" ? undefined : branchId,
    fyCode: fyCode === "ALL" ? undefined : fyCode,
    from: from || undefined,
    to: to || undefined,
  };

  const statementQuery = useQuery({
    queryKey: ledgerKeys.statement(partyId, statementFilters),
    queryFn: () => ledgerApi.customerStatement(partyId, statementFilters),
    enabled: tab === "debtor" && partyId.length > 0,
  });

  const vendorStatementQuery = useQuery({
    queryKey: ledgerKeys.vendorStatement(partyId, statementFilters),
    queryFn: () => ledgerApi.vendorStatement(partyId, statementFilters),
    enabled: isVendorStatement && partyId.length > 0,
  });

  const ageingFilters: AgeingFilters = {
    branchId: branchId === "ALL" ? undefined : branchId,
    fyCode: fyCode === "ALL" ? undefined : fyCode,
    asOf: to || undefined,
  };
  const ageingQuery = useQuery({
    queryKey: ledgerKeys.ageing(ageingFilters),
    queryFn: () => ledgerApi.ageing(ageingFilters),
    enabled: tab === "ageing",
  });

  const handleExportCsv = () => {
    if (tab === "debtor" || tab === "ageing" || isVendorStatement || !cashQuery.data) return;
    const cfg = cashTabs[tab as "bank" | "cash" | "creditor" | "expense"];
    downloadLedgerCsv({
      filename: `${tab}-ledger`,
      openingBalance: cashQuery.data.openingBalance,
      entries: cashQuery.data.entries,
      balanceConvention: cfg.balanceConvention,
    });
  };

  const branchOptions = branches.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ledgers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review account movements, statements and balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print
          </Button>
          {tab === "debtor" ? (
            <StatementExportButton
              customerId={partyId}
              filters={statementFilters}
              disabled={!partyId || !statementQuery.data}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={tab === "ageing" || isVendorStatement || !cashQuery.data}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="print:hidden">
          {TAB_ORDER.map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABEL[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Shared filter row */}
        <div className="mt-3 flex flex-wrap items-end gap-3 print:hidden">
          {tab === "debtor" ? (
            <div className="w-64">
              <LedgerPartyPicker kind="customer" value={partyId} onChange={setPartyId} />
            </div>
          ) : tab === "creditor" ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Vendor type</label>
                <Select
                  value={creditorTypeFilter}
                  onValueChange={(v) => {
                    setCreditorTypeFilter(v as CreditorTypeFilter);
                    setPartyId("");
                    setSelectedVendorType(null);
                  }}
                >
                  <SelectTrigger className="h-9 w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDITOR_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-64">
                <LedgerPartyPicker
                  kind="creditor"
                  value={partyId}
                  onChange={setPartyId}
                  creditorTypeFilter={creditorTypeFilter}
                  onSelectAccount={(account) =>
                    setSelectedVendorType(
                      account?.transportId ? "TRANSPORTER" : account?.labourId ? "LABOUR" : null,
                    )
                  }
                />
              </div>
            </>
          ) : tab !== "ageing" && cashTabs[tab as "bank" | "cash" | "creditor" | "expense"]?.partyKind ? (
            <div className="w-64">
              <LedgerPartyPicker
                kind={cashTabs[tab as "bank" | "cash" | "creditor" | "driver" | "expense"].partyKind!}
                value={partyId}
                onChange={setPartyId}
              />
            </div>
          ) : null}

          {showStatementFilters ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Branch</label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All branches</SelectItem>
                    {branchOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Financial year</label>
                <Select value={fyCode} onValueChange={setFyCode}>
                  <SelectTrigger className="h-9 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {FY_OPTIONS.map((fy) => (
                      <SelectItem key={fy} value={fy}>
                        {fy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tab === "ageing" ? "As of" : "From"}
            </label>
            <Input
              type="date"
              className="h-9 w-40"
              value={tab === "ageing" ? to : from}
              onChange={(e) => (tab === "ageing" ? setTo(e.target.value) : setFrom(e.target.value))}
            />
          </div>
          {tab !== "ageing" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          ) : null}
        </div>

        {/* ---- Debtor: full customer statement (ACCT-R3) ---- */}
        <TabsContent value="debtor" className="space-y-3">
          <p className="text-xs text-muted-foreground print:hidden">
            One customer&apos;s real outstanding — every bill, receipt and adjustment in date
            order with a running balance.
          </p>
          {!partyId ? (
            <EmptyHint>Pick a customer to see their statement.</EmptyHint>
          ) : (
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <LedgerTable
                variant="statement"
                entries={[]}
                openingBalance={0}
                balanceConvention="asset"
                statementRows={statementQuery.data?.lines ?? []}
                statementOpeningPaise={statementQuery.data?.openingBalancePaise ?? 0}
                isLoading={statementQuery.isLoading}
                emptyLabel="No transactions in this range"
                maxHeight={480}
              />
              <StatementTotals data={statementQuery.data} />
            </div>
          )}
        </TabsContent>

        {/* ---- Ageing (ACCT-R5) ---- */}
        <TabsContent value="ageing" className="space-y-3">
          <p className="text-xs text-muted-foreground print:hidden">
            Every customer&apos;s unpaid bills, bucketed by how overdue they are as of the
            selected date.
          </p>
          <AgeingTable
            data={ageingQuery.data}
            isLoading={ageingQuery.isLoading}
            onSelectCustomer={(id) => {
              setPartyId(id);
              setTab("debtor");
            }}
          />
        </TabsContent>

        {/* ---- Creditor: plain ledger, or a vendor statement (VP-8) when the
             picked row is a transporter/labour party ---- */}
        <TabsContent value="creditor" className="space-y-3">
          <p className="text-xs text-muted-foreground print:hidden">
            {isVendorStatement
              ? "One vendor's real outstanding — every accrual and payment in date order with a running balance."
              : cashTabs.creditor.description}
          </p>
          {!partyId ? (
            <EmptyHint>Pick a creditor, transporter or labour to see their ledger.</EmptyHint>
          ) : isVendorStatement ? (
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <LedgerTable
                variant="statement"
                entries={[]}
                openingBalance={0}
                balanceConvention="liability"
                statementBalanceConvention="liability"
                statementKindBadge={VENDOR_STATEMENT_KIND_BADGE}
                statementKindLabel={VENDOR_STATEMENT_KIND_LABEL}
                statementRows={vendorStatementQuery.data?.lines ?? []}
                statementOpeningPaise={vendorStatementQuery.data?.openingBalancePaise ?? 0}
                isLoading={vendorStatementQuery.isLoading}
                emptyLabel="No transactions in this range"
                maxHeight={480}
              />
              <VendorStatementTotals data={vendorStatementQuery.data} />
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border bg-card">
              {/* Same "statement" visual as the vendor case — opening balance
                  row, kind badges, running balance — even though a plain
                  Creditor/SparePartSupplier row has no VendorPaymentSlip to
                  read, so its rows come from the flat ledgerForCreditor read
                  via toGenericStatementRows() instead of a richer per-slip
                  source. "Open the statement" now means the same view for
                  every Chart-of-Accounts row this tab supports. */}
              <LedgerTable
                variant="statement"
                entries={[]}
                openingBalance={0}
                balanceConvention="liability"
                statementBalanceConvention="liability"
                statementKindBadge={sourceBadge}
                statementKindLabel={sourceLabel}
                statementRows={toGenericStatementRows(cashQuery.data)}
                statementOpeningPaise={cashQuery.data?.openingBalance ?? 0}
                isLoading={cashQuery.isLoading}
                emptyLabel="No entries in this range"
                maxHeight={480}
              />
              <div className="grid grid-cols-3 gap-px border-t bg-border text-sm">
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Total Debit</p>
                  <CompactMoney
                    className="text-base font-semibold"
                    value={debitTotal(cashQuery.data, "liability")}
                  />
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Total Credit</p>
                  <CompactMoney
                    className="text-base font-semibold"
                    value={creditTotal(cashQuery.data, "liability")}
                  />
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Closing Balance</p>
                  <span className="inline-flex items-baseline gap-1">
                    <CompactMoney className="text-base font-semibold" value={cashQuery.data?.closingBalance ?? 0} />
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {isDr(cashQuery.data?.closingBalance ?? 0, "liability") ? "Dr" : "Cr"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---- Bank / Cash / Expense ---- */}
        {(["bank", "cash", "expense"] as const).map((key) => {
          const cfg = cashTabs[key];
          return (
            <TabsContent key={key} value={key} className="space-y-3">
              <p className="text-xs text-muted-foreground print:hidden">{cfg.description}</p>
              {tab === key && !cashQuery.data && !cashQuery.isLoading ? (
                <EmptyHint>{cfg.partyKind ? "Pick one to see its ledger." : "No entries yet."}</EmptyHint>
              ) : tab === key ? (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                  <LedgerTable
                    entries={cashQuery.data?.entries ?? []}
                    openingBalance={cashQuery.data?.openingBalance ?? 0}
                    isLoading={cashQuery.isLoading}
                    emptyLabel="No entries in this range"
                    balanceConvention={cfg.balanceConvention}
                    maxHeight={480}
                    onRowClick={(entry) => {
                      console.log("open source voucher for", entry.id);
                    }}
                  />
                  <LedgerTotals
                    data={cashQuery.data}
                    convention={cfg.balanceConvention}
                    isLoading={cashQuery.isLoading}
                  />
                </div>
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function StatementTotals({
  data,
}: {
  data?: import("@skerp/types").CustomerStatementView;
}) {
  const t = data?.totals;
  const cell = (label: string, value: number) => (
    <div className="bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <CompactMoney className="text-base font-semibold" value={value} />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-px border-t bg-border text-sm sm:grid-cols-5">
      {cell("Billed", t?.billedPaise ?? 0)}
      {cell("Received", t?.receivedPaise ?? 0)}
      {cell("TDS", t?.tdsPaise ?? 0)}
      {cell("On account", t?.onAccountPaise ?? 0)}
      <div className="bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Outstanding</p>
        <span className="inline-flex items-baseline gap-1">
          <CompactMoney className="text-base font-semibold" value={data?.closingBalancePaise ?? 0} />
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            {(data?.closingBalancePaise ?? 0) >= 0 ? "Dr" : "Cr"}
          </span>
        </span>
      </div>
    </div>
  );
}

function VendorStatementTotals({
  data,
}: {
  data?: import("@skerp/types").VendorStatementView;
}) {
  const t = data?.totals;
  const cell = (label: string, value: number) => (
    <div className="bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <CompactMoney className="text-base font-semibold" value={value} />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-px border-t bg-border text-sm sm:grid-cols-4">
      {cell("Accrued", t?.accruedPaise ?? 0)}
      {cell("Paid", t?.paidPaise ?? 0)}
      {cell("Reversed", t?.reversedPaise ?? 0)}
      <div className="bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Outstanding</p>
        <span className="inline-flex items-baseline gap-1">
          <CompactMoney className="text-base font-semibold" value={data?.closingBalancePaise ?? 0} />
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            {(data?.closingBalancePaise ?? 0) >= 0 ? "Cr" : "Dr"}
          </span>
        </span>
      </div>
    </div>
  );
}

function isDr(balance: number, convention: BalanceConvention): boolean {
  if (!convention) return true;
  return balance >= 0 === (convention === "asset");
}

/**
 * Adapts a plain (non-vendor) creditor's flat LedgerView into the same
 * GenericStatementRow shape the statement table renders — so a Creditor/
 * SparePartSupplier row opens the identical "statement" view a transporter/
 * labour row does, per VP-8's "supported Chart of Accounts rows [also] open
 * the statement". No slip to drill into for these sources, so `href` stays
 * null; direction -> debit/credit follows the same IN=credit/OUT=debit
 * convention ledgerForCreditor's own liability reading already uses.
 */
function toGenericStatementRows(
  view: import("@skerp/types").LedgerView | undefined,
): GenericStatementRow[] {
  if (!view) return [];
  return view.entries.map((e) => ({
    id: e.id,
    date: new Date(e.occurredAt).toISOString(),
    kind: e.sourceType,
    particulars: e.description,
    voucherNumber: null,
    href: null,
    debitPaise: e.direction === "OUT" ? e.amountPaise : 0,
    creditPaise: e.direction === "IN" ? e.amountPaise : 0,
    runningBalancePaise: e.runningBalance,
  }));
}

type ReportTotals = { totalIn?: number; totalOut?: number } | undefined;

/** Debit-column total: for asset ledgers that's cash IN; for liability
 * ledgers (creditor) it's cash OUT (a payment reduces what we owe, which is
 * a debit to the creditor's account). */
function debitTotal(data: ReportTotals, convention: BalanceConvention): number {
  if (convention === "liability") return data?.totalOut ?? 0;
  return data?.totalIn ?? 0;
}

function creditTotal(data: ReportTotals, convention: BalanceConvention): number {
  if (convention === "liability") return data?.totalIn ?? 0;
  return data?.totalOut ?? 0;
}
