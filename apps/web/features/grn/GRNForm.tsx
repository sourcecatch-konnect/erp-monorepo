// apps/web/src/features/grn/components/GRNForm.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconFileText,
  IconPackage,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";

import FormSection from "@/features/masters/_shared/fields/FormSection";
import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { attachmentApi } from "@/features/attachments/attachment.client";

import {
  useCreateGRN,
  useEligibleGRNLrs,
  useGRNPreview,
  useGrnSupervisors,
  useSubmitGRN,
  useUpdateGRN,
} from "./useHook/useGRN";
import type { CreateGRNBody, GRN as GRNMutation } from "./grn.service";
import type { GRN as GRNDetail } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import LRPreviewPanel, {
  type LRPreviewPanelData,
} from "./components/grnPreview";
import {
  FieldLabel,
  MoneyField,
} from "../lorry-receipts/components/moneyField";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
type EditPreviewTrip = {
  id?: string;
  tripNumber?: string | null;
  tripName?: string | null;
  onwardFreight?: number | string | bigint | null;
  vehicle?: {
    id?: string;
    vehicleNumber?: string | null;
  } | null;
  driver?: {
    id?: string;
    name?: string | null;
    mobile?: string | null;
  } | null;
};

type EditPreviewGroup = {
  isMarketVehicle?: boolean | null;

  marketVehicleNumber?: string | null;
  marketDriverName?: string | null;
  marketCommissionAmount?: number | string | bigint | null;

  primaryTrip?: EditPreviewTrip | null;
  secondaryTrip?: EditPreviewTrip | null;
};

type EditGRNForPreview = GRNDetail & {
  lorryReceipt?:
    | (NonNullable<GRNDetail["lorryReceipt"]> & {
        group?:
          | (NonNullable<NonNullable<GRNDetail["lorryReceipt"]>["group"]> &
              EditPreviewGroup)
          | null;
      })
    | null;
};
type GRNFormValues = Omit<CreateGRNBody, "inDateTime" | "outDateTime"> & {
  inDateTime?: Date;
  outDateTime?: Date;
  balanceFreight?: number | string;
  freightPerMT?: number | string;
  detentionDays?: number;
  detentionAmount?: number | string;
  grossTotal?: number | string;
  labourName?: string;
};

const numberValue = (value: unknown) => {
  const n =
    typeof value === "number" ? value : Number(String(value ?? "").trim() || 0);

  return Number.isFinite(n) ? n : 0;
};

const toNumberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  return numberValue(value);
};

const DAMAGE_PHOTO_ENTITY = "GRN_DAMAGE";
const MAX_DAMAGE_PHOTO_BYTES = 2 * 1024 * 1024;

