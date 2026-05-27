"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  RateMatrix,
  CreateRateMatrixBody,
  CreateRateMatrixFormInput,
} from "@skerp/types";

import { createRateMatrixSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import {
  IconRoute,
  IconFileInvoice,
  IconCurrencyRupee,
  IconClock,
  IconNote,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: RateMatrix | null;
  onSubmit: (data: CreateRateMatrixBody) => Promise<void>;
  isSubmitting?: boolean;

  agreements: { id: string; name?: string }[];
  routes: { id: string; name?: string }[];
};

const defaultValues: CreateRateMatrixFormInput = {
  agreementId: "",
  routeId: "",
  rate: "",
  transitDays: "",
  remarks: "",
};

export default function RateMatrixForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
  agreements,
  routes,
}: Props) {
  const form = useForm<CreateRateMatrixFormInput, unknown, CreateRateMatrixBody>(
    {
      resolver: zodResolver(createRateMatrixSchema),
      defaultValues,
    }
  );

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      agreementId: row?.agreementId ?? "",
      routeId: row?.routeId ?? "",
      rate: row?.rate != null ? String(row.rate) : "",
      transitDays: row?.transitDays != null ? String(row.transitDays) : "",
      remarks: row?.remarks ?? "",
    });
  }, [open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Rate Matrix" : "Add Rate Matrix"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* RELATIONS */}
      <FormSection
        icon={<IconFileInvoice size={18} />}
        title="Agreement & Route"
        description="Link rate to agreement and route"
      >
        <SelectField
          name="agreementId"
          label="Agreement"
          options={agreements.map((a) => ({
            label: a.name ?? a.id,
            value: a.id,
          }))}
        />

        <SelectField
          name="routeId"
          label="Route"
          options={routes.map((r) => ({
            label: r.name ?? r.id,
            value: r.id,
          }))}
        />
      </FormSection>

      {/* PRICING */}
      <FormSection
        icon={<IconCurrencyRupee size={18} />}
        title="Pricing"
        description="Rate details per route"
      >
        <IconTextField
          name="rate"
          label="Rate"
          type="number"
          placeholder="Enter freight rate"
          icon={<IconCurrencyRupee size={16} />}
          required
        />
      </FormSection>

      {/* LOGISTICS */}
      <FormSection
        icon={<IconClock size={18} />}
        title="Transit Details"
        description="Delivery timing information"
      >
        <IconTextField
          name="transitDays"
          label="Transit Days"
          type="number"
          placeholder="e.g. 2 or 5 days"
          icon={<IconClock size={16} />}
        />
      </FormSection>

      {/* NOTES */}
      <FormSection
        icon={<IconNote size={18} />}
        title="Remarks"
        description="Optional additional information"
      >
        <IconTextField
          name="remarks"
          label="Remarks"
          placeholder="Any notes about this rate"
          icon={<IconNote size={16} />}
        />
      </FormSection>
    </MasterFormDialog>
  );
}