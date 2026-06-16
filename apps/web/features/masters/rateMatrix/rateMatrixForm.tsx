"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  RateMatrix,
  RateUnit,
  VehicleType,
  CreateRateMatrixBody,
  CreateRateMatrixFormInput,
} from "@skerp/types";

import { createRateMatrixSchema } from "@skerp/validators";
import { rateMatrixApi } from "./rateMatrix.service";
import { paiseToRupees } from "@/lib/money";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import {
  IconFileInvoice,
  IconCurrencyRupee,
  IconClock,
  IconNote,
  IconTruck,
  IconPackage,
  IconPlus,
  IconX,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: RateMatrix | null;
  onSubmit: (data: CreateRateMatrixBody) => Promise<void>;
  isSubmitting?: boolean;

  vehicleTypes: VehicleType[];
  rateUnits: RateUnit[];

  agreements: { id: string; name?: string }[];
  routes: { id: string; name?: string }[];
};

const defaultValues: CreateRateMatrixFormInput = {
  agreementId: "",
  routeId: "",
  vehicleTypeId: "",
  unitId: "",
  transportType: "ROAD",
  rate: "",
  transitDays: "",
  remarks: "",
};

type UnitType = "HQ" | "LQ";

function getCreatedUnitId(response: unknown): string | null {
  if (
    response &&
    typeof response === "object" &&
    "id" in response &&
    typeof (response as { id?: unknown }).id === "string"
  ) {
    return (response as { id: string }).id;
  }

  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    (response as { data?: unknown }).data &&
    typeof (response as { data?: unknown }).data === "object" &&
    "id" in ((response as { data: unknown }).data as object)
  ) {
    const data = (response as { data: { id?: unknown } }).data;
    return typeof data.id === "string" ? data.id : null;
  }

  return null;
}

export default function RateMatrixForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
  agreements,
  routes,
  vehicleTypes,
  rateUnits,
}: Props) {
  const queryClient = useQueryClient();

  const [showUnitFields, setShowUnitFields] = React.useState(false);
  const [unitValue, setUnitValue] = React.useState("");
  const [unitType, setUnitType] = React.useState<UnitType>("HQ");
  const [unitError, setUnitError] = React.useState<string | null>(null);

const form = useForm<CreateRateMatrixFormInput>({
  resolver: zodResolver(createRateMatrixSchema),
  defaultValues,
  mode: "onChange",
  reValidateMode: "onChange",
});
const selectedVehicleTypeId = form.watch("vehicleTypeId");

const selectedVehicleType = React.useMemo(
  () => vehicleTypes.find((v) => v.id === selectedVehicleTypeId),
  [vehicleTypes, selectedVehicleTypeId]
);

const isContainerVehicle =
  selectedVehicleType?.name?.trim().toLowerCase() === "container";
const handleFormSubmit: SubmitHandler<CreateRateMatrixFormInput> =
  async (data) => {
    const payload: CreateRateMatrixBody = {
      ...data,
      rate: Number(data.rate),
      transitDays: data.transitDays
        ? Number(data.transitDays)
        : undefined,
    };

    if (isContainerVehicle && !payload.unitId) {
      form.setError("unitId", {
        type: "manual",
        message: "Unit is required for Container vehicle type",
      });
      return;
    }

    if (!isContainerVehicle) {
      payload.unitId = undefined;
    }

    await onSubmit(payload);
  };
  const createUnitMutation = useMutation({
    mutationFn: (data: { unitValue: number; unitType: UnitType }) =>
      rateMatrixApi.units.create(data),

    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ["rateMatrix", "units"],
      });

      const createdUnitId = getCreatedUnitId(response);

      if (createdUnitId) {
        form.setValue("unitId", createdUnitId, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }

      setUnitValue("");
      setUnitType("HQ");
      setUnitError(null);
      setShowUnitFields(false);
    },
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      agreementId: row?.agreementId ?? "",
      routeId: row?.routeId ?? "",
      vehicleTypeId: row?.vehicleTypeId ?? "",
      unitId: row?.unitId ?? "",
      transportType: row?.transportType ?? "ROAD",
      rate: row?.rate != null ? String(paiseToRupees(row.rate)) : "",
      transitDays: row?.transitDays != null ? String(row.transitDays) : "",
      remarks: row?.remarks ?? "",
    });

    setShowUnitFields(false);
    setUnitValue("");
    setUnitType("HQ");
    setUnitError(null);
  }, [form, open, row]);

