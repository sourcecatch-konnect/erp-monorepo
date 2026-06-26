"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";

import type {
  Creditor,
  CreateCreditorBody,
  CreateCreditorFormInput,
} from "@skerp/types";
import { createCreditorSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import SwitchField from "../_shared/fields/SwitchField";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { paiseToRupees } from "@/lib/money";
import { branchApi } from "../branch/branch.service";
import { branchKeys } from "../branch/branch.key";
import { creditorApi } from "./creditor.service";
import { creditorKeys } from "./creditor.keys";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Creditor | null;
};

const categoryOptions = [
  { label: "Diesel", value: "DIESEL" },
  { label: "Rent", value: "RENT" },
  { label: "Freight", value: "FREIGHT" },
  { label: "Expense", value: "EXPENSE" },
  { label: "Repair", value: "REPAIR" },
  { label: "Other", value: "OTHER" },
];

const modeOptions = [
  { label: "Cash", value: "CASH" },
  { label: "Bank", value: "BANK" },
  { label: "UPI", value: "UPI" },
  { label: "Cheque", value: "CHEQUE" },
];

const defaultValues: CreateCreditorFormInput = {
  name: "",
  category: "OTHER",
  defaultMode: undefined,
  branchId: "",
  phone: "",
  outstandingBalance: "",
  isActive: true,
};

export default function CreditorForm({ open, onOpenChange, row }: Props) {
  const { data: branchData } = useQuery({
    queryKey: branchKeys.list({ page: 0, size: 100 }),
    queryFn: () => branchApi.list({ page: 0, size: 100 }),
    enabled: open,
  });
  const branches = branchData?.data ?? [];

  const { create, update } = useMasterMutations({
    api: creditorApi,
    queryKey: creditorKeys.all,
    entityName: "Creditor",
  });

  const form = useForm<CreateCreditorFormInput, unknown, CreateCreditorBody>({
    resolver: zodResolver(createCreditorSchema),
    defaultValues,
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      name: row?.name ?? "",
      category: row?.category ?? "OTHER",
      defaultMode: row?.defaultMode ?? undefined,
      branchId: row?.branchId ?? "",
      phone: row?.phone ?? "",
      outstandingBalance:
        row?.outstandingBalance != null
          ? String(paiseToRupees(row.outstandingBalance))
          : "",
      isActive: row?.isActive ?? true,
    });
  }, [form, open, row]);

  const handleSubmit = async (data: CreateCreditorBody) => {
    if (row) {
      await update.mutateAsync({ id: row.id, data });
    } else {
      await create.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <MasterFormDialog<CreateCreditorFormInput, CreateCreditorBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Creditor" : "Add Creditor"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      columns={2}
    >
      <TextField<CreateCreditorFormInput>
        name="name"
        label="Creditor Name"
        placeholder="e.g. Bharat Petroleum"
        required
      />

      <SelectField<CreateCreditorFormInput>
        name="category"
        label="Category"
        options={categoryOptions}
        required
      />

      <SelectField<CreateCreditorFormInput>
        name="defaultMode"
        label="Default Payment Mode"
        placeholder="Select mode"
        options={modeOptions}
      />

      <SelectField<CreateCreditorFormInput>
        name="branchId"
        label="Default Branch"
        placeholder="Select branch"
        options={branches.map((b) => ({ label: b.name, value: b.id }))}
      />

      <TextField<CreateCreditorFormInput>
        name="phone"
        label="Phone"
        placeholder="10-digit phone"
      />

      <TextField<CreateCreditorFormInput>
        name="outstandingBalance"
        label="Outstanding (₹)"
        placeholder="0.00"
      />

      <SwitchField<CreateCreditorFormInput> name="isActive" label="Active" />
    </MasterFormDialog>
  );
}
