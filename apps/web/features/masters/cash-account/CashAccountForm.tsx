"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CashAccount,
  CreateCashAccountBody,
  CreateCashAccountFormInput,
} from "@skerp/types";
import { createCashAccountSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";
import SwitchField from "../_shared/fields/SwitchField";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { cashAccountApi } from "./cash-account.service";
import { cashAccountKeys } from "./cash-account.keys";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: CashAccount | null;
};

const typeOptions = [
  { label: "Bank", value: "BANK" },
  { label: "Cash in hand", value: "CASH" },
];

const defaultValues: CreateCashAccountFormInput = {
  name: "",
  type: "BANK",
  bankName: "",
  accountLast4: "",
  isActive: true,
};

export default function CashAccountForm({ open, onOpenChange, row }: Props) {
  const { create, update } = useMasterMutations({
    api: cashAccountApi,
    queryKey: cashAccountKeys.all,
    entityName: "Cash Account",
  });

  const form = useForm<CreateCashAccountFormInput, unknown, CreateCashAccountBody>(
    {
      resolver: zodResolver(createCashAccountSchema),
      defaultValues,
      mode: "onChange",
    },
  );

  const type = form.watch("type");

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      name: row?.name ?? "",
      type: row?.type ?? "BANK",
      bankName: row?.bankName ?? "",
      accountLast4: row?.accountLast4 ?? "",
      isActive: row?.isActive ?? true,
    });
  }, [form, open, row]);

  const handleSubmit = async (data: CreateCashAccountBody) => {
    if (row) {
      await update.mutateAsync({ id: row.id, data });
    } else {
      await create.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <MasterFormDialog<CreateCashAccountFormInput, CreateCashAccountBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Cash Account" : "Add Cash Account"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      columns={2}
    >
      <TextField<CreateCashAccountFormInput>
        name="name"
        label="Account Name"
        placeholder="e.g. ICICI ...1234 / Cash – Jalgaon"
        required
      />

      <SelectField<CreateCashAccountFormInput>
        name="type"
        label="Type"
        options={typeOptions}
        required
      />

      {type === "BANK" ? (
        <>
          <TextField<CreateCashAccountFormInput>
            name="bankName"
            label="Bank Name"
            placeholder="e.g. ICICI Bank"
          />
          <TextField<CreateCashAccountFormInput>
            name="accountLast4"
            label="Account Number (last 4)"
            placeholder="1234"
          />
        </>
      ) : null}

      <SwitchField<CreateCashAccountFormInput> name="isActive" label="Active" />
    </MasterFormDialog>
  );
}
