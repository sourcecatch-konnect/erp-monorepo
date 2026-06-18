"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Labour,
  City,
  Branch,
  CreateLabourBody,
  CreateLabourFormInput,
  LabourWithRelations,
} from "@skerp/types";

import { createLabourSchema } from "@skerp/validators";
import { paiseToRupees } from "@/lib/money";

import {
  IconUser,
  IconPhone,
  IconMapPin,
  IconBuilding,
  IconCash,
  IconCalendar,
  IconFileDescription,
  IconPercentage,
} from "@tabler/icons-react";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";
import TextAreaField from "../_shared/fields/TextAreaField";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { labourApi } from "./labour.service";
import { labourKeys } from "./labour.key";
import { branchApi } from "../branch/branch.service";
import { branchKeys } from "../branch/branch.key";
import { useQuery } from "@tanstack/react-query";
import CitySelectField from "../_shared/fields/CitySelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: LabourWithRelations | null;
};

const defaultValues: CreateLabourFormInput = {
  name: "",
  photoPath: "",
  address: "",
  cityId: "",
  contactName: "",
  contactPhone: "",
  mobileNo: "",

  referredBy: "",
  refContactNo: "",

  startDate: "",

  pan: "",

  tdsAmount: "",
  tdsRate: "",

  type: "Hamal",
  branchId: "",
};

export default function LabourAdvancedForm({
  open,
  onOpenChange,
  row,
}: Props) {
  const form = useForm<
    CreateLabourFormInput,
    unknown,
    CreateLabourBody
  >({
    resolver: zodResolver(
      createLabourSchema
    ),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues,
  });


const branches = useQuery({
  queryKey: branchKeys.list({ page: 0, size: 1000 }),
  queryFn: () => branchApi.list({ page: 0, size: 1000 }),
  enabled: open,
});

const { create, update } = useMasterMutations({
  api: labourApi,
  queryKey: labourKeys.all,
  entityName: "Labour",
});

const handleSubmit = async (data: CreateLabourBody) => {
  if (row) {
    await update.mutateAsync({ id: row.id, data });
  } else {
    await create.mutateAsync(data);
  }

  onOpenChange(false);
};

const isSubmitting = create.isPending || update.isPending;
  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      photoPath:
        row?.photoPath ?? "",

      address:
        row?.address ?? "",

      cityId:
        row?.cityId ?? "",

      contactName:
        row?.contactName ?? "",

      contactPhone:
        row?.contactPhone ?? "",

      mobileNo:
        row?.mobileNo ?? "",

      referredBy:
        row?.referredBy ?? "",

      refContactNo:
        row?.refContactNo ?? "",

      startDate:
        row?.startDate
          ? new Date(
              row.startDate
            )
              .toISOString()
              .split("T")[0]
          : "",

      pan: row?.pan ?? "",

      tdsAmount:
        row?.tdsAmount != null
          ? String(
              paiseToRupees(row.tdsAmount)
            )
          : "",

      tdsRate:
        row?.tdsRate != null
          ? String(
              row.tdsRate
            )
          : "",

      type:
        row?.type ??
        "Hamal",

      branchId:
        row?.branchId ?? "",
    });
  }, [open, row, form]);

