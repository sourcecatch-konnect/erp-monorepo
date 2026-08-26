"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@skerp/ui/components/tabs";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";

import { ledgerApi } from "./api/ledger.service";
import { ledgerKeys } from "./api/ledger.keys";
import { LedgerPartyPicker, type LedgerPartyKind } from "./components/LedgerPartyPicker";
import { LedgerTable, type BalanceConvention } from "./components/LedgerTable";
import { CompactMoney } from "./components/CompactMoney";
import { downloadLedgerCsv } from "./components/exportLadgerCSV";

type ReportTab = "bank" | "cash" | "debtor" | "creditor" | "expense";

const tabConfig: Record<
  ReportTab,
  {
    label: string;
    description: string;
    partyKind: LedgerPartyKind | null;
    /**
     * Which side of the account a positive running balance reads as.
     * - "asset": bank/cash/debtor — money owed TO us, or held BY us.
     *   Positive balance = Dr.
     * - "liability": creditor — money we owe. Positive balance = Cr.
     * - null: no true running balance (expense is a flat feed across payees).
     *
     * ASSUMPTION TO VERIFY: this assumes `direction` already reflects a pure
     * cash movement (IN = money received, OUT = money paid) and that today
     * Debtor/Creditor tabs only ever contain RECEIPT/PAYMENT rows (per the
     * existing copy: "Everything one customer has PAID you" / "Everything
     * PAID to one creditor"). If you later add non-cash rows to those tabs —
     * an invoice raised, a bill received — direction alone won't tell you
     * Dr vs Cr anymore and this mapping needs to move server-side.
     */
    balanceConvention: BalanceConvention;
  }
> = {
  bank: { label: "Bank", description: "Every entry into/out of one bank account", partyKind: "account-bank", balanceConvention: "asset" },
  cash: { label: "Cash", description: "Every entry into/out of one cash account", partyKind: "account-cash", balanceConvention: "asset" },
  debtor: { label: "Debtor", description: "Everything one customer has paid you", partyKind: "customer", balanceConvention: "asset" },
  creditor: { label: "Creditor", description: "Everything paid to one creditor", partyKind: "creditor", balanceConvention: "liability" },
  expense: { label: "Expense", description: "Every payment tagged as an expense, across all payees", partyKind: null, balanceConvention: null },
};

/** Bank / Cash / Debtor / Creditor / Expense ledger reports — each a filtered
 * read of the same LedgerEntry table. Cross-master by nature (spans
 * CashAccount + Customer + Creditor), so this is a top-level feature rather
 * than nested under cash-planning or masters. */
export function LedgerPage() {
  const [tab, setTab] = React.useState<ReportTab>("bank");
  const [partyId, setPartyId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  // FIX: previously this component read the *active* tab's config (`config`,
  // derived from `tab`) inside a loop over every tab's TabsContent. It only
  // rendered correctly because Radix Tabs doesn't mount inactive panels by
  // default — flip on forceMount later and every inactive tab would show the
  // wrong party picker. Each render below now looks up `tabConfig[key]`
  // directly instead of closing over the outer `tab`/`config`.
  const activeConfig = tabConfig[tab];
  const range = { from: from || undefined, to: to || undefined };

  const changeTab = (next: string) => {
    setTab(next as ReportTab);
    setPartyId("");
  };

  const query = useQuery({
    queryKey:
      tab === "expense"
        ? ledgerKeys.expenses(range)
        : tab === "debtor"
          ? ledgerKeys.customer(partyId, range)
          : tab === "creditor"
            ? ledgerKeys.creditor(partyId, range)
            : ledgerKeys.account(partyId, range),
    queryFn: () => {
      if (tab === "expense") return ledgerApi.expenses(range);
      if (tab === "debtor") return ledgerApi.forCustomer(partyId, range);
      if (tab === "creditor") return ledgerApi.forCreditor(partyId, range);
      return ledgerApi.forAccount(partyId, range);
    },
    enabled: tab === "expense" || partyId.length > 0,
  });

  const handleExport = () => {
    if (!query.data) return;
    downloadLedgerCsv({
      filename: `${tab}-ledger`,
      openingBalance: query.data.openingBalance,
      entries: query.data.entries,
      balanceConvention: activeConfig.balanceConvention,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-semibold">Ledgers</h1>
          <p className="text-sm text-muted-foreground">
            Bank, Cash, Debtor, Creditor and Expense history — every entry, with a running balance.
            Ledger history starts from when this report shipped; older activity stays visible in
            Cash Planning&apos;s day-by-day view.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!query.data}>
            Export CSV
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="print:hidden">
          {(Object.keys(tabConfig) as ReportTab[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {tabConfig[key].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(tabConfig) as ReportTab[]).map((key) => {
          const cfg = tabConfig[key];
          return (
            <TabsContent key={key} value={key} className="space-y-3">
              <p className="text-xs text-muted-foreground print:hidden">{cfg.description}</p>

              <div className="flex flex-wrap items-end gap-3 print:hidden">
                {cfg.partyKind ? (
                  <div className="w-64">
                    <LedgerPartyPicker kind={cfg.partyKind} value={partyId} onChange={setPartyId} />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <Input type="date" className="h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <Input type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>

              {tab === key && !query.data && !query.isLoading ? (
                <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  {cfg.partyKind ? "Pick one to see its ledger." : "No entries yet."}
                </div>
              ) : tab === key ? (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                  <LedgerTable
                    entries={query.data?.entries ?? []}
                    openingBalance={query.data?.openingBalance ?? 0}
                    isLoading={query.isLoading}
                    emptyLabel="No entries in this range"
                    balanceConvention={cfg.balanceConvention}
                    maxHeight={480}
                    // Row drill-down: wire this to whatever your app uses to
                    // show a voucher (Sheet/Dialog from @skerp/ui, or a
                    // route push to /receipts/:id or /payments/:id).
                    onRowClick={(entry) => {
                      console.log("open source voucher for", entry.id);
                    }}
                  />
                  <div className="grid grid-cols-3 gap-px border-t bg-border text-sm">
                    <div className="bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {cfg.balanceConvention ? "Total Debit" : "Total In"}
                      </p>
                      <CompactMoney
                        className="text-base font-semibold"
                        value={debitTotal(query.data, cfg.balanceConvention)}
                      />
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {cfg.balanceConvention ? "Total Credit" : "Total Out"}
                      </p>
                      <CompactMoney
                        className="text-base font-semibold"
                        value={creditTotal(query.data, cfg.balanceConvention)}
                      />
                    </div>
                    <div className="bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Closing Balance</p>
                      <span className="inline-flex items-baseline gap-1">
                        <CompactMoney className="text-base font-semibold" value={query.data?.closingBalance ?? 0} />
                        {cfg.balanceConvention ? (
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                            {isDr(query.data?.closingBalance ?? 0, cfg.balanceConvention) ? "Dr" : "Cr"}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function isDr(balance: number, convention: BalanceConvention): boolean {
  if (!convention) return true;
  return balance >= 0 === (convention === "asset");
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