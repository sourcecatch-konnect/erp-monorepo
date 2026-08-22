"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconClock,
  IconDeviceFloppy,
  IconReceiptRupee,
  IconRoute,
  IconSend,
  IconTrain,
} from "@tabler/icons-react";

import type { CalculateRailRakeOperationBody } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import type {
  RailRakeOperationCharge,
  RailRakeOperationDetail,
} from "./rail-rake-operation.service";
import {
  railRakeOperationContext,
  type RailRakeOperationContext,
} from "./rail-rake-operation.context";
import {
  useCalculateRailRakeOperation,
  useCreateRailRakeOperation,
  useRailRakeOperationRakes,
  useSubmitRailRakeOperation,
  useUpdateRailRakeOperation,
} from "./useRailRakeOperation";

type Props =
  | {
    mode: "create";
    context: RailRakeOperationContext;
    initialData?: never;
  }
  | {
    mode: "edit";
    context: RailRakeOperationContext;
    initialData: RailRakeOperationDetail;
  };

type PlacementState = {
  key: string;
  sequence: number;
  placedAt: string;
  removedAt: string;
  freeHours: string;
};

type ChargeState = {
  type: "DEMURRAGE" | "WHARFAGE";
  ratePerHour: string;
  manualAmount: string;
  chargeLetterDate: string;
  paymentBy: "COMPANY" | "CUSTOMER" | "RAILWAY" | "TRANSPORTER" | "OTHER";
  waiverEnabled: boolean;
  waiverStatus:
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "CANCELLED";
  waiverPercentage: string;
  requestedAmount: string;
  approvedAmount: string;
  waiverReference: string;
  letterGivenAt: string;
  letterApprovedAt: string;
  letterReceivedAt: string;
  paymentEnabled: boolean;
  paymentKind: "CHARGE_PAYMENT" | "WAIVER_RECEIPT";
  paymentStatus: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentAmount: string;
  paymentMode: "CASH" | "BANK" | "UPI" | "CHEQUE";
  paymentAt: string;
  paymentReference: string;
};

const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const toLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const paiseToRupees = (value?: string | number | null) =>
  value == null || value === "" ? "" : String(Number(value) / 100);

const emptyCharge = (type: "DEMURRAGE" | "WHARFAGE"): ChargeState => ({
  type,
  ratePerHour: "",
  manualAmount: "",
  chargeLetterDate: "",
  paymentBy: "COMPANY",
  waiverEnabled: false,
  waiverStatus: "REQUESTED",
  waiverPercentage: "",
  requestedAmount: "",
  approvedAmount: "",
  waiverReference: "",
  letterGivenAt: "",
  letterApprovedAt: "",
  letterReceivedAt: "",
  paymentEnabled: false,
  paymentKind: "CHARGE_PAYMENT",
  paymentStatus: "PENDING",
  paymentAmount: "",
  paymentMode: "BANK",
  paymentAt: "",
  paymentReference: "",
});

const chargeFromDetail = (
  type: "DEMURRAGE" | "WHARFAGE",
  charge?: RailRakeOperationCharge,
): ChargeState => {
  if (!charge) return emptyCharge(type);
  const waiver = type === "DEMURRAGE" ? charge.waivers[0] : undefined;
  const payment = charge.payments[0];
  return {
    type,
    ratePerHour: paiseToRupees(charge.ratePerHour),
    manualAmount: paiseToRupees(charge.grossAmount),
    chargeLetterDate: toLocal(charge.chargeLetterDate),
    paymentBy:
      (charge.paymentBy as ChargeState["paymentBy"] | undefined) ?? "COMPANY",
    waiverEnabled: Boolean(waiver),
    waiverStatus: waiver?.status ?? "REQUESTED",
    waiverPercentage:
      waiver?.waiverPercentage == null ? "" : String(waiver.waiverPercentage),
    requestedAmount: paiseToRupees(waiver?.requestedAmount),
    approvedAmount: paiseToRupees(waiver?.approvedAmount),
    waiverReference: waiver?.referenceNumber ?? "",
    letterGivenAt: toLocal(waiver?.letterGivenAt),
    letterApprovedAt: toLocal(waiver?.letterApprovedAt),
    letterReceivedAt: toLocal(waiver?.letterReceivedAt),
    paymentEnabled: Boolean(payment),
    paymentKind: payment?.kind ?? "CHARGE_PAYMENT",
    paymentStatus: payment?.status ?? "PENDING",
    paymentAmount: paiseToRupees(payment?.amount),
    paymentMode: payment?.paymentMode ?? "BANK",
    paymentAt: toLocal(payment?.paymentAt),
    paymentReference: payment?.referenceNumber ?? "",
  };
};

