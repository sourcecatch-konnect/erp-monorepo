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

import MasterFormDialog from "../_shared/MasterFormDialog";
import SelectField from "../_shared/fields/SelectField";
import TextField from "../_shared/fields/TextField";
import { createTransportSchema } from "@skerp/validators";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Transport | null;
  states: State[];
  cities: City[];
  onSubmit: (data: CreateTransportBody) => Promise<void>;
  isSubmitting?: boolean;
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
    defaultValues: {
      name: "",
      stateId: "",
      cityId: "",
      country: "",
      phoneNo: "",
    },
  });

  const selectedStateId = form.watch("stateId");

  const filteredCities = React.useMemo(() => {
    if (!selectedStateId) {
      return cities;
    }

    return cities.filter((city) => city.stateId === selectedStateId);
  }, [cities, selectedStateId]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

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
    >
      <TextField<CreateTransportBody>
        name="name"
        label="Transport Name"
        placeholder="Enter transport name"
        required
      />

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
        placeholder="Enter country"
        required
      />

      <TextField<CreateTransportBody>
        name="phoneNo"
        label="Phone Number"
        placeholder="Enter phone number"
        required
      />
    </MasterFormDialog>
  );
}