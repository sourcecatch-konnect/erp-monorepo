"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Customer } from "@skerp/types";

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
import { createCustomerSchema } from "@skerp/validators";

import getErrorMessage, { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import CustomerAdvancedForm from "./customerForm";
import CustomerDetailDialog from "./customerDialog";
import { toast } from "sonner";
import { DropdownMenuItem } from "@skerp/ui/components/dropdown";
import { IconMapPin } from "@tabler/icons-react";
import CustomerPickupLocationDialog from "./pickuplocationDialog";

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
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailId, setDetailId] = React.useState<string | null>(null);
  const [size, setSize] = React.useState(10);
  const [pickupLocationOpen, setPickupLocationOpen] = React.useState(false);
const [pickupLocationCustomer, setPickupLocationCustomer] =
  React.useState<Customer | null>(null);
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
    [debouncedSearch, page, size]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  const customers = useQuery({
    queryKey: customerKeys.list(listQuery),
    queryFn: () => customerApi.list(listQuery),
  });


const { remove } = useMasterMutations({
  api: customerApi,
  queryKey: customerKeys.all,
  entityName: "Customer",
});

const bulkRemove = useMutation({
  mutationFn: customerApi.bulkRemove,
  onSuccess: () => {
    toast.success("Selected customers deleted successfully");

    setSelectedIds([]);

    queryClient.invalidateQueries({
      queryKey: customerKeys.all,
    });
  },

  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});

 const bulkImport = useMutation({
  mutationFn: customerApi.bulkImport,

  onSuccess: () => {
    toast.success("Customers imported successfully");

    queryClient.invalidateQueries({
      queryKey: customerKeys.all,
    });
  },

  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});

 const exportCustomers = useMutation({
  mutationFn: customerApi.export,

  onSuccess: (blob) => {
    downloadBlob(blob, "customers.csv");

    toast.success("Customers exported successfully");
  },

  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});



  return (
    <MasterListPage
      title="Customers"
      data={customers.data?.data ?? []}
      columns={customerColumns}
      isLoading={customers.isLoading}
      onSizeChange={setSize}
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
      extraRowActions={(row) => (
  <DropdownMenuItem
    onClick={() => {
      setPickupLocationCustomer(row);
      setPickupLocationOpen(true);
    }}
  >
    <IconMapPin size={16} className="mr-2" />
    Add Pickup Location
  </DropdownMenuItem>
)}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
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
<CustomerDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>
<CustomerPickupLocationDialog
  open={pickupLocationOpen}
  onOpenChange={setPickupLocationOpen}
  customer={pickupLocationCustomer}
/>
<CustomerAdvancedForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
/>
    </MasterListPage>
  );
}