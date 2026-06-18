"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateTransportBody,
  Transport,
} from "@skerp/types";

import { createTransportSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import SelectField from "../_shared/fields/SelectField";

import { IconPhone, IconTruck, IconTruckDelivery, IconWorld } from "@tabler/icons-react";
import IconTextField from "../_shared/fields/IconTextField";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { useQuery } from "@tanstack/react-query";

import { stateApi } from "../state/state.service";
import { stateKeys } from "../state/state.keys";
import { transportKeys } from "./transport.key";
import { transportApi } from "./transport.service";
import CitySelectField from "../_shared/fields/CitySelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Transport | null;
};

const defaultValues: CreateTransportBody = {
  name: "",
  stateId: "",
  cityId: "",
  country: "India",
  phoneNo: "",
};

export default function TransportForm({
  open,
  onOpenChange,
  row,
}: Props) {
  const form = useForm<CreateTransportBody>({
    resolver: zodResolver(createTransportSchema),
    defaultValues,
  });
const states = useQuery({
  queryKey: stateKeys.list({ page: 0, size: 35 }),
  queryFn: () => stateApi.list({ page: 0, size: 35 }),
  enabled: open,
});


const { create, update } = useMasterMutations({
  api: transportApi,
  queryKey: transportKeys.all,
});

const handleSubmit = async (data: CreateTransportBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};

const isSubmitting = create.isPending || update.isPending;



const selectedStateId = form.watch("stateId");
const previousStateIdRef = React.useRef<string>("");

React.useEffect(() => {
  if (!open) return;

  const previousStateId = previousStateIdRef.current;

  if (previousStateId && previousStateId !== selectedStateId) {
    form.setValue("cityId", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  previousStateIdRef.current = selectedStateId;
}, [form, open, selectedStateId]);

React.useEffect(() => {
  if (!open) return;

  form.reset({
    name: row?.name ?? "",
    stateId: row?.stateId ?? "",
    cityId: row?.cityId ?? "",
    country: "India",
    phoneNo: row?.phoneNo ?? "",
  });

  previousStateIdRef.current = row?.stateId ?? "";
}, [form, open, row]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Transport" : "Add Transport"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* TRANSPORT INFO */}
      <FormSection
        icon={<IconTruck size={18} />}
        title="Transport Information"
        description="Basic transport and contact details"
      >
       <IconTextField<CreateTransportBody>
  name="name"
  label="Transport Name"
  placeholder="e.g. ABC Logistics"
  icon={<IconTruckDelivery size={16} />}
  required
/>
          <IconTextField<CreateTransportBody>
                  name="phoneNo"
                  label="Phone Number"
                  placeholder="10-digit phone"
                  icon={<IconPhone size={16} />}
                  maxLength={10}
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
         options={(states.data?.data ?? []).map((state) => ({
  label: state.name,
  value: state.id,
}))}
          required
        />

      <CitySelectField<CreateTransportBody>
  name="cityId"
  label="City"
  required
  disabled={!selectedStateId}
  stateId={selectedStateId}
  placeholder={selectedStateId ? "Select city" : "Select state first"}
  initialCity={
    row?.city
      ? {
          id: row.city.id,
          name: row.city.name,
        }
      : null
  }
/>

        <IconTextField<CreateTransportBody>
          name="country"
          label="Country"
          placeholder="e.g. India"
          icon={<IconWorld size={16} />}
          required
        />
      </FormSection>

      {/* FUTURE EXTENSION */}
      {/* <FormSection
        icon={<IconTruck size={18} />}
        title="Advanced Settings"
        description="Optional transport configuration"
      >
        <TextField<CreateTransportBody>
          name="name"
          label="Transport Code (future use)"
          placeholder="e.g. TRP-001"
        />
      </FormSection> */}
    </MasterFormDialog>
  );
}