const placementChargeableMinutes = (placement: PlacementState) => {
  if (!placement.placedAt || !placement.removedAt) return 0;
  const placedAt = new Date(placement.placedAt).getTime();
  const removedAt = new Date(placement.removedAt).getTime();
  if (
    !Number.isFinite(placedAt) ||
    !Number.isFinite(removedAt) ||
    removedAt <= placedAt
  ) {
    return 0;
  }
  const actualMinutes = Math.ceil((removedAt - placedAt) / 60_000);
  const freeMinutes = Math.round(Number(placement.freeHours || 0) * 60);
  return Math.max(actualMinutes - freeMinutes, 0);
};

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium">
      {label}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
    {children}
  </div>
);

const Section = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border bg-card">
    <div className="flex items-start gap-3 border-b px-4 py-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

export default function RailRakeOperationForm({
  mode,
  context,
  initialData,
}: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const contextConfig = railRakeOperationContext[context];
  const [rakeOptionKey, setRakeOptionKey] = React.useState(
    initialData?.railRakeId ?? "",
  );
  const [arrivalAt, setArrivalAt] = React.useState(
    toLocal(initialData?.arrivalAt),
  );
  const [departureAt, setDepartureAt] = React.useState(
    toLocal(initialData?.departureAt),
  );
  const [placements, setPlacements] = React.useState<PlacementState[]>(() => {
    const placement = initialData?.placements?.[0];

    return [
      {
        key: placement?.id ?? crypto.randomUUID(),
        sequence: 1,
        placedAt: toLocal(placement?.placedAt) || nowLocal(),
        removedAt: toLocal(placement?.removedAt),
        freeHours: String((placement?.freeMinutes ?? 0) / 60),
      },
    ];
  });
  const [charges, setCharges] = React.useState<ChargeState[]>(() => [
    chargeFromDetail(
      "DEMURRAGE",
      initialData?.charges.find((charge) => charge.type === "DEMURRAGE"),
    ),
    chargeFromDetail(
      "WHARFAGE",
      initialData?.charges.find((charge) => charge.type === "WHARFAGE"),
    ),
  ]);
  const rakesQuery = useRailRakeOperationRakes(contextConfig.stage);
  const selectedRake = isEdit
    ? {
      id: initialData.railRake.id,
      stage: initialData.stage,
      rakeNumber: initialData.railRake.rakeNumber,
      branch: initialData.branch,
      area: initialData.area,
      fromBranch: initialData.railRake.fromBranch,
      toBranch: initialData.railRake.toBranch,
      sourceArea: initialData.railRake.vpSchedule.sourceArea,
      destinationArea: initialData.railRake.vpSchedule.destinationArea,
      scheduleNumber: initialData.railRake.vpSchedule.scheduleNumber,
    }
    : (rakesQuery.data ?? []).find((rake) => rake.id === rakeOptionKey);
  const stage = selectedRake?.stage;
  const railRakeId = selectedRake?.id ?? "";
  const calculateMutation = useCalculateRailRakeOperation();
  const createMutation = useCreateRailRakeOperation();
  const updateMutation = useUpdateRailRakeOperation();
  const submitMutation = useSubmitRailRakeOperation();
  const canSubmit = useCan(contextConfig.permissions.SUBMIT);
  const busy =
    calculateMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending;
  const rakeHours = placements.map((placement) =>
    Math.ceil(placementChargeableMinutes(placement) / 60),
  );
  const totalRakeHours = rakeHours.reduce((total, hours) => total + hours, 0);
  const demurrageCharge = charges.find(
    (charge) => charge.type === "DEMURRAGE",
  ) as ChargeState;
  const demurrageRate = demurrageCharge.ratePerHour;
  const skippedInitialDemurrageCalculation = React.useRef(false);

  React.useEffect(() => {
    if (!skippedInitialDemurrageCalculation.current) {
      skippedInitialDemurrageCalculation.current = true;
      if (isEdit) return;
    }
    const rate = Number(demurrageRate || 0);
    const amount =
      demurrageRate && Number.isFinite(rate)
        ? String(Math.round(totalRakeHours * rate * 100) / 100)
        : "";
    setCharges((current) =>
      current.map((charge) =>
        charge.type === "DEMURRAGE" && charge.manualAmount !== amount
          ? {
            ...charge,
            manualAmount: amount,
            approvedAmount:
              charge.type === "DEMURRAGE" && charge.waiverPercentage
                ? String(
                  Math.round(
                    Number(amount || 0) *
                    Number(charge.waiverPercentage) *
                    100,
                  ) / 10_000,
                )
                : charge.approvedAmount,
          }
          : charge,
      ),
    );
  }, [demurrageRate, isEdit, totalRakeHours]);

  const setPlacement = (
    key: string,
    field: keyof Omit<PlacementState, "key" | "sequence">,
    value: string,
  ) => {
    setPlacements((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
    setCharges((current) =>
      current.map((charge) =>
        charge.type === "DEMURRAGE" ? { ...charge, manualAmount: "" } : charge,
      ),
    );
  };

  const setCharge = <K extends keyof ChargeState>(
    type: ChargeState["type"],
    field: K,
    value: ChargeState[K],
  ) =>
    setCharges((current) =>
      current.map((charge) =>
        charge.type === type ? { ...charge, [field]: value } : charge,
      ),
    );

  const setChargeAmount = (type: ChargeState["type"], value: string) => {
    setCharges((current) =>
      current.map((charge) =>
        charge.type === type
          ? {
            ...charge,
            manualAmount: value,
            approvedAmount: charge.waiverPercentage
              ? String(
                Math.round(
                  Number(value || 0) *
                  Number(charge.waiverPercentage) *
                  100,
                ) / 10_000,
              )
              : charge.approvedAmount,
          }
          : charge,
      ),
    );
  };

  const setWaiverPercentage = (
    type: ChargeState["type"],
    percentage: string,
  ) => {
    setCharges((current) =>
      current.map((charge) =>
        charge.type === type
          ? {
            ...charge,
            waiverPercentage: percentage,
            approvedAmount: percentage
              ? String(
                Math.round(
                  Number(charge.manualAmount || 0) *
                  Number(percentage) *
                  100,
                ) / 10_000,
              )
              : "",
          }
          : charge,
      ),
    );
  };

  const buildPayload = (): CalculateRailRakeOperationBody => ({
    arrivalAt: arrivalAt ? new Date(arrivalAt) : undefined,
    departureAt: departureAt ? new Date(departureAt) : undefined,
    placements: placements.map((placement) => ({
      sequence: placement.sequence,
      placedAt: new Date(placement.placedAt),
      removedAt: placement.removedAt
        ? new Date(placement.removedAt)
        : undefined,
      freeMinutes: Math.round(Number(placement.freeHours || 0) * 60),
    })),
    charges: charges.map((charge) => ({
      type: charge.type,
      ratePerHour:
        charge.type === "DEMURRAGE" && charge.ratePerHour
          ? Number(charge.ratePerHour)
          : undefined,
      manualAmount: charge.manualAmount
        ? Number(charge.manualAmount)
        : undefined,
      chargeLetterDate: charge.chargeLetterDate
        ? new Date(charge.chargeLetterDate)
        : undefined,
      paymentBy: charge.paymentBy,
      waiver:
        charge.type === "DEMURRAGE"
          ? {
            enabled: charge.waiverEnabled,
            status: charge.waiverStatus,
            waiverPercentage: charge.waiverPercentage
              ? Number(charge.waiverPercentage)
              : undefined,
            requestedAmount: charge.requestedAmount
              ? Number(charge.requestedAmount)
              : undefined,
            approvedAmount: charge.approvedAmount
              ? Number(charge.approvedAmount)
              : undefined,
            referenceNumber: charge.waiverReference || undefined,
            letterGivenAt: charge.letterGivenAt
              ? new Date(charge.letterGivenAt)
              : undefined,
            letterApprovedAt: charge.letterApprovedAt
              ? new Date(charge.letterApprovedAt)
              : undefined,
            letterReceivedAt: charge.letterReceivedAt
              ? new Date(charge.letterReceivedAt)
              : undefined,
          }
          : undefined,
      payment: {
        enabled: charge.paymentEnabled,
        kind: charge.paymentKind,
        status: charge.paymentStatus,
        amount: charge.paymentAmount ? Number(charge.paymentAmount) : undefined,
        paymentBy: charge.paymentBy,
        paymentMode: charge.paymentMode,
        paymentAt: charge.paymentAt ? new Date(charge.paymentAt) : undefined,
        referenceNumber: charge.paymentReference || undefined,
      },
    })),
  });

  const validate = (submitting: boolean) => {
    if (!selectedRake || !stage || !railRakeId) return "Select a Rake ID";
    if (placements.length !== 1) {
      return "Exactly one rake placement is required";
    }
    if (placements.some((row) => !row.placedAt)) {
      return "Placement date and time are required";
    }
    if (submitting && placements.some((row) => !row.removedAt)) {
      return "Every placement needs a removal time before submission";
    }
    if (submitting && placements.some((row) => !row.removedAt)) {
      return "Every placement needs a removal time before submission";
    }
    for (const charge of charges) {
      if (
        charge.type === "DEMURRAGE" &&
        charge.waiverEnabled &&
        (charge.waiverStatus === "APPROVED" ||
          charge.waiverStatus === "RECEIVED") &&
        !charge.approvedAmount &&
        !charge.waiverPercentage
      ) {
        return `${charge.type}: enter an approved waiver amount or percentage`;
      }
      if (
        charge.paymentEnabled &&
        (!charge.paymentAmount || !charge.paymentAt)
      ) {
        return `${charge.type}: enter payment amount and date`;
      }
    }
    return null;
  };

  const calculate = async () => {
    const error = validate(false);
    if (error) {
      toast.error(error);
      return null;
    }
    try {
      const result = await calculateMutation.mutateAsync(buildPayload());
      return result;
    } catch (cause) {
      toast.error(getErrorMessage(cause));
      return null;
    }
  };

  const save = async () => {
    const payload = buildPayload();
    if (isEdit) {
      return updateMutation.mutateAsync({
        id: initialData.id,
        body: { ...payload, version: initialData.version },
      });
    }
    if (!selectedRake) {
      throw new Error("Select a Rake ID");
    }
    return createMutation.mutateAsync({
      ...payload,
      railRakeId: selectedRake.id,
      stage: selectedRake.stage,
    });
  };

  const handleSave = async () => {
    const error = validate(false);
    if (error) return toast.error(error);
    try {
      const calculated = await calculate();
      if (!calculated) return;
      const saved = await save();
      toast.success("Rake operation draft saved");
      router.push(`${contextConfig.basePath}/${saved.id}`);
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  };

  const handleSubmit = async () => {
    const error = validate(true);
    if (error) return toast.error(error);
    if (
      !window.confirm("Submit this Rake operation? It will become read-only.")
    ) {
      return;
    }
    try {
      const calculated = await calculate();
      if (!calculated) return;
      const saved = await save();
      const submitted =
        saved.status === "SUBMITTED"
          ? saved
          : await submitMutation.mutateAsync({
            id: saved.id,
            version: saved.version,
          });
      toast.success("Rake operation submitted");
      router.push(`${contextConfig.basePath}/${submitted.id}`);
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="icon-sm" variant="outline" asChild>
            <Link href={contextConfig.basePath}>
              <IconArrowLeft size={16} />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {isEdit ? `Edit ${contextConfig.title}` : contextConfig.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {contextConfig.description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={busy}>
            <IconDeviceFloppy size={16} className="mr-1.5" />
            Save draft
          </Button>
          {canSubmit ? (
            <Button onClick={handleSubmit} disabled={busy}>
              <IconSend size={16} className="mr-1.5" />
              Submit
            </Button>
          ) : null}
        </div>
      </div>

      <Section
        icon={<IconTrain size={18} />}
        title="Rake details"
        description="Available Rakes are filtered by your assigned branch. The operation location is selected automatically."
      >
        <div>
          <Field label="Rake ID" required>
            {isEdit ? (
              <Input value={initialData.railRake.rakeNumber} disabled />
            ) : (
              <Select
                value={rakeOptionKey}
                onValueChange={setRakeOptionKey}
                disabled={rakesQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      rakesQuery.isLoading ? "Loading Rakes..." : "Select Rake"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(rakesQuery.data ?? []).map((rake) => (
                    <SelectItem
                      key={`${rake.id}-${rake.stage}`}
                      value={rake.id}
                    >
                      {rake.rakeNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
        {selectedRake ? (
          <div className="mt-4 rounded-md border bg-muted/20 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  From branch
                </p>
                <p className="text-sm font-medium">
                  {selectedRake.fromBranch.name}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  Source railhead
                </p>
                <p className="text-sm font-medium">
                  {selectedRake.sourceArea.name}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  To branch
                </p>
                <p className="text-sm font-medium">
                  {selectedRake.toBranch.name}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  Destination railhead
                </p>
                <p className="text-sm font-medium">
                  {selectedRake.destinationArea.name}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              Responsible branch:{" "}
              <span className="font-medium text-foreground">
                {selectedRake.branch.name}
              </span>{" "}
              · Operation area:{" "}
              <span className="font-medium text-foreground">
                {selectedRake.area.name}
              </span>
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        icon={<IconRoute size={18} />}
        title="Movement timeline"
        description="These timings do not block Branch GRN or Delivery Challan availability."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Arrival date and time">
            <Input
              type="datetime-local"
              value={arrivalAt}
              onChange={(event) => setArrivalAt(event.target.value)}
            />
          </Field>
          <Field label="Dispatch / departure date and time">
            <Input
              type="datetime-local"
              value={departureAt}
              onChange={(event) => setDepartureAt(event.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<IconClock size={18} />}
        title="Rake placement and removal"
        description="Record the placement and removal time for the rake."
      >
        <div className="space-y-3">
          {placements.map((placement, index) => (
            <div
              key={placement.key}
              className="grid gap-3 rounded-md border p-3 md:grid-cols-[110px_1fr_1fr_120px_120px]"
            >
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  Rake
                </p>
                <p className="mt-4 text-sm font-semibold">
                  Rake
                </p>
              </div>
              <Field label="Placed at" required>
                <Input
                  type="datetime-local"
                  value={placement.placedAt}
                  onChange={(event) =>
                    setPlacement(placement.key, "placedAt", event.target.value)
                  }
                />
              </Field>
              <Field label="Removed at">
                <Input
                  type="datetime-local"
                  value={placement.removedAt}
                  onChange={(event) =>
                    setPlacement(placement.key, "removedAt", event.target.value)
                  }
                />
              </Field>
              <Field label="Free hours">
                <Input
                  type="number"
                  min={0}
                  step="0.25"
                  value={placement.freeHours}
                  onChange={(event) =>
                    setPlacement(placement.key, "freeHours", event.target.value)
                  }
                />
              </Field>
              <Field label="DC hours">
                <Input value={String(rakeHours[index] ?? 0)} disabled />
              </Field>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        {charges.map((charge) => (
          <Section
            key={charge.type}
            icon={<IconReceiptRupee size={18} />}
            title={
              charge.type === "DEMURRAGE"
                ? "Demurrage charge (DC)"
                : "Wharfage charge (WC)"
            }
            description={
              charge.type === "DEMURRAGE"
                ? "Calculated from chargeable placement time and the hourly rate."
                : "Enter the assessed Wharfage amount."
            }
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {charge.type === "DEMURRAGE" ? (
                  <>
                    <Field label="Total DC hours">
                      <Input value={String(totalRakeHours)} disabled />
                    </Field>
                    <Field label="Rate per hour (₹)">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={charge.ratePerHour}
                        onChange={(event) => {
                          setCharge(
                            charge.type,
                            "ratePerHour",
                            event.target.value,
                          );
                          setCharge(charge.type, "manualAmount", "");
                        }}
                      />
                    </Field>
                    <Field label="Total Demurrage amount (₹)">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={charge.manualAmount}
                        onChange={(event) =>
                          setChargeAmount(charge.type, event.target.value)
                        }
                      />
                    </Field>
                  </>
                ) : (
                  <Field label="Wharfage amount (₹)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={charge.manualAmount}
                      onChange={(event) =>
                        setChargeAmount(charge.type, event.target.value)
                      }
                    />
                  </Field>
                )}
                <Field label="Charge letter date">
                  <Input
                    type="datetime-local"
                    value={charge.chargeLetterDate}
                    onChange={(event) =>
                      setCharge(
                        charge.type,
                        "chargeLetterDate",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Payment by">
                  <Select
                    value={charge.paymentBy}
                    onValueChange={(value) =>
                      setCharge(
                        charge.type,
                        "paymentBy",
                        value as ChargeState["paymentBy"],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "COMPANY",
                        "CUSTOMER",
                        "RAILWAY",
                        "TRANSPORTER",
                        "OTHER",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </Section>
        ))}
      </div>

      <Section
        icon={<IconReceiptRupee size={18} />}
        title="Waiver details"
        description="Waiver applies only to the Demurrage charge."
      >
        <div className="max-w-3xl rounded-md border p-4">
          <p className="mb-4 text-sm font-medium">Demurrage waiver (DC)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Waiver status">
              <Select
                value={
                  demurrageCharge.waiverEnabled
                    ? demurrageCharge.waiverStatus
                    : "NONE"
                }
                onValueChange={(value) => {
                  if (value === "NONE") {
                    setCharge("DEMURRAGE", "waiverEnabled", false);
                    return;
                  }
                  setCharge("DEMURRAGE", "waiverEnabled", true);
                  setCharge(
                    "DEMURRAGE",
                    "waiverStatus",
                    value as ChargeState["waiverStatus"],
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "NONE",
                    "REQUESTED",
                    "APPROVED",
                    "REJECTED",
                    "RECEIVED",
                    "CANCELLED",
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "NONE" ? "No waiver" : value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Waiver percentage">
              <Input
                type="number"
                min={0}
                max={100}
                value={demurrageCharge.waiverPercentage}
                onChange={(event) =>
                  setWaiverPercentage("DEMURRAGE", event.target.value)
                }
              />
            </Field>
            <Field label="Waiver amount (₹)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={demurrageCharge.approvedAmount}
                onChange={(event) =>
                  setCharge("DEMURRAGE", "approvedAmount", event.target.value)
                }
              />
            </Field>
          </div>
        </div>
      </Section>
    </div>
  );
}
