"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconDeviceFloppy,
  IconPackage,
  IconRoute,
  IconTrain,
  IconX,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox, type ComboboxOption } from "@skerp/ui/components/combobox";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Textarea } from "@skerp/ui/components/textarea";

import { useCan } from "@/features/auth";
import { attachmentApi } from "@/features/attachments/attachment.client";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import {
  useAvailableRailRakeVPs,
  useIncomingRailRakes,
} from "@/features/rail-rake/useRailRake";

import type {
  CreateRailBranchGRNBody,
  RailBranchGRNDetail,
  UpdateRailBranchGRNBody,
} from "./rail-branch-grn.service";
import {
  useCreateRailBranchGRN,
  useRailBranchGRNDetail,
  useRailBranchGRNPreview,
  useRailBranchGRNSupervisors,
  useSubmitRailBranchGRN,
  useUpdateRailBranchGRN,
} from "./useRailBranchGRN";

type RailBranchGRNFormProps =
  | { mode: "create"; id?: never }
  | { mode: "edit"; id: string };

type FormItem = {
  key: string;
  sourceId: string;
  lrNumber: string;
  grnNumber: string;
  goodsName: string;
  description?: string | null;
  unit?: string | null;
  consignorName?: string | null;
  consigneeName?: string | null;
  loadedQty: number;
  receivedQty: number | string;
  damageQty: number;
  shortageQty: number;
  remarks: string;
};

type FormState = {
  version?: number;
  inDateTime: string;
  outDateTime: string;
  damagesBy: RailBranchGRNDetail["damagesBy"];
  labourCount: string;
  labourCharge: string;
  unloadingSupervisorId: string;
  items: FormItem[];
};

const EMPTY_FORM: FormState = {
  inDateTime: "",
  outDateTime: "",
  damagesBy: "NONE",
  labourCount: "",
  labourCharge: "",
  unloadingSupervisorId: "",
  items: [],
};

const toLocalDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIso = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const dateKey = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";

  return `${year}-${month}-${day}`;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value);
const quantityValue = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(number, 0) : 0;
};

const calculateShortage = (
  loadedQty: number | string,
  receivedQty: number | string,
) => Math.max(quantityValue(loadedQty) - quantityValue(receivedQty), 0);

const DAMAGE_PHOTO_ENTITY = "RAIL_BRANCH_GRN_DAMAGE";
const MAX_DAMAGE_PHOTO_BYTES = 2 * 1024 * 1024;

