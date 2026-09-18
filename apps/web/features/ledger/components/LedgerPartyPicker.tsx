"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";

import { customerApi } from "../../masters/Customer/customer.service";
import { cashAccountApi } from "../../masters/cash-account/cash-account.service";
import { useDebouncedValue } from "../../masters/_shared/hooks/useDebouncedValue";
import { ledgerApi } from "../api/ledger.service";

export type LedgerPartyKind = "account-bank" | "account-cash" | "customer" | "creditor";

type Props = {
  kind: LedgerPartyKind;
  value: string;
  onChange: (id: string) => void;
};

const placeholderFor: Record<LedgerPartyKind, string> = {
  "account-bank": "Select bank account",
  "account-cash": "Select cash account",
  customer: "Select customer",
  creditor: "Select creditor",
};

/** Party/account picker for the 5 ledger reports — one Combobox, backed by
 * whichever master's search-as-you-type list applies to the active tab. */
export function LedgerPartyPicker({ kind, value, onChange }: Props) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const query = useQuery({
    queryKey: ["ledger", "party-picker", kind, debouncedSearch],
    queryFn: async (): Promise<ComboboxOption[]> => {
      if (kind === "customer") {
        const { data } = await customerApi.list({ page: 0, size: 20, search: debouncedSearch || undefined });
        return data.map((row) => ({ label: row.name, value: row.id }));
      }
      if (kind === "creditor") {
        // Every SUNDRY_CREDITOR party ledger — Creditor master rows AND
        // SparePartSupplier rows (getOrCreatePartyLedger lazily creates one
        // PARTY ledger per party the first time a voucher posts to them), so
        // Workshop's PO/Inward/Job Card/Service Bill postings to a supplier
        // show up here too, not just old-style Creditor payments.
        const data = await ledgerApi.chartOfAccounts({
          kind: "PARTY",
          group: "SUNDRY_CREDITOR",
          isActive: true,
          search: debouncedSearch || undefined,
        });
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
  });

  const options: ComboboxOption[] = query.data ?? [];

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      searchValue={search}
      onSearchChange={setSearch}
      placeholder={placeholderFor[kind]}
      searchPlaceholder="Search..."
    />
  );
}
