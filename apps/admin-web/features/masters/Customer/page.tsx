"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCustomerBody, Customer } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { customerApi } from "./customer.service";
import { customerKeys } from "./customer.key";
import { customerColumns } from "./customerTable";
import CustomerForm from "./customerForm";
import { createCustomerSchema } from "@skerp/validators";

import { stateApi } from "../state/state.service";
import { cityApi } from "../city/city.service";
import { stateKeys } from "../state/state.keys";
import { cityKeys } from "../city/city.keys";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";


type CustomerCsvRow = Record<
  | "name"
  | "shortName"
  | "customerPAN"
  | "disallowNewLRBooking"
  | "interestRateLatePayment"
  | "gstNo"
  | "creditLimit"
  | "tdsDeductionRate"
  | "address"
  | "country"
  | "stateId"
  | "cityId"
  | "contactPhone"
  | "primaryEmail"
  | "contactPerson"
  | "mobileNo"
  | "website",
  string
>;

export default function CustomerPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Customer | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const size = 25;
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    }),
    [debouncedSearch, page]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const customers = useQuery({
    queryKey: customerKeys.list(listQuery),
    queryFn: () => customerApi.list(listQuery),
  });

  const states = useQuery({
    queryKey: stateKeys.list({ size: 1000 }),
    queryFn: () => stateApi.list({ size: 1000 }),
  });

  const cities = useQuery({
    queryKey: cityKeys.list({ size: 1000 }),
    queryFn: () => cityApi.list({ size: 1000 }),
  });

 const { create, update, remove } = useMasterMutations({
  api: customerApi,
  queryKey: customerKeys.all,
});

  const bulkRemove = useMutation({
    mutationFn: customerApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: customerApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });

  const exportCustomers = useMutation({
    mutationFn: customerApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "customers.csv");
    },
  });

  const handleSubmit = async (data: CreateCustomerBody) => {
    if (selected) {
      await update.mutateAsync({ id: selected.id, data });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  };

  return (
    <MasterListPage
      title="Customers"
      data={customers.data?.data ?? []}
      columns={customerColumns}
      isLoading={customers.isLoading}
      defaultHiddenColumns={[
        "address",
        "country",
        "contactPhone",
        "website",
        "interestRateLatePayment",
        "tdsDeductionRate",
        "createdAt",
        "updatedAt",
      ]}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={customers.data?.meta?.total ?? 0}
      onPageChange={setPage}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      onAdd={() => {
        setSelected(null);
        setOpen(true);
      }}
      onEdit={(row) => {
        setSelected(row);
        setOpen(true);
      }}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();

        const rows = parseCsvRows<CustomerCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createCustomerSchema.parse({
            ...row,
            country: row.country || "India",
            disallowNewLRBooking:
              row.disallowNewLRBooking === "true" ||
              row.disallowNewLRBooking === "Yes" ||
              row.disallowNewLRBooking === "yes",
          })
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportCustomers.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportCustomers.isPending}
    >
      <CustomerForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        states={states.data?.data ?? []}
        cities={cities.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}