React.useEffect(() => {
  if (!isContainerVehicle) {
    form.setValue("unitId", "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    setShowUnitFields(false);
    setUnitValue("");
    setUnitType("HQ");
    setUnitError(null);
  }
}, [isContainerVehicle, form]);
  const handleAddUnit = async () => {
    const trimmedValue = unitValue.trim();
    const value = Number(trimmedValue);

    if (!trimmedValue || Number.isNaN(value) || value <= 0) {
      setUnitError("Please enter a valid unit value.");
      return;
    }

    const alreadyExists = rateUnits.some((unit) => {
      const existingValue = Number(unit.unitValue);
      const existingType = String(unit.unitType).trim().toUpperCase();

      return existingValue === value && existingType === unitType;
    });

    if (alreadyExists) {
      setUnitError(
        `${value} ${unitType} already exists. Please select it from the dropdown instead of adding it again.`
      );
      return;
    }

    setUnitError(null);

    await createUnitMutation.mutateAsync({
      unitValue: value,
      unitType,
    });
  };

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Rate Matrix" : "Add Rate Matrix"}
      form={form}
      onSubmit={handleFormSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      <FormSection
        icon={<IconFileInvoice size={18} />}
        title="Agreement & Route"
        description="Link rate to agreement and route"
      >
        <SelectField
          name="agreementId"
          label="Agreement"
          required
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

      <FormSection
        icon={<IconTruck size={18} />}
        title="Vehicle & Transport"
        description="Vehicle type and transport mode"
      >
        <SelectField
          name="vehicleTypeId"
          label="Vehicle Type"
          options={vehicleTypes.map((v) => ({
            label: v.name,
            value: v.id,
          }))}
        />

        <SelectField
          name="transportType"
          label="Transport Type"
          options={[
            {
              label: "Rail/Road",
              value: "RAIL_ROAD",
            },
            {
              label: "Road",
              value: "ROAD",
            },
          ]}
        />
      </FormSection>

     {isContainerVehicle ? (
      <div className="col-span-1 md:col-span-2">
        <FormSection
          icon={<IconPackage size={18} />}
          title="Unit"
          description="Select or add HQ/LQ unit for this rate"
          columns={2}
        >
          <div className="col-span-full">
            <SelectField
              name="unitId"
              label="Unit"
              options={rateUnits.map((unit) => ({
                label: `${unit.unitValue} ${unit.unitType}`,
                value: unit.id,
              }))}
            />
          </div>

          {!showUnitFields ? (
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Additional unit setup
                  </p>
                  <p className="text-xs text-slate-500">
                    Add a new HQ/LQ unit if it is not available in the dropdown.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUnitFields(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <IconPlus size={14} />
                  Add Unit
                </button>
              </div>
            </div>
          ) : (
            <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Add New Unit
                  </p>
                  <p className="text-xs text-slate-500">
                    Create a new HQ/LQ unit without leaving this form.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowUnitFields(false);
                    setUnitValue("");
                    setUnitType("HQ");
                    setUnitError(null);
                  }}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                >
                  <IconX size={14} />
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Unit Value
                  </label>

                  <input
                    value={unitValue}
                    onChange={(event) => {
                      setUnitValue(event.target.value);
                      setUnitError(null);
                    }}
                    placeholder="Enter unit value"
                    type="number"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Unit Type
                  </label>

                  <select
                    value={unitType}
                    onChange={(event) => {
                      setUnitType(event.target.value as UnitType);
                      setUnitError(null);
                    }}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="HQ">HQ</option>
                    <option value="LQ">LQ</option>
                  </select>
                </div>
              </div>

              {unitError ? (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {unitError}
                </p>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddUnit}
                  disabled={createUnitMutation.isPending}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createUnitMutation.isPending ? "Adding..." : "Save Unit"}
                </button>
              </div>
            </div>
          )}
        </FormSection>
      </div>
) : null}
      <FormSection
        icon={<IconCurrencyRupee size={18} />}
        title="Pricing & Transit"
        description="Rate and delivery timing details"
        columns={2}
      >
        <IconTextField
          name="rate"
          label="Rate"
          type="number"
          placeholder="Enter freight rate"
          icon={<IconCurrencyRupee size={16} />}
          required
        />

        <IconTextField
          name="transitDays"
          label="Transit Days"
          type="number"
          placeholder="e.g. 2 or 5 days"
          icon={<IconClock size={16} />}
        />
      </FormSection>
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
