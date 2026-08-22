"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateRailwayFreightMatrixBody,
  CreateRailwayFreightMatrixFormInput,
  RailwayFreightMatrixWithRelations,
} from "@skerp/types";

import { createRailwayFreightMatrixSchema } from "@skerp/validators";
import { paiseToRupees } from "@/lib/money";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import { IconTrain, IconMapPin, IconCurrencyRupee } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { wagonApi } from "../wagon/wagon.service";
import { wagonKeys } from "../wagon/wagon.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { railwayFreightApi } from "./railwayfreight.service";
import { railwayFreightKeys } from "./railwayfreight.key";
import CitySelectField from "../_shared/fields/CitySelectField";
import { areaApi } from "../area/area.service";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: RailwayFreightMatrixWithRelations | null;
  preset?: RailwayFreightPreset | null;
  onSaved?: () => void | Promise<void>;
};

export type RailwayFreightPreset = {
  wagonId: string;
  wagonName: string;
  sourceCityId: string;
  sourceCityName: string;
  sourceAreaId: string;
  sourceAreaName: string;
  destinationCityId: string;
  destinationCityName: string;
  destinationAreaId: string;
  destinationAreaName: string;
};

const defaultValues: CreateRailwayFreightMatrixFormInput = {
  wagonId: "",
  sourceCityId: "",
  sourceAreaId: "",
  destinationCityId: "",
  destinationAreaId: "",
  freightAmount: "",
};
export default function RailwayFreightForm({
  open,
  onOpenChange,
  row,
  preset,
  onSaved,
}: Props) {
  const isPreset = Boolean(preset && !row);
  const form = useForm<
    CreateRailwayFreightMatrixFormInput,
    unknown,
    CreateRailwayFreightMatrixBody
  >({
    resolver: zodResolver(createRailwayFreightMatrixSchema),
    defaultValues,
  });

  const wagons = useQuery({
    queryKey: wagonKeys.list({ page: 0, size: 1000 }),
    queryFn: () => wagonApi.list({ page: 0, size: 1000 }),
    enabled: open && !isPreset,
  });

  const { create, update } = useMasterMutations({
    api: railwayFreightApi,
    queryKey: railwayFreightKeys.all,
    entityName: "Railway Freight",
  });

  const handleSubmit = async (data: CreateRailwayFreightMatrixBody) => {
    if (row) {
      await update.mutateAsync({ id: row.id, data });
    } else {
      await create.mutateAsync(data);
    }

    await onSaved?.();
    onOpenChange(false);
  };

  const isSubmitting = create.isPending || update.isPending;
  const previousSourceCityId = React.useRef("");
  const previousDestinationCityId = React.useRef("");
  const suppressSourceAreaReset = React.useRef(false);
  const suppressDestinationAreaReset = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;

    previousSourceCityId.current =
      row?.sourceCityId ?? preset?.sourceCityId ?? "";
    previousDestinationCityId.current =
      row?.destinationCityId ?? preset?.destinationCityId ?? "";
    suppressSourceAreaReset.current = true;
    suppressDestinationAreaReset.current = true;

    form.reset({
      wagonId: row?.wagonId ?? preset?.wagonId ?? "",
      sourceCityId: row?.sourceCityId ?? preset?.sourceCityId ?? "",
      sourceAreaId: row?.sourceAreaId ?? preset?.sourceAreaId ?? "",
      destinationCityId:
        row?.destinationCityId ?? preset?.destinationCityId ?? "",
      destinationAreaId:
        row?.destinationAreaId ?? preset?.destinationAreaId ?? "",
      freightAmount:
        row?.freightAmount != null
          ? String(paiseToRupees(row.freightAmount))
          : "",
    });
  }, [open, row, preset, form]);

  const sourceCityId = form.watch("sourceCityId");
  const destinationCityId = form.watch("destinationCityId");

  const sourceAreas = useQuery({
    queryKey: ["railway-freight-source-areas", sourceCityId],
    queryFn: () =>
      areaApi.list({
        page: 0,
        size: 1000,
        filter: { cityId: sourceCityId, isRailHead: "true" },
      }),
    enabled: open && Boolean(sourceCityId) && !isPreset,
  });

  const destinationAreas = useQuery({
    queryKey: ["railway-freight-destination-areas", destinationCityId],
    queryFn: () =>
      areaApi.list({
        page: 0,
        size: 1000,
        filter: { cityId: destinationCityId, isRailHead: "true" },
      }),
    enabled: open && Boolean(destinationCityId) && !isPreset,
  });
  const sourceAreaOptions =
    (isPreset && preset
      ? [{ label: preset.sourceAreaName, value: preset.sourceAreaId }]
      : sourceAreas.data?.data.map((area) => ({
        label: area.name,
        value: area.id,
      }))) ?? [];

  const destinationAreaOptions =
    (isPreset && preset
      ? [
        {
          label: preset.destinationAreaName,
          value: preset.destinationAreaId,
        },
      ]
      : destinationAreas.data?.data.map((area) => ({
        label: area.name,
        value: area.id,
      }))) ?? [];

  React.useEffect(() => {
    if (suppressSourceAreaReset.current) {
      suppressSourceAreaReset.current = false;
      return;
    }

    if (!open || previousSourceCityId.current === sourceCityId) return;

    previousSourceCityId.current = sourceCityId;
    form.setValue("sourceAreaId", "", { shouldDirty: true });
  }, [open, sourceCityId, form]);

  React.useEffect(() => {
    if (suppressDestinationAreaReset.current) {
      suppressDestinationAreaReset.current = false;
      return;
    }

    if (!open || previousDestinationCityId.current === destinationCityId) {
      return;
    }

    previousDestinationCityId.current = destinationCityId;
    form.setValue("destinationAreaId", "", { shouldDirty: true });
  }, [open, destinationCityId, form]);

  const wagonOptions =
    isPreset && preset
      ? [{ label: preset.wagonName, value: preset.wagonId }]
      : (wagons.data?.data ?? []).map((w) => ({
        label: w.name,
        value: w.id,
      }));

  return (
    <MasterFormDialog<
      CreateRailwayFreightMatrixFormInput,
      CreateRailwayFreightMatrixBody
    >
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Railway Freight" : "Add Railway Freight"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      columns={2}
      contentClassName="w-[95vw] sm:!max-w-5xl min-h-[75vh]"
    >
      {/* BASIC INFO */}
      <FormSection
        icon={<IconTrain size={18} />}
        title="Railway Freight Details"
        description="Select wagon and define route"
      >
        <SelectField<CreateRailwayFreightMatrixFormInput>
          name="wagonId"
          label="Wagon Type"
          options={wagonOptions}
          required
          disabled={isPreset}
        />

        <IconTextField<CreateRailwayFreightMatrixFormInput>
          name="freightAmount"
          label="Freight Amount"
          placeholder="Enter freight amount"
          icon={<IconCurrencyRupee size={16} />}
          type="number"
          min={0}
          step="0.01"
          required
        />
      </FormSection>

      {/* ROUTE */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Route Information"
        description="Source and destination cities"
      >
        <CitySelectField<CreateRailwayFreightMatrixFormInput>
          name="sourceCityId"
          label="Source City"
          required
          initialCity={
            isPreset && preset
              ? { id: preset.sourceCityId, name: preset.sourceCityName }
              : row?.sourceCity
                ? {
                  id: row.sourceCity.id,
                  name: row.sourceCity.name,
                }
                : null
          }
          disabled={isPreset}
        />

        <CitySelectField<CreateRailwayFreightMatrixFormInput>
          name="destinationCityId"
          label="Destination City"
          required
          initialCity={
            isPreset && preset
              ? {
                id: preset.destinationCityId,
                name: preset.destinationCityName,
              }
              : row?.destinationCity
                ? {
                  id: row.destinationCity.id,
                  name: row.destinationCity.name,
                }
                : null
          }
          disabled={isPreset}
        />
        <SelectField<CreateRailwayFreightMatrixFormInput>
          name="sourceAreaId"
          label="Source Railhead (optional)"
          options={sourceAreaOptions}
          disabled={!sourceCityId || isPreset}
        />

        <SelectField<CreateRailwayFreightMatrixFormInput>
          name="destinationAreaId"
          label="Destination Railhead (optional)"
          options={destinationAreaOptions}
          disabled={!destinationCityId || isPreset}
        />
      </FormSection>
    </MasterFormDialog>
  );
}
