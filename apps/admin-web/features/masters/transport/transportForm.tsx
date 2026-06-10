"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  City,
  CreateTransportBody,
  State,
  Transport,
} from "@skerp/types";

import { createTransportSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

import { IconTruck } from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Transport | null;
  states: State[];
  cities: City[];
  onSubmit: (data: CreateTransportBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateTransportBody = {
  name: "",
  stateId: "",
  cityId: "",
  country: "",
  phoneNo: "",
};

export default function TransportForm({
  open,
  onOpenChange,
  row,
  states,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateTransportBody>({
    resolver: zodResolver(createTransportSchema),
    defaultValues,
  });

  const selectedStateId = form.watch("stateId");

  const filteredCities = React.useMemo(() => {
    if (!selectedStateId) return cities;
    return cities.filter((city) => city.stateId === selectedStateId);
  }, [cities, selectedStateId]);

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      stateId: row?.stateId ?? "",
      cityId: row?.cityId ?? "",
      country: row?.country ?? "",
      phoneNo: row?.phoneNo ?? "",
    });
  }, [form, open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Transport" : "Add Transport"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* TRANSPORT INFO */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Transport Information"
        description="Basic transport and contact details"
      >
        <TextField<CreateTransportBody>
          name="name"
          label="Transport Name"
          placeholder="e.g. ABC Logistics"
          required
        />

        <TextField<CreateTransportBody>
          name="phoneNo"
          label="Phone Number"
          placeholder="Enter phone number"
          required
        />
      </FormSection>

      {/* LOCATION INFO */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Location Details"
        description="State, city and country information"
      >
        <SelectField<CreateTransportBody>
          name="stateId"
          label="State"
          options={states.map((state) => ({
            label: state.name,
            value: state.id,
          }))}
          required
        />

        <SelectField<CreateTransportBody>
          name="cityId"
          label="City"
          options={filteredCities.map((city) => ({
            label: city.name,
            value: city.id,
          }))}
          required
        />

        <TextField<CreateTransportBody>
          name="country"
          label="Country"
          placeholder="e.g. India"
          required
        />
      </FormSection>

      {/* FUTURE EXTENSION */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Advanced Settings"
        description="Optional transport configuration"
      >
        <TextField<CreateTransportBody>
          name="name"
          label="Transport Code (future use)"
          placeholder="e.g. TRP-001"
        />
      </FormSection>
    </MasterFormDialog>
  );
}