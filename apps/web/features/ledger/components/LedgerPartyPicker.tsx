"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";

import { customerApi } from "../../masters/Customer/customer.service";
import { cashAccountApi } from "../../masters/cash-account/cash-account.service";
import { useDebouncedValue } from "../../masters/_shared/hooks/useDebouncedValue";
import { ledgerApi, vendorTypeOf, type LedgerAccount, type VendorType } from "../api/ledger.service";

export type LedgerPartyKind = "account-bank" | "account-cash" | "customer" | "creditor";

/** "creditor" kind only — narrows the SUNDRY_CREDITOR list to one vendor
 *  type (VP-8's "vendor type" filter). `"NON_VENDOR"` means the plain
 *  Creditor/SparePartSupplier rows that have no vendor-payment statement. */
export type CreditorTypeFilter = "ALL" | VendorType | "NON_VENDOR";

type Props = {
  kind: LedgerPartyKind;
  value: string;
  onChange: (id: string) => void;
  /** "creditor" kind only. */
  creditorTypeFilter?: CreditorTypeFilter;
  /** "creditor" kind only — fires alongside onChange with the full picked
   *  ledger row, so the caller (LedgerPage) knows whether it's a vendor
   *  (and which type) without a second lookup. */
  onSelectAccount?: (account: LedgerAccount | null) => void;
};

const placeholderFor: Record<LedgerPartyKind, string> = {
  "account-bank": "Select bank account",
  "account-cash": "Select cash account",
  customer: "Select customer",
  creditor: "Select creditor",
};

/** Party/account picker for the 5 ledger reports — one Combobox, backed by
 * whichever master's search-as-you-type list applies to the active tab. */
export function LedgerPartyPicker({
  kind,
  value,
  onChange,
  creditorTypeFilter = "ALL",
  onSelectAccount,
}: Props) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const creditorQuery = useQuery({
    queryKey: ["ledger", "party-picker", "creditor", debouncedSearch],
    // Every SUNDRY_CREDITOR party ledger — Creditor master rows AND
    // SparePartSupplier rows (getOrCreatePartyLedger lazily creates one
    // PARTY ledger per party the first time a voucher posts to them), so
    // Workshop's PO/Inward/Job Card/Service Bill postings to a supplier
    // show up here too — AND Transport/Labour rows (VP-8), same group,
    // same lazy creation. `vendorTypeOf` tells them apart client-side.
    queryFn: () =>
      ledgerApi.chartOfAccounts({
        kind: "PARTY",
        group: "SUNDRY_CREDITOR",
        isActive: true,
        search: debouncedSearch || undefined,
      }),
    enabled: kind === "creditor",
  });

  const otherQuery = useQuery({
    queryKey: ["ledger", "party-picker", kind, debouncedSearch],
    queryFn: async (): Promise<ComboboxOption[]> => {
      if (kind === "customer") {
        const { data } = await customerApi.list({ page: 0, size: 20, search: debouncedSearch || undefined });
        return data.map((row) => ({ label: row.name, value: row.id }));
      }
      const { data } = await cashAccountApi.list({
        page: 0,
        size: 20,
        search: debouncedSearch || undefined,
        filter: { type: kind === "account-bank" ? "BANK" : "CASH" },
      });
      return data.map((row) => ({ label: row.name, value: row.id }));
    },
    enabled: kind !== "creditor",
  });

  const creditorAccounts = React.useMemo(() => {
    const accounts = creditorQuery.data ?? [];
    if (creditorTypeFilter === "ALL") return accounts;
    return accounts.filter((a) =>
      creditorTypeFilter === "NON_VENDOR"
        ? vendorTypeOf(a) === null
        : vendorTypeOf(a) === creditorTypeFilter,
    );
  }, [creditorQuery.data, creditorTypeFilter]);

  const options: ComboboxOption[] =
    kind === "creditor"
      ? creditorAccounts.map((row) => ({ label: row.name, value: row.id }))
      : (otherQuery.data ?? []);

  const handleChange = (id: string) => {
    onChange(id);
    if (kind === "creditor")
      onSelectAccount?.(creditorAccounts.find((a) => a.id === id) ?? null);
  };

  return (
    <Combobox
      options={options}
      value={value}
      onChange={handleChange}
      searchValue={search}
      onSearchChange={setSearch}
      placeholder={placeholderFor[kind]}
      searchPlaceholder="Search..."
    />
  );
}
