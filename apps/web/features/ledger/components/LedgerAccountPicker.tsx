"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";

import { ledgerApi } from "../api/ledger.service";
import { useDebouncedValue } from "../../masters/_shared/hooks/useDebouncedValue";

type Props = {
  value: string;
  onChange: (id: string) => void;
};

/** Search-as-you-type picker over the whole chart of accounts (GL heads and
 *  party ledgers alike) — used to pick a line's ledger in the Manual Journal
 *  editor. Only active ledgers are offered. */
export function LedgerAccountPicker({ value, onChange }: Props) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const query = useQuery({
    queryKey: ["ledger", "account-picker", debouncedSearch],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const rows = await ledgerApi.chartOfAccounts({
        search: debouncedSearch || undefined,
        isActive: true,
      });
      return rows.map((row) => ({
        label: row.code ? `${row.name} (${row.code})` : row.name,
        value: row.id,
      }));
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
      placeholder="Select ledger"
      searchPlaceholder="Search ledgers..."
    />
  );
}