const getDamagePhotoKey = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}`;

const paiseToRupees = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount / 100) : "";
};

const formFromDetail = (grn: RailBranchGRNDetail): FormState => ({
  version: grn.version,
  inDateTime: toLocalDateTime(grn.inDateTime),
  outDateTime: toLocalDateTime(grn.outDateTime),
  damagesBy: grn.damagesBy,
  labourCount: String(grn.labourCount),
  labourCharge: paiseToRupees(grn.labourCharge),
  unloadingSupervisorId: grn.unloadingSupervisorId ?? "",
  items: grn.items.map((item) => ({
    key: item.id,
    sourceId: item.id,
    lrNumber: item.lrNumberSnapshot,
    grnNumber: item.vpLoadingGoods.vpLoading.grn.grnNumber,
    goodsName: item.goodsNameSnapshot,
    unit: item.unitSnapshot,
    consignorName: item.consignorNameSnapshot,
    consigneeName: item.consigneeNameSnapshot,
    loadedQty: item.loadedQty,
    receivedQty: item.receivedQty,
    damageQty: item.damageQty,
    shortageQty: calculateShortage(item.loadedQty, item.receivedQty),
    remarks: item.remarks ?? "",
  })),
});

export default function RailBranchGRNForm(props: RailBranchGRNFormProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const detailQuery = useRailBranchGRNDetail(
    isEdit ? props.id : undefined,
  );

  const incomingRakes = useIncomingRailRakes();

  const [scheduleDate, setScheduleDate] = React.useState("");
  const [rakeId, setRakeId] = React.useState("");
  const [vpWagonLoadingId, setVpWagonLoadingId] =
    React.useState("");

  const selectedRakeId = isEdit
    ? detailQuery.data?.railRakeId
    : rakeId;

  const availableVPs = useAvailableRailRakeVPs(
    isEdit ? undefined : rakeId,
  );
  const previewQuery = useRailBranchGRNPreview(
    isEdit ? undefined : rakeId,
    isEdit ? undefined : vpWagonLoadingId,
  );
  const createGrn = useCreateRailBranchGRN();
  const updateGrn = useUpdateRailBranchGRN();
  const submitGrn = useSubmitRailBranchGRN();
  const supervisorsQuery = useRailBranchGRNSupervisors(selectedRakeId);
  const canCreate = useCan(PERMS.RAIL_BRANCH_GRN.CREATE);
  const canUpdate = useCan(PERMS.RAIL_BRANCH_GRN.UPDATE);
  const canSubmit = useCan(PERMS.RAIL_BRANCH_GRN.SUBMIT);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const damagePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [damagePhotoFiles, setDamagePhotoFiles] = React.useState<File[]>([]);
  const [existingDamagePhotos, setExistingDamagePhotos] = React.useState(
    detailQuery.data?.damagePhotos ?? [],
  );
  const [isUploadingPhotos, setIsUploadingPhotos] = React.useState(false);

  const rakesForDate = React.useMemo(
    () =>
      scheduleDate
        ? (incomingRakes.data ?? []).filter(
          (rake) => dateKey(rake.vpSchedule.scheduleDate) === scheduleDate,
        )
        : (incomingRakes.data ?? []),
    [incomingRakes.data, scheduleDate],
  );

  const rakeOptions = React.useMemo<ComboboxOption[]>(
    () =>
      rakesForDate.map((rake) => ({
        value: rake.id,
        label: `${rake.rakeNumber}`,
      })),
    [rakesForDate],
  );

  const vpOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (availableVPs.data ?? []).map((vp) => ({
        value: vp.vpWagonLoadingId,
        label: `${vp.vpNo} · ${vp.row.wagon.name}`,
      })),
    [availableVPs.data],
  );

  React.useEffect(() => {
    if (isEdit && detailQuery.data) {
      setForm(formFromDetail(detailQuery.data));
      setExistingDamagePhotos(detailQuery.data.damagePhotos ?? []);
    }
  }, [detailQuery.data, isEdit]);

  React.useEffect(() => {
    if (isEdit || !previewQuery.data) return;
    if (previewQuery.data.alreadyExists && previewQuery.data.branchGrn) {
      router.replace(
        `/vp-management/branch-grn/${previewQuery.data.branchGrn.id}/edit`,
      );
      toast.info("An existing Branch GRN was opened for this VP.");
      return;
    }
    setForm({
      ...EMPTY_FORM,
      items: previewQuery.data.items.map((item) => ({
        key: item.vpLoadingGoodsId,
        sourceId: item.vpLoadingGoodsId,
        lrNumber: item.lrNumber,
        grnNumber: item.grnNumber,
        goodsName: item.goodsName,
        description: item.description,
        unit: item.unit,
        consignorName: item.consignorName,
        consigneeName: item.consigneeName,
        loadedQty: item.loadedQty,
        receivedQty: "",
        damageQty: item.damageQty,
        shortageQty: 0,
        remarks: item.remarks ?? "",
      })),
    });
    setDamagePhotoFiles([]);
  }, [isEdit, previewQuery.data, router]);

  const source = isEdit ? detailQuery.data : previewQuery.data;
  const railRake = source?.railRake;
  const vp = isEdit
    ? detailQuery.data?.vpWagonLoading
    : previewQuery.data?.vpWagonLoading;
  const isSubmitted = isEdit && detailQuery.data?.status === "SUBMITTED";
  const isEditable =
    !isEdit ||
    detailQuery.data?.status === "DRAFT" ||
    detailQuery.data?.status === "SUBMITTED";
  const busy =
    createGrn.isPending ||
    updateGrn.isPending ||
    submitGrn.isPending ||
    isUploadingPhotos;

  const totals = React.useMemo(
    () =>
      form.items.reduce(
        (total, item) => ({
          loaded: total.loaded + item.loadedQty,
          received: total.received + quantityValue(item.receivedQty),
          damage: total.damage + item.damageQty,
          shortage: total.shortage + item.shortageQty,
        }),
        { loaded: 0, received: 0, damage: 0, shortage: 0 },
      ),
    [form.items],
  );
  const hasDamage = totals.damage > 0;

  React.useEffect(() => {
    if (!hasDamage) {
      setDamagePhotoFiles([]);
      setForm((current) =>
        current.damagesBy === "NONE"
          ? current
          : { ...current, damagesBy: "NONE" },
      );
    }
  }, [hasDamage]);

  const setItem = (
    key: string,
    field: "receivedQty" | "damageQty" | "remarks",
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.key !== key) return item;

        if (field === "remarks") {
          return {
            ...item,
            remarks: value,
          };
        }

        const enteredQty = quantityValue(value);

        if (field === "receivedQty") {
          if (value === "") {
            return {
              ...item,
              receivedQty: "",
              shortageQty: 0,
              damageQty: 0,
            };
          }

          const receivedQty = Math.min(enteredQty, item.loadedQty);

          return {
            ...item,
            receivedQty,

            // Automatically calculate shortage.
            shortageQty: calculateShortage(item.loadedQty, receivedQty),

            // Damage cannot be more than received.
            damageQty: Math.min(item.damageQty, receivedQty),
          };
        }

        return {
          ...item,

          // Damage cannot be more than received.
          damageQty: Math.min(enteredQty, quantityValue(item.receivedQty)),
        };
      }),
    }));
  };
  const handleDamagePhotosChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const validFiles = Array.from(event.target.files ?? []).filter((file) => {
      if (!file.type.toLowerCase().startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > MAX_DAMAGE_PHOTO_BYTES) {
        toast.error(`${file.name} must be less than 2 MB`);
        return false;
      }
      return true;
    });

    setDamagePhotoFiles((current) => {
      const selectedKeys = new Set(current.map(getDamagePhotoKey));
      const uniqueFiles = validFiles.filter((file) => {
        const key = getDamagePhotoKey(file);
        if (selectedKeys.has(key)) {
          toast.error(`${file.name} is already selected`);
          return false;
        }
        selectedKeys.add(key);
        return true;
      });
      return [...current, ...uniqueFiles];
    });

    event.target.value = "";
  };

  const removeDamagePhoto = (file: File) => {
    const key = getDamagePhotoKey(file);
    setDamagePhotoFiles((current) =>
      current.filter((item) => getDamagePhotoKey(item) !== key),
    );
    if (damagePhotoInputRef.current) {
      damagePhotoInputRef.current.value = "";
    }
  };

  const uploadDamagePhotos = async (branchGrnId: string) => {
    if (!damagePhotoFiles.length) return [];
    setIsUploadingPhotos(true);
    try {
      const uploaded = await Promise.all(
        damagePhotoFiles.map((file) =>
          attachmentApi.upload(
            {
              entityType: DAMAGE_PHOTO_ENTITY,
              entityId: branchGrnId,
              originalName: file.name,
              mime: file.type,
              sizeBytes: file.size,
            },
            file,
          ),
        ),
      );
      setDamagePhotoFiles([]);
      return uploaded.map((photo) => photo.id);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const validate = (submitting: boolean) => {
    if (!form.items.length) return "Select a VP to load its goods.";

    if (
      !form.labourCount.trim() ||
      !Number.isInteger(Number(form.labourCount)) ||
      Number(form.labourCount) < 1
    ) {
      return "Enter a valid number of labour (at least 1).";
    }

    if (
      !form.labourCharge.trim() ||
      (!Number.isFinite(Number(form.labourCharge)) ||
        Number(form.labourCharge) < 0)
    ) {
      return "Enter a valid non-negative labour charge.";
    }

    if (!form.unloadingSupervisorId) {
      return "Select an unloading supervisor.";
    }

    for (const item of form.items) {
      if (item.receivedQty === "") {
        return `${item.goodsName}: enter the received quantity.`;
      }

      const receivedQty = quantityValue(item.receivedQty);

      if (receivedQty + item.shortageQty > item.loadedQty) {
        return `${item.goodsName}: received and shortage cannot exceed loaded quantity.`;
      }
      if (item.damageQty > receivedQty) {
        return `${item.goodsName}: damage cannot exceed received quantity.`;
      }
      if (
        submitting &&
        (item.damageQty > 0 || item.shortageQty > 0) &&
        !item.remarks.trim()
      ) {
        return `${item.goodsName}: enter the reason for damage or shortage.`;
      }
      if (
        submitting &&
        receivedQty + item.shortageQty !== item.loadedQty
      ) {
        return `${item.goodsName}: received plus shortage must equal loaded quantity before submission.`;
      }
    }
    if (submitting && hasDamage && form.damagesBy === "NONE") {
      return "Select who is responsible for the damage.";
    }
    if (
      submitting &&
      hasDamage &&
      existingDamagePhotos.length + damagePhotoFiles.length === 0
    ) {
      return "Add at least one photo for the damage.";
    }
    return null;
  };

  const createBody = (): CreateRailBranchGRNBody => ({
    railRakeId: rakeId,
    vpWagonLoadingId,
    inDateTime: toIso(form.inDateTime),
    outDateTime: toIso(form.outDateTime),
    damagesBy: form.damagesBy,
    labourCount: Number(form.labourCount),
    labourCharge: Number(form.labourCharge),
    unloadingSupervisorId: form.unloadingSupervisorId,
    damagePhotoAttachmentIds: [],
    items: form.items.map((item) => ({
      vpLoadingGoodsId: item.sourceId,
      receivedQty: quantityValue(item.receivedQty),
      damageQty: item.damageQty,
      shortageQty: item.shortageQty,
      remarks:
        item.damageQty > 0 || item.shortageQty > 0
          ? item.remarks.trim() || undefined
          : undefined,
    })),
  });

  const updateBody = (
    damagePhotoAttachmentIds: string[] = [],
  ): UpdateRailBranchGRNBody => ({
    version: form.version ?? 0,
    inDateTime: toIso(form.inDateTime),
    outDateTime: toIso(form.outDateTime),
    damagesBy: form.damagesBy,
    labourCount: Number(form.labourCount),
    labourCharge: Number(form.labourCharge),
    unloadingSupervisorId: form.unloadingSupervisorId,
    damagePhotoAttachmentIds,
    items: form.items.map((item) => ({
      id: item.sourceId,
      receivedQty: quantityValue(item.receivedQty),
      damageQty: item.damageQty,
      shortageQty: item.shortageQty,
      remarks:
        item.damageQty > 0 || item.shortageQty > 0
          ? item.remarks.trim() || undefined
          : undefined,
    })),
  });

  const save = async (damagePhotoAttachmentIds: string[] = []) => {
    if (isEdit) {
      const updated = await updateGrn.mutateAsync({
        id: props.id,
        body: updateBody(damagePhotoAttachmentIds),
      });
      setForm(formFromDetail(updated));
      return updated;
    }
    const result = await createGrn.mutateAsync(createBody());
    return result.branchGrn;
  };

  const handleSave = async () => {
    const error = validate(isSubmitted);
    if (error) return toast.error(error);
    try {
      const saved = isEdit
        ? await (async () => {
          const attachmentIds = await uploadDamagePhotos(props.id);
          return save(attachmentIds);
        })()
        : await save();

      if (!isEdit) {
        await uploadDamagePhotos(saved.id);
      }
      toast.success(
        isSubmitted ? "Branch GRN correction saved" : "Branch GRN draft saved",
      );
      router.push(`/vp-management/branch-grn/${saved.id}`);
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  };

  const handleSubmit = async () => {
    const error = validate(true);
    if (error) return toast.error(error);
    try {
      const saved = isEdit
        ? await (async () => {
          const attachmentIds = await uploadDamagePhotos(props.id);
          return save(attachmentIds);
        })()
        : await save();
      const newAttachmentIds = isEdit ? [] : await uploadDamagePhotos(saved.id);
      const result =
        saved.status === "SUBMITTED"
          ? { branchGrn: saved, progress: undefined }
          : await submitGrn.mutateAsync({
            id: saved.id,
            version: saved.version,
            damagePhotoAttachmentIds: newAttachmentIds,
          });
      toast.success(
        result.progress?.allReceived
          ? "Branch GRN submitted. Rail Rake is fully received."
          : "Branch GRN submitted",
      );
      router.push(`/vp-management/branch-grn/${result.branchGrn.id}`);
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  };

  if (isEdit && detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (isEdit && (detailQuery.isError || !detailQuery.data)) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <section className="rounded-lg border bg-card p-5">
          <p className="font-semibold">Unable to load Branch GRN</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getErrorMessage(detailQuery.error)}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/vp-management/branch-grn")}
          >
            Back to Branch GRNs
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => router.push("/vp-management/branch-grn")}
      >
        <IconArrowLeft size={16} className="mr-1.5" />
        Back to Branch GRNs
      </Button>

      <header className="flex flex-col gap-4 rounded-lg border bg-card p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-muted p-2">
            <IconTrain size={22} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">
                {isEdit ? "Edit Branch GRN" : "Create Branch GRN"}
              </h1>
              {isEdit ? (
                <span className="rounded-md border bg-muted px-2.5 py-1 text-xs font-semibold">
                  {detailQuery.data?.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? "Update receiving quantities and submission details."
                : "Select a schedule date and Rake ID, preview the loaded goods, and complete receiving on one page."}
            </p>
          </div>
        </div>

        {isEditable ? (
          <div className="flex flex-wrap gap-2">
            {(isEdit ? canUpdate : canCreate) ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy || !form.items.length}
                onClick={handleSave}
              >
                <IconDeviceFloppy size={16} className="mr-1.5" />
                {isSubmitted ? "Save Correction" : "Save Draft"}
              </Button>
            ) : null}
            {!isSubmitted &&
              canSubmit &&
              (isEdit ? canUpdate : canCreate) ? (
              <Button
                type="button"
                disabled={busy || !form.items.length}
                onClick={handleSubmit}
              >
                <IconCircleCheck size={16} className="mr-1.5" />
                Save & Submit
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {!isEdit ? (
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div>
            <h2 className="font-semibold">Select incoming Rake</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only active destination rakes and loaded VPs without a Branch
              GRN are available.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule date</label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(event) => {
                  setScheduleDate(event.target.value);
                  setRakeId("");
                  setVpWagonLoadingId("");
                  setForm(EMPTY_FORM);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rake ID</label>
              <Combobox
                options={rakeOptions}
                value={rakeId}
                onChange={(value) => {
                  setRakeId(value);
                  setVpWagonLoadingId("");
                  setForm(EMPTY_FORM);
                }}
                placeholder="Select Rake ID"
                emptyText={
                  incomingRakes.isLoading
                    ? "Loading rakes..."
                    : scheduleDate
                      ? "No incoming rake for this date"
                      : "No incoming rakes available"
                }
                disabled={incomingRakes.isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">VP number</label>
              <Combobox
                options={vpOptions}
                value={vpWagonLoadingId}
                onChange={(value) => {
                  setVpWagonLoadingId(value);
                  setForm(EMPTY_FORM);
                }}
                placeholder="Select loaded VP"
                emptyText={
                  availableVPs.isLoading
                    ? "Loading VPs..."
                    : "No loaded VP available"
                }
                disabled={!rakeId || availableVPs.isLoading}
              />
            </div>
          </div>
        </section>
      ) : null}

      {!isEdit && previewQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : null}

      {!isEdit && previewQuery.isError ? (
        <section className="rounded-lg border bg-card p-5">
          <p className="font-semibold">Unable to preview VP goods</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getErrorMessage(previewQuery.error)}
          </p>
        </section>
      ) : null}

      {railRake && vp && form.items.length ? (
        <>
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Rake {railRake.rakeNumber} · VP{" "}
                  {"row" in vp ? vp.row.vpNo : vp.mrRrRow.vpNo}
                </h2>

                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <IconRoute size={16} />
                  {railRake.vpSchedule.sourceArea?.name || "—"} →{" "}
                  {railRake.vpSchedule.destinationArea?.name || "—"}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-5 text-right">
                {[
                  ["Loaded", totals.loaded],
                  ["Received", totals.received],
                  ["Damage", totals.damage],
                  ["Shortage", totals.shortage],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xs uppercase text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatNumber(Number(value))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <IconPackage size={18} />
              Receiving details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">In date and time</label>
                <Input
                  type="datetime-local"
                  value={form.inDateTime}
                  disabled={!isEditable}
                  onChange={(event) =>
                    setForm({ ...form, inDateTime: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Out date and time</label>
                <Input
                  type="datetime-local"
                  value={form.outDateTime}
                  disabled={!isEditable}
                  onChange={(event) =>
                    setForm({ ...form, outDateTime: event.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Loaded goods preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Received quantity includes damaged goods. On submit, received
                plus shortage must equal loaded quantity.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[950px]">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>LR / GRN</TableHead>
                    <TableHead>Goods</TableHead>

                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead>Received Qty</TableHead>
                    <TableHead>Damage Qty</TableHead>
                    <TableHead>Shortage Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.items.map((item) => {
                    const receivedQty = quantityValue(item.receivedQty);
                    const reconciles =
                      item.receivedQty !== "" &&
                      receivedQty + item.shortageQty === item.loadedQty &&
                      item.damageQty <= receivedQty;
                    const quantityClass =
                      item.receivedQty === "" || reconciles
                        ? "w-24"
                        : "w-24 border-destructive";
                    const showReason =
                      item.damageQty > 0 || item.shortageQty > 0;
                    return (
                      <React.Fragment key={item.key}>
                        <TableRow>
                          <TableCell>
                            <p className="font-medium">{item.lrNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.grnNumber}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{item.goodsName}</p>
                          </TableCell>

                          <TableCell className="text-right font-semibold">
                            {formatNumber(item.loadedQty)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={item.loadedQty}
                              step="any"
                              className={quantityClass}
                              value={item.receivedQty}
                              disabled={!isEditable}
                              onChange={(event) =>
                                setItem(
                                  item.key,
                                  "receivedQty",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={receivedQty}
                              step="any"
                              className={quantityClass}
                              value={item.damageQty}
                              disabled={!isEditable}
                              onChange={(event) =>
                                setItem(
                                  item.key,
                                  "damageQty",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <div className="flex h-9 w-24 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                              {item.receivedQty === ""
                                ? "—"
                                : formatNumber(item.shortageQty)}
                            </div>
                          </TableCell>
                        </TableRow>
                        {showReason ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={7} className="px-4 pb-4 pt-0">
                              <div className="rounded-md border bg-muted/20 p-3">
                                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                                  <IconAlertTriangle
                                    size={14}
                                    className="text-destructive"
                                  />
                                  Reason for damage or shortage
                                </div>
                                <Textarea
                                  rows={2}
                                  value={item.remarks}
                                  maxLength={500}
                                  disabled={!isEditable}
                                  placeholder="Enter the reason..."
                                  onChange={(event) =>
                                    setItem(
                                      item.key,
                                      "remarks",
                                      event.target.value,
                                    )
                                  }
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
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-5">
            <div>
              <h2 className="font-semibold">Labour & discrepancy details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Damage information and photos are enabled when damage is
                entered.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Damage by</label>
                <Select
                  value={form.damagesBy}
                  disabled={!isEditable || !hasDamage}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      damagesBy: value as FormState["damagesBy"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Not selected</SelectItem>
                    <SelectItem value="TRANSPORTER">Transporter</SelectItem>
                    <SelectItem value="LABOUR">Labour</SelectItem>
                    <SelectItem value="RAILWAY">Railway</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  No. of Labour <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.labourCount}
                  disabled={!isEditable}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      labourCount: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select labour count" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Labour charge <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.labourCharge}
                  disabled={!isEditable}
                  placeholder="0.00"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      labourCharge: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Unloading supervisor{" "}
                  <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.unloadingSupervisorId}
                  disabled={!isEditable || supervisorsQuery.isLoading}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      unloadingSupervisorId: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        supervisorsQuery.isLoading
                          ? "Loading supervisors..."
                          : "Select supervisor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(supervisorsQuery.data ?? []).map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Damage photos</label>
              <Input
                ref={damagePhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={!isEditable || !hasDamage || busy}
                onChange={handleDamagePhotosChange}
              />
              <p className="text-xs text-muted-foreground">
                At least one image is required before submitting a GRN with
                damage. Maximum 2 MB per image.
              </p>

              {existingDamagePhotos.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {existingDamagePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {photo.originalName || "Damage photo"}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        Existing
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {damagePhotoFiles.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {damagePhotoFiles.map((file) => (
                    <div
                      key={getDamagePhotoKey(file)}
                      className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => removeDamagePhoto(file)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <IconX size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          {isEditable ? (
            <div className="flex justify-end gap-2">
              {(isEdit ? canUpdate : canCreate) ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={handleSave}
                >
                  {isSubmitted ? "Save Correction" : "Save Draft"}
                </Button>
              ) : null}
              {!isSubmitted &&
                canSubmit &&
                (isEdit ? canUpdate : canCreate) ? (
                <Button type="button" disabled={busy} onClick={handleSubmit}>
                  Save & Submit
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