const getDamagePhotoKey = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}`;

const toDate = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateUnloadingMinutes = (
  inDateTime: unknown,
  outDateTime: unknown,
) => {
  const inDate = toDate(inDateTime);
  const outDate = toDate(outDateTime);

  if (!inDate || !outDate) return undefined;

  const diffMs = outDate.getTime() - inDate.getTime();

  if (diffMs <= 0) return undefined;

  return Math.round(diffMs / 60000);
};

const formatMinutesToHours = (minutes?: number) => {
  if (!minutes) return "—";

  const hours = minutes / 60;

  return `${hours.toFixed(2)} hr`;
};
const toDateValue = (value: unknown): Date | undefined => {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const paiseToRupeeInput = (value: unknown) => {
  const num = toNumberOrUndefined(value);
  return num === undefined ? undefined : num / 100;
};

const toApiDateTime = (value?: Date) =>
  value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : undefined;

type Props = {
  mode: "create" | "edit";
  grn?: GRNDetail;
};
const grnToFormValues = (grn: GRNDetail): GRNFormValues => ({
  lorryReceiptId: grn.lorryReceiptId,

  gateNo: grn.gateNo ?? undefined,
  inDateTime: grn.inDateTime ? new Date(grn.inDateTime) : undefined,
  outDateTime: grn.outDateTime ? new Date(grn.outDateTime) : undefined,
  unloadingMinutes: grn.unloadingMinutes ?? undefined,

  goods:
    grn.goods?.map((item) => ({
      lrGoodsId: item.lrGoodsId ?? undefined,
      goodsName: item.goodsName,
      description: item.description ?? undefined,
      totalQty: numberValue(item.totalQty),
      receivedQty: numberValue(item.receivedQty),
      damageQty: numberValue(item.damageQty),
      shortageQty: numberValue(item.shortageQty),
      unit: item.unit ?? undefined,
      weight: toNumberOrUndefined(item.weight),
      remarks: item.remarks ?? undefined,
    })) ?? [],

  damagesBy: grn.damagesBy ?? "NONE",

  detentionDays: grn.detentionDays ?? 0,
  detentionAmount: paiseToRupeeInput(grn.detentionAmount),
  totalFreight: paiseToRupeeInput(grn.totalFreight),
  advanceAmount: paiseToRupeeInput(grn.advanceAmount),
  damageAmount: paiseToRupeeInput(grn.damageAmount),
  tdsAmount: paiseToRupeeInput(grn.tdsAmount),
  hamaliAmount: paiseToRupeeInput(grn.hamaliAmount),
  printingStationaryAmount: paiseToRupeeInput(grn.printingStationaryAmount),
  labourCharge: paiseToRupeeInput(grn.labourCharge),

  balanceFreight: paiseToRupeeInput(grn.balanceFreight),
  freightPerMT: paiseToRupeeInput(grn.freightPerMt),
  grossTotal: paiseToRupeeInput(grn.grossTotal),

  labourName: grn.labourName ?? undefined,
  labourId: grn.labourId ?? undefined,
  unloadingSupervisorId: grn.unloadingSupervisorId ?? undefined,

  damagePhotoAttachmentIds: [],
});
const toPreviewMoney = (value: number | string | bigint | null | undefined) => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value ?? 0;
};
export default function GRNForm({ mode, grn }: Props) {
  const router = useRouter();

  const createGRN = useCreateGRN();
  const updateGRN = useUpdateGRN();
  const submitGRN = useSubmitGRN();
  const damagePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [damagePhotoFiles, setDamagePhotoFiles] = React.useState<File[]>([]);
  const [existingDamagePhotos, setExistingDamagePhotos] = React.useState(
    grn?.damagePhotos ?? [],
  );
  React.useEffect(() => {
    if (mode === "edit") {
      setExistingDamagePhotos(grn?.damagePhotos ?? []);
    }
  }, [mode, grn?.id, grn?.damagePhotos]);
  const [createdDraft, setCreatedDraft] = React.useState<GRNMutation | null>(
    null,
  );
  const [isUploadingDamagePhotos, setIsUploadingDamagePhotos] =
    React.useState(false);
  const form = useForm<GRNFormValues>({
    defaultValues:
      mode === "edit" && grn
        ? grnToFormValues(grn)
        : {
            lorryReceiptId: "",
            goods: [],
            damagePhotoAttachmentIds: [],
            detentionDays: 0,
            damagesBy: "NONE",
            detentionAmount: "0",
            balanceFreight: 0,
            freightPerMT: "0",
            grossTotal: "0",
          },
  });
  const eligibleLRs = useEligibleGRNLrs({
    page: 0,
    size: 50,
    search: "",
  });

  const selectedLRId = useWatch({
    control: form.control,
    name: "lorryReceiptId",
  });
  const totalFreightValue = useWatch({
    control: form.control,
    name: "totalFreight",
  });

  const detentionAmountValue = useWatch({
    control: form.control,
    name: "detentionAmount",
  });
  const preview = useGRNPreview(mode === "create" ? selectedLRId : "");
  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "goods",
  });

  const watchedGoods = useWatch({
    control: form.control,
    name: "goods",
  });

  React.useEffect(() => {
    if (mode === "edit") return;

    setCreatedDraft(null);
    setDamagePhotoFiles([]);

    if (!selectedLRId) {
      replace([]);
      return;
    }

    if (!preview.data) return;

    replace(
      preview.data.goods.map((item) => {
        const totalQty = numberValue(item.totalQty);
        const receivedQty = numberValue(item.receivedQty);

        return {
          lrGoodsId: item.lrGoodsId,
          goodsName: item.goodsName,
          description: item.description ?? undefined,
          totalQty,
          receivedQty,
          damageQty: numberValue(item.damageQty),
          shortageQty: Math.max(totalQty - receivedQty, 0),
          unit: item.unit ?? undefined,
          weight: toNumberOrUndefined(item.weight),
          remarks: "",
        };
      }),
    );

    form.setValue(
      "totalFreight",
      paiseToRupeeInput(preview.data.chargeDefaults.totalFreight),
    );

    form.setValue(
      "advanceAmount",
      paiseToRupeeInput(preview.data.chargeDefaults.advanceAmount),
    );

    form.setValue(
      "hamaliAmount",
      paiseToRupeeInput(preview.data.chargeDefaults.hamaliAmount),
    );

    form.setValue(
      "tdsAmount",
      paiseToRupeeInput(preview.data.chargeDefaults.tdsAmount),
    );
  }, [mode, selectedLRId, preview.data, replace, form]);

  React.useEffect(() => {
    const totalFreight = numberValue(totalFreightValue);
    const detentionAmount = numberValue(detentionAmountValue);

    const grossTotal = totalFreight + detentionAmount;

    form.setValue("grossTotal", grossTotal.toFixed(2), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, totalFreightValue, detentionAmountValue]);
  const labourValue = useWatch({
    control: form.control,
    name: "labourName",
  });
  const grossTotalValue = useWatch({
    control: form.control,
    name: "grossTotal",
  });

  const grossTotalPaise = Math.round(numberValue(grossTotalValue) * 100);
  const detentionAmountPaise = Math.round(
    numberValue(detentionAmountValue) * 100,
  );
  const labourOptions = [
    {
      value: "OTHER_LABOUR",
      label: "Other Labour",
    },
    {
      value: "PARAS_ROADLINES",
      label: "Paras RoadLines",
    },
  ];
  const lrOptions =
    eligibleLRs.data?.data?.map((lr) => ({
      value: lr.id,
      label: String(lr.lrNumber ?? lr.id),
    })) ?? [];

  const validateGoods = (goods: GRNFormValues["goods"]) => {
    for (const [index, row] of goods.entries()) {
      const totalQty = numberValue(row.totalQty);
      const receivedQty = numberValue(row.receivedQty);
      const damageQty = numberValue(row.damageQty);

      if (receivedQty > totalQty) {
        toast.error(
          `Row ${index + 1}: Received qty cannot be greater than total qty.`,
        );
        return false;
      }

      if (damageQty > receivedQty) {
        toast.error(
          `Row ${index + 1}: Damage qty cannot be greater than received qty.`,
        );
        return false;
      }
    }

    return true;
  };
  const handleDamagePhotosChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);

    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.toLowerCase().startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      if (file.size > MAX_DAMAGE_PHOTO_BYTES) {
        toast.error(`${file.name} must be less than 2 MB`);
        continue;
      }

      validFiles.push(file);
    }

    setDamagePhotoFiles((currentFiles) => {
      const selectedKeys = new Set(currentFiles.map(getDamagePhotoKey));
      const newFiles = validFiles.filter((file) => {
        const key = getDamagePhotoKey(file);

        if (selectedKeys.has(key)) {
          toast.error(`${file.name} is already selected`);
          return false;
        }

        selectedKeys.add(key);
        return true;
      });

      return [...currentFiles, ...newFiles];
    });

    event.target.value = "";
  };

  const removeDamagePhoto = (fileToRemove: File) => {
    const keyToRemove = getDamagePhotoKey(fileToRemove);

    setDamagePhotoFiles((currentFiles) =>
      currentFiles.filter((file) => getDamagePhotoKey(file) !== keyToRemove),
    );

    if (damagePhotoInputRef.current) {
      damagePhotoInputRef.current.value = "";
    }
  };
  const removeExistingDamagePhoto = (photoId: string) => {
    setExistingDamagePhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.id !== photoId),
    );
  };
  const inDateTime = useWatch({
    control: form.control,
    name: "inDateTime",
  });

  const outDateTime = useWatch({
    control: form.control,
    name: "outDateTime",
  });

  const unloadingMinutes = React.useMemo(
    () => calculateUnloadingMinutes(inDateTime, outDateTime),
    [inDateTime, outDateTime],
  );
  React.useEffect(() => {
    form.setValue("unloadingMinutes", unloadingMinutes, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, unloadingMinutes]);
  const onSubmit: SubmitHandler<GRNFormValues> = async (values) => {
    if (!values.lorryReceiptId) {
      toast.error("Please select LR first");
      return;
    }

    if (!values.goods.length) {
      toast.error("No goods found for selected LR");
      return;
    }

    if (!validateGoods(values.goods)) return;

    const goods = values.goods.map((row) => {
      const totalQty = numberValue(row.totalQty);
      const receivedQty = numberValue(row.receivedQty);
      const damageQty = numberValue(row.damageQty);
      const shortageQty = Math.max(totalQty - receivedQty, 0);

      return {
        ...row,
        totalQty,
        receivedQty,
        damageQty,
        shortageQty,
        remarks:
          damageQty > 0 || shortageQty > 0
            ? row.remarks?.trim() || undefined
            : undefined,
      };
    });
    const hasDamage = goods.some((row) => numberValue(row.damageQty) > 0);

    if (hasDamage && (!values.damagesBy || values.damagesBy === "NONE")) {
      toast.error("Please select who caused the damage");
      return;
    }

    try {
      const {
        detentionAmount: _detentionAmount,
        grossTotal: _grossTotal,
        freightPerMT,
        inDateTime,
        outDateTime,
        ...apiValues
      } = values;
      void _detentionAmount;
      void _grossTotal;

      const apiBody = {
        ...apiValues,
        inDateTime: toApiDateTime(inDateTime),
        outDateTime: toApiDateTime(outDateTime),
        freightPerMt: toNumberOrUndefined(freightPerMT),
      };

      if (mode === "edit" && grn) {
        const uploadedPhotos = await Promise.all(
          damagePhotoFiles.map((file) =>
            attachmentApi.upload(
              {
                entityType: DAMAGE_PHOTO_ENTITY,
                entityId: grn.id,
                originalName: file.name,
                mime: file.type,
                sizeBytes: file.size,
              },
              file,
            ),
          ),
        );
        await updateGRN.mutateAsync({
          id: grn.id,
          body: {
            ...apiBody,
            version: grn.version,
            labourId: undefined,
            unloadingSupervisorId: values.unloadingSupervisorId,
            goods,
            damagePhotoAttachmentIds: uploadedPhotos.map((photo) => photo.id),
          },
        });
        const identifier = grn.grnNumber || grn.id;
        toast.success(`GRN ${grn.grnNumber} updated`);
        router.push(`/vp-management/grn/${encodeURIComponent(identifier)}`);

        return;
      }

      const created =
        createdDraft?.lorryReceiptId === values.lorryReceiptId
          ? createdDraft
          : await createGRN.mutateAsync({
              ...apiBody,
              labourId: undefined,
              unloadingSupervisorId: values.unloadingSupervisorId,
              goods,
              damagePhotoAttachmentIds: [],
            });

      setCreatedDraft(created);

      setIsUploadingDamagePhotos(true);

      const uploadedPhotos = await Promise.all(
        damagePhotoFiles.map((file) =>
          attachmentApi.upload(
            {
              entityType: DAMAGE_PHOTO_ENTITY,
              entityId: created.id,
              originalName: file.name,
              mime: file.type,
              sizeBytes: file.size,
            },
            file,
          ),
        ),
      );

      setIsUploadingDamagePhotos(false);

      const submitted = await submitGRN.mutateAsync({
        id: created.id,
        body: {
          version: created.version,
          damagePhotoAttachmentIds: uploadedPhotos.map((photo) => photo.id),
        },
      });

      toast.success(`GRN ${submitted.grnNumber} created`);
      setCreatedDraft(null);
      router.push(`/vp-management/grn/${submitted.grnNumber}`);
    } catch (err) {
      setIsUploadingDamagePhotos(false);
      toast.error(getErrorMessage(err));
    }
  };

  const isSaving =
    createGRN.isPending ||
    submitGRN.isPending ||
    updateGRN.isPending ||
    isUploadingDamagePhotos;
  const hasDamageOrShortage = React.useMemo(() => {
    return watchedGoods?.some((row) => {
      const damageQty = numberValue(row?.damageQty);
      const totalQty = numberValue(row?.totalQty);
      const receivedQty = numberValue(row?.receivedQty);
      const shortageQty = Math.max(totalQty - receivedQty, 0);

      return damageQty > 0 || shortageQty > 0;
    });
  }, [watchedGoods]);
  const damageByValue = useWatch({
    control: form.control,
    name: "damagesBy",
  });
  const { data: supervisors = [], isLoading: supervisorsLoading } =
    useGrnSupervisors();
  React.useEffect(() => {
    if (!hasDamageOrShortage) {
      setDamagePhotoFiles([]);
      form.setValue("damagesBy", "NONE" as GRNFormValues["damagesBy"], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, hasDamageOrShortage]);
  const canShowFormBody = mode === "edit" || Boolean(preview.data);
  const editPreview = React.useMemo<LRPreviewPanelData | undefined>(() => {
    if (mode !== "edit" || !grn?.lorryReceipt) return undefined;

    const editGrn = grn as EditGRNForPreview;

    const lr = editGrn.lorryReceipt;
    const group = lr?.group;

    const ownTrip = group?.primaryTrip ?? group?.secondaryTrip ?? null;
    const isMarketVehicle = Boolean(group?.isMarketVehicle);

    return {
      lorryReceipt: {
        lrNumber: lr?.lrNumber,
        status: lr?.status,
        invoiceNumber: lr?.invoiceNumber,
        invoiceAmount: lr?.invoiceAmount,
      },

      vehicleInfo: isMarketVehicle
        ? {
            type: "MARKET",
            vehicleNumber: group?.marketVehicleNumber ?? null,
            driverName: group?.marketDriverName ?? null,
            tripNumber: null,
            tripName: null,
          }
        : {
            type: "OWN",
            vehicleNumber: ownTrip?.vehicle?.vehicleNumber ?? null,
            driverName: ownTrip?.driver?.name ?? null,
            tripNumber: ownTrip?.tripNumber ?? null,
            tripName: ownTrip?.tripName ?? null,
          },

      chargeDefaults: {
        totalFreight: grn.totalFreight ?? 0,
        advanceAmount: grn.advanceAmount ?? 0,
        hamaliAmount: grn.hamaliAmount ?? 0,
        tdsAmount: grn.tdsAmount ?? 0,
        commissionAmount: toPreviewMoney(group?.marketCommissionAmount),
      },
    };
  }, [mode, grn]);
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex w-full items-start gap-5 overflow-hidden">
          {/* LEFT SIDE FORM */}
          <div className="min-w-0 flex-1 space-y-5">
            <FormSection
              icon={<IconFileText size={16} />}
              title="Select LR"
              columns={1}
            >
              <ComboboxField
                name="lorryReceiptId"
                label="LR Number"
                required
                options={
                  mode === "edit" && grn?.lorryReceipt
                    ? [
                        {
                          value: grn.lorryReceipt.id,
                          label: grn.lorryReceipt.lrNumber,
                        },
                      ]
                    : lrOptions
                }
                disabled={mode === "edit"}
                emptyText={
                  eligibleLRs.isLoading
                    ? "Loading LRs..."
                    : "No eligible LR found"
                }
              />
            </FormSection>

            {canShowFormBody ? (
              <FormSection
                icon={<IconPackage size={16} />}
                title="Goods Receive"
                columns={1}
              >
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border">
                    <div className="min-w-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-12">SN</TableHead>
                            <TableHead className="w-24">Goods Name</TableHead>
                            <TableHead className="w-20">Unit</TableHead>
                            <TableHead className="w-32">Total</TableHead>
                            <TableHead className="w-32">Received</TableHead>
                            <TableHead className="w-32">Damage</TableHead>
                            <TableHead className="w-28">Shortage</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {fields.map((field, index) => {
                            const row = watchedGoods?.[index];

                            const totalQty = numberValue(row?.totalQty);
                            const receivedQty = numberValue(row?.receivedQty);
                            const damageQty = numberValue(row?.damageQty);
                            const shortageQty = Math.max(
                              totalQty - receivedQty,
                              0,
                            );
                            const showReason = damageQty > 0 || shortageQty > 0;

                            return (
                              <React.Fragment key={field.id}>
                                <TableRow>
                                  <TableCell className="text-muted-foreground">
                                    {index + 1}
                                  </TableCell>

                                  <TableCell>
                                    <p className="font-medium">
                                      {row?.goodsName || "Goods"}
                                    </p>

                                    {row?.description ? (
                                      <p className="text-xs text-muted-foreground">
                                        {row.description}
                                      </p>
                                    ) : null}
                                  </TableCell>

                                  <TableCell>{row?.unit || "—"}</TableCell>

                                  {/* Total is now manually editable */}
                                  <TableCell>
                                    <Controller
                                      name={`goods.${index}.totalQty` as const}
                                      control={form.control}
                                      render={({ field }) => (
                                        <Input
                                          type="number"
                                          min={0}
                                          className="h-9"
                                          value={field.value ?? ""}
                                          onChange={(event) => {
                                            field.onChange(event.target.value);
                                          }}
                                          onBlur={field.onBlur}
                                        />
                                      )}
                                    />
                                  </TableCell>

                                  <TableCell>
                                    <Controller
                                      name={
                                        `goods.${index}.receivedQty` as const
                                      }
                                      control={form.control}
                                      render={({ field }) => (
                                        <Input
                                          type="number"
                                          min={0}
                                          max={totalQty}
                                          className="h-9"
                                          value={field.value ?? ""}
                                          onChange={(event) => {
                                            field.onChange(event.target.value);
                                          }}
                                          onBlur={field.onBlur}
                                        />
                                      )}
                                    />
                                  </TableCell>

                                  <TableCell>
                                    <Controller
                                      name={`goods.${index}.damageQty` as const}
                                      control={form.control}
                                      render={({ field }) => (
                                        <Input
                                          type="number"
                                          min={0}
                                          max={receivedQty}
                                          className="h-9"
                                          value={field.value ?? ""}
                                          onChange={(event) => {
                                            field.onChange(event.target.value);
                                          }}
                                          onBlur={field.onBlur}
                                        />
                                      )}
                                    />
                                  </TableCell>

                                  <TableCell>
                                    <span className="inline-flex min-w-12 rounded-md bg-muted px-3 py-2 font-medium">
                                      {shortageQty}
                                    </span>
                                  </TableCell>
                                </TableRow>

                                {showReason ? (
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell
                                      colSpan={7}
                                      className="px-3 pb-4 pt-0"
                                    >
                                      <div className="ml-[48px] rounded-md border border-amber-200 bg-amber-50/50 p-3">
                                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                                          <IconAlertTriangle size={13} />
                                          Reason for damage / shortage
                                        </div>

                                        <Textarea
                                          {...form.register(
                                            `goods.${index}.remarks` as const,
                                          )}
                                          rows={2}
                                          placeholder="Write reason here..."
                                          className="bg-background"
                                        />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </FormSection>
            ) : null}

            {canShowFormBody ? (
              <FormSection
                icon={<IconFileText size={16} />}
                title="Receiving Details"
                columns={3}
              >
                <Controller
                  name="gateNo"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Gate No</FieldLabel>
                      <Input
                        className="h-9"
                        placeholder="Enter gate no"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </div>
                  )}
                />
                <Controller
                  name="inDateTime"
                  control={form.control}
                  render={({ field }) => (
                    <div className="w-full md:col-span-2">
                      <FieldLabel>In Date </FieldLabel>
                      <DateTimePicker
                        placeholder="Select in date"
                        selected={toDateValue(field.value)}
                        onSelect={(date) => field.onChange(date)}
                      />
                    </div>
                  )}
                />
                <div>
                  <FieldLabel>Unloading Time (Hr)</FieldLabel>
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                    {formatMinutesToHours(unloadingMinutes)}
                  </div>
                </div>
                <Controller
                  name="outDateTime"
                  control={form.control}
                  render={({ field }) => (
                    <div className="w-full md:col-span-2">
                      <FieldLabel>Out Date </FieldLabel>
                      <DateTimePicker
                        placeholder="Select out date"
                        selected={toDateValue(field.value)}
                        onSelect={(date) => field.onChange(date)}
                      />
                    </div>
                  )}
                />
              </FormSection>
            ) : null}
            {canShowFormBody ? (
              <FormSection
                icon={<IconFileText size={16} />}
                title="Labour & Damage Details"
                columns={3}
              >
                <div>
                  <FieldLabel>Damage By</FieldLabel>

                  <Select
                    value={String(damageByValue ?? "NONE")}
                    disabled={!hasDamageOrShortage || isSaving}
                    onValueChange={(value) => {
                      form.setValue(
                        "damagesBy",
                        value as GRNFormValues["damagesBy"],
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        },
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select damage by" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="NONE">No Damage</SelectItem>
                      <SelectItem value="TRANSPORTER">Transporter</SelectItem>
                      <SelectItem value="LABOUR">Labour</SelectItem>
                      <SelectItem value="RAILWAY">Railway</SelectItem>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                      <SelectItem value="UNKNOWN">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Damage Photos</FieldLabel>

                  <Input
                    ref={damagePhotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={!hasDamageOrShortage || isSaving}
                    onChange={handleDamagePhotosChange}
                    className="h-9"
                  />

                  {mode === "edit" && existingDamagePhotos.length ? (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Existing uploaded photos
                      </div>

                      <div className="grid max-h-32 gap-1.5 overflow-y-auto rounded-md border bg-muted/20 p-2">
                        {existingDamagePhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="flex min-w-0 items-center gap-2 rounded-sm bg-background px-2 py-1.5 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {photo.originalName ||
                                photo.filename ||
                                "Damage Photo"}
                            </span>

                            <span className="shrink-0 text-muted-foreground">
                              Existing
                            </span>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              disabled={isSaving}
                              onClick={() =>
                                removeExistingDamagePhoto(photo.id)
                              }
                              aria-label={`Remove ${photo.originalName || photo.filename || "Damage Photo"}`}
                            >
                              <IconX size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {damagePhotoFiles.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {damagePhotoFiles.length} new photo
                        {damagePhotoFiles.length === 1 ? "" : "s"} selected
                      </div>

                      <div className="grid max-h-32 gap-1.5 overflow-y-auto rounded-md border bg-muted/20 p-2">
                        {damagePhotoFiles.map((file) => (
                          <div
                            key={getDamagePhotoKey(file)}
                            className="flex min-w-0 items-center gap-2 rounded-sm bg-background px-2 py-1.5 text-xs"
                          >
                            <span
                              className="min-w-0 flex-1 truncate"
                              title={file.name}
                            >
                              {file.name}
                            </span>

                            <span className="shrink-0 text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </span>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              disabled={isSaving}
                              onClick={() => removeDamagePhoto(file)}
                              aria-label={`Remove ${file.name}`}
                            >
                              <IconX size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <FieldLabel>Labour Name</FieldLabel>

                  <Select
                    value={String(labourValue ?? "")}
                    onValueChange={(value) => {
                      form.setValue("labourName", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select labour" />
                    </SelectTrigger>

                    <SelectContent>
                      {labourOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Controller
                  name="labourCharge"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Labour Charge</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        className="h-9"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            toNumberOrUndefined(event.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                      />
                    </div>
                  )}
                />

                <Controller
                  name="unloadingSupervisorId"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Unloading Supervisor</FieldLabel>

                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) => field.onChange(value)}
                        disabled={supervisorsLoading}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              supervisorsLoading
                                ? "Loading supervisors..."
                                : "Select supervisor"
                            }
                          />
                        </SelectTrigger>

                        <SelectContent>
                          {supervisors.map((supervisor) => (
                            <SelectItem
                              key={supervisor.id}
                              value={supervisor.id}
                            >
                              {supervisor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              </FormSection>
            ) : null}
            {canShowFormBody ? (
              <FormSection
                icon={<IconFileText size={16} />}
                title="Detention Summary"
                columns={3}
              >
                <Controller
                  name="detentionDays"
                  control={form.control}
                  render={({ field }) => (
                    <div>
                      <FieldLabel>Detention Days</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        className="h-9"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            toNumberOrUndefined(event.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                      />
                    </div>
                  )}
                />

                <MoneyField<GRNFormValues>
                  name="detentionAmount"
                  label="Detention Amount"
                />
              </FormSection>
            ) : null}
            {/* BUTTONS MUST STAY INSIDE LEFT COLUMN */}
            <div className="flex items-center justify-end gap-2 rounded-lg border bg-background p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/grn")}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !selectedLRId ||
                  (mode === "create" && preview.isLoading) ||
                  fields.length === 0
                }
              >
                {isSaving
                  ? mode === "edit"
                    ? "Saving..."
                    : "Creating..."
                  : mode === "edit"
                    ? "Save GRN"
                    : "Create GRN"}
              </Button>
            </div>
          </div>

          <div className="sticky top-6 h-[calc(100vh-3rem)] w-[360px] min-w-[360px] max-w-[360px] basis-[360px] flex-none overflow-hidden">
            <LRPreviewPanel
              preview={mode === "edit" ? editPreview : preview.data}
              loading={mode === "create" && preview.isLoading}
              detentionAmountPaise={detentionAmountPaise}
              grossTotalPaise={grossTotalPaise}
            />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