const branchOptions = (branches.data?.data ?? []).map((branch) => ({
  label: branch.name,
  value: branch.id,
}));
  return (
    <MasterFormDialog<
      CreateLabourFormInput,
      CreateLabourBody
    >
      open={open}
      onOpenChange={
        onOpenChange
      }
      title={
        row
          ? "Edit Labour"
          : "Add Labour"
      }
      form={form}
      onSubmit={
        handleSubmit
      }
      isSubmitting={
        isSubmitting
      }
      columns={3}
    >
      <FormSection
        icon={
          <IconUser
            size={18}
          />
        }
        title="Labour Details"
        description="Basic labour information"
      >
        <IconTextField<CreateLabourFormInput>
          name="name"
          label="Name"
          placeholder="Enter name"
          icon={
            <IconUser size={16}/>
          }
          required
        />

        <SelectField<CreateLabourFormInput>
          name="type"
          label="Worker Type"
          required
          options={[
            {
              label:
                "Supervisor",
              value:
                "Supervisor",
            },
            {
              label:
                "Hamal",
              value:
                "Hamal",
            },
            {
              label:
                "Mechanic",
              value:
                "Mechanic",
            },
          ]}
        />

        <SelectField<CreateLabourFormInput>
          name="branchId"
          label="Branch"
          options={
            branchOptions
          }
          required
        />
      </FormSection>

      <FormSection
        icon={
          <IconPhone
            size={18}
          />
        }
        title="Contact Details"
        description="Contact information"
      >
        <IconTextField<CreateLabourFormInput>
          name="contactName"
          label="Contact Name"
          placeholder="Contact person"
          icon={
            <IconUser size={16}/>
          }
        />

        <IconTextField<CreateLabourFormInput>
          name="contactPhone"
          label="Phone"
          placeholder="10-digit phone"
          maxLength={10}
          icon={
            <IconPhone size={16}/>
          }
        />

        <IconTextField<CreateLabourFormInput>
          name="mobileNo"
          label="Mobile"
          placeholder="10-digit phone"
          maxLength={10}
          icon={
            <IconPhone size={16}/>
          }
        />
      </FormSection>

      <FormSection
        icon={
          <IconMapPin
            size={18}
          />
        }
        title="Address"
        description="Address details"
      >
      <CitySelectField<CreateLabourFormInput>
  name="cityId"
  label="City"
  required
  initialCity={
    row?.city
      ? {
          id: row.city.id,
          name: row.city.name,
        }
      : null
  }
/>

        <div className="col-span-2">
          <TextAreaField<CreateLabourFormInput>
            name="address"
            label="Address"
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection
        icon={
          <IconBuilding
            size={18}
          />
        }
        title="Reference Details"
        description="Reference information"
      >
        <IconTextField<CreateLabourFormInput>
          name="referredBy"
          label="Referred By"
          placeholder="Reference name"
          icon={
            <IconUser size={16}/>
          }
        />
 
        <IconTextField<CreateLabourFormInput>
          name="refContactNo"
          label="Reference Contact"
          placeholder="Phone"
          maxLength={10}
          icon={
            <IconPhone size={16}/>
          }
        />
      </FormSection>

      <FormSection
        icon={
          <IconCash
            size={18}
          />
        }
        title="Finance Details"
        description="PAN and TDS details"
      >
        <IconTextField<CreateLabourFormInput>
          name="pan"
          label="PAN"
          placeholder="ABCDE1234F"
          maxLength={10}
          onChangeTransform={(v)=>
            v.toUpperCase()
          }
          icon={
            <IconFileDescription size={16}/>
          }
          hint="10-character PAN"
        />
          
      

       <IconTextField<CreateLabourFormInput>
  name="tdsAmount"
  label="TDS Amount"
  type="number"
  placeholder="Enter TDS amount"
  icon={<IconCash size={16} />}
/>

<IconTextField<CreateLabourFormInput>
  name="tdsRate"
  label="TDS Rate"
  type="number"
  placeholder="Enter TDS rate"
  suffix="%"
  icon={<IconPercentage size={16} />}
/>
      </FormSection>

      <FormSection
        icon={
          <IconCalendar
            size={18}
          />
        }
        title="Employment"
        description="Joining details"
      >
<Controller
  control={form.control}
  name="startDate"
  render={({ field }) => (
    <DatePicker
      label="Start Date"
      selected={field.value ? new Date(field.value) : undefined}
      onSelect={(d) =>
        field.onChange(d ? d.toISOString().slice(0, 10) : undefined)
      }
    />
  )}
/>
      </FormSection>
    </MasterFormDialog>
  );
}
