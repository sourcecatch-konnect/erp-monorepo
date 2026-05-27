"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Goods,
  CreateGoodsBody,
  CreateGoodsFormInput,
} from "@skerp/types";

import { createGoodsSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import IconTextField from "../_shared/fields/IconTextField";
import SelectField from "../_shared/fields/SelectField";

import {
  IconBox,
  IconRuler,
  IconCategory,
  IconLayersIntersect,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: Goods | null;
  onSubmit: (data: CreateGoodsBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateGoodsFormInput = {
  name: "",
  description: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  category: "Heavy",
  storagePosition: "Any",
  storageLayer: "Single",
  isStackingAllowed: false,
  lorryReceiptId: "",
};

export default function GoodsForm({
  open,
  onOpenChange,
  row,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateGoodsFormInput, unknown, CreateGoodsBody>({
    resolver: zodResolver(createGoodsSchema),
    mode: "onChange",
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      description: row?.description ?? "",
      weight: row?.weight?.toString() ?? "",
      length: row?.length?.toString() ?? "",
      width: row?.width?.toString() ?? "",
      height: row?.height?.toString() ?? "",
      category: row?.category ?? "Heavy",
      storagePosition: row?.storagePosition ?? "Any",
      storageLayer: row?.storageLayer ?? "Single",
      isStackingAllowed: row?.isStackingAllowed ?? false,
      lorryReceiptId: row?.lorryReceiptId ?? "",
    });
  }, [open, row]);

  return (
    <MasterFormDialog<CreateGoodsFormInput, CreateGoodsBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Goods" : "Add Goods"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={3}
    >
      {/* BASIC */}
      <FormSection icon={<IconBox size={18} />} title="Goods Info">
        <IconTextField name="name" label="Name" required />
        <IconTextField name="description" label="Description" />
      </FormSection>

      {/* DIMENSIONS */}
      <FormSection icon={<IconRuler size={18} />} title="Dimensions">
        <IconTextField name="weight" label="Weight" type="number" />
        <IconTextField name="length" label="Length" type="number" />
        <IconTextField name="width" label="Width" type="number" />
        <IconTextField name="height" label="Height" type="number" />
      </FormSection>

      {/* STORAGE */}
      <FormSection icon={<IconLayersIntersect size={18} />} title="Storage">
        <SelectField
          name="category"
          label="Category"
          options={[
            { label: "Heavy", value: "Heavy" },
            { label: "Light", value: "Light" },
          ]}
        />

        <SelectField
          name="storagePosition"
          label="Position"
          options={[
            { label: "Any", value: "Any" },
            { label: "Horizontal", value: "Horizontal" },
            { label: "Vertical", value: "Vertical" },
          ]}
        />

        <SelectField
          name="storageLayer"
          label="Layer"
          options={[
  { label: "Both", value: "Both" },
  { label: "Bottom", value: "Bottom" },
  { label: "Upper", value: "Upper" },
]}
        />
      </FormSection>
    </MasterFormDialog>
  );
}