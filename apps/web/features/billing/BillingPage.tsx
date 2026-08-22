"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconBuilding,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconFileInvoice,
  IconLink,
  IconMapPin,
  IconReceiptRupee,
  IconRefresh,
  IconReceipt,
  IconShieldCheck,
  IconTruckDelivery,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@skerp/ui/components/Card";
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
import { useCan } from "@/features/auth";
import {
  billingApi,
  type AvailableBillCharge,
  type Bill,
  type BillPartyType,
  type BillType,
  type ChargeMechanism,
  type EligibilityFilters,
} from "./billing.service";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const money = (paise: string | bigint) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(BigInt(paise)) / 100,
  );

const invoiceDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value))
    : "—";

const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <label className={`space-y-1.5 text-xs font-medium ${className ?? ""}`}>
    <span>{label}</span>
    {children}
  </label>
);

const formatLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export type BillStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "FINALISED"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

const STATUS_LABELS: Record<BillStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  FINALISED: "Finalised",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<BillStatus, string> = {
  DRAFT:
    "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",

  PENDING_REVIEW:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",

  APPROVED:
    "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",

  FINALISED:
    "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",

  SENT:
    "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",

  PARTIALLY_PAID:
    "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400",

  PAID:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",

  CANCELLED:
    "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function BillStatusBadge({
  status,
  className,
}: {
  status: BillStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />

      {STATUS_LABELS[status]}
    </span>
  );
}

function StepHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
        {step}
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function BillPreview({ bill }: { bill: Bill }) {
  const router = useRouter();
  const canCreate = useCan(PERMS.BILLING.CREATE);
  const canUpdate = useCan(PERMS.BILLING.UPDATE);
  const canApproveCharge = useCan(PERMS.BILLING.CHARGE_APPROVE);
  const canApprove = useCan(PERMS.BILLING.APPROVE);
  const canFinalise = useCan(PERMS.BILLING.FINALISE);
  const canCancel = useCan(PERMS.BILLING.CANCEL);
  const queryClient = useQueryClient();
  const [current, setCurrent] = React.useState(bill);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [chargeToCancel, setChargeToCancel] =
    React.useState<AvailableBillCharge | null>(null);
  const [chargeCancelReason, setChargeCancelReason] = React.useState("");
  const [selectedAdditional, setSelectedAdditional] = React.useState<
    Set<string>
  >(new Set());
  const [selectedSeparate, setSelectedSeparate] = React.useState<Set<string>>(
    new Set(),
  );
  const [manualLRId, setManualLRId] = React.useState("");
  const [manualType, setManualType] = React.useState("HAMALI");
  const [manualEffect, setManualEffect] = React.useState<
    "ADDITION" | "DEDUCTION"
  >("ADDITION");
  const [manualAmount, setManualAmount] = React.useState("");
  const [manualReason, setManualReason] = React.useState("");
  React.useEffect(() => setCurrent(bill), [bill]);
  const invoiceRows = React.useMemo(() => {
    const rows = new Map<
      string,
      {
        lr: NonNullable<Bill["lines"]>[number]["lr"];
        charges: string[];
        freightPaise: bigint;
        additionsPaise: bigint;
        deductionsPaise: bigint;
        totalPaise: bigint;
      }
    >();

    for (const line of current.lines ?? []) {
      const row = rows.get(line.lrId) ?? {
        lr: line.lr,
        charges: [],
        freightPaise: 0n,
        additionsPaise: 0n,
        deductionsPaise: 0n,
        totalPaise: 0n,
      };
      const amount = BigInt(line.amountPaise);
      row.charges.push(formatLabel(line.chargeTypeSnapshot));
      if (line.chargeTypeSnapshot === "FREIGHT") row.freightPaise += amount;
      else if (line.effectSnapshot === "DEDUCTION")
        row.deductionsPaise += amount;
      else row.additionsPaise += amount;
      row.totalPaise += line.effectSnapshot === "DEDUCTION" ? -amount : amount;
      rows.set(line.lrId, row);
    }

    return [...rows.values()];
  }, [current.lines]);
  // LRs linked to this bill (same truck) that carry no charge of their own —
  // their freight is billed through the row above that has freightPaise > 0.
  const companionRows = React.useMemo(() => {
    const billedLrIds = new Set(invoiceRows.map((row) => row.lr.id));
    return (current.lrLinks ?? [])
      .map((link) => link.lr)
      .filter((lr) => !billedLrIds.has(lr.id));
  }, [current.lrLinks, invoiceRows]);

  const freightOwnerLRNumber = invoiceRows.find(
    (row) => row.freightPaise > 0n,
  )?.lr.lrNumber;

  const firstLR = invoiceRows[0]?.lr;
  React.useEffect(() => {
    if (!manualLRId && invoiceRows[0]?.lr.id)
      setManualLRId(invoiceRows[0].lr.id);
  }, [invoiceRows, manualLRId]);
  const availableCharges = useQuery({
    queryKey: ["billing", "bill", current.id, "available-charges"],
    queryFn: () => billingApi.availableBillCharges(current.id),
    enabled: current.status === "DRAFT" && canUpdate,
  });
  const splitByChargeType = Boolean(
    current.serviceCustomer?.splitBillsByChargeType,
  );
  const currentChargeKind = current.lines?.every(
    (line) => line.chargeTypeSnapshot === "FREIGHT",
  )
    ? "FREIGHT"
    : "ADDITIONAL";
  const compatibleCharges =
    availableCharges.data?.filter(
      (charge) =>
        !splitByChargeType ||
        (charge.type === "FREIGHT" ? "FREIGHT" : "ADDITIONAL") ===
        currentChargeKind,
    ) ?? [];
  const separateBillCharges =
    availableCharges.data?.filter(
      (charge) =>
        splitByChargeType &&
        (charge.type === "FREIGHT" ? "FREIGHT" : "ADDITIONAL") !==
        currentChargeKind,
    ) ?? [];
  // Merge, don't replace: some actions (return-to-draft, cancel, submit,
  // approve) now return a slim { id, version, status } patch instead of the
  // full deep bill detail, since they never change lines/LR/group data —
  // merging keeps whatever `current` already has for everything else.
  const applyUpdatedBill = (updated: Partial<Bill>, message: string) => {
    setCurrent((prev) => ({ ...prev, ...updated }));
    setSelectedAdditional(new Set());
    setSelectedSeparate(new Set());
    void availableCharges.refetch();
    void queryClient.invalidateQueries({ queryKey: ["billing", "bills"] });
    void queryClient.invalidateQueries({
      queryKey: ["billing", "bill", current.id],
    });
    toast.success(message);
  };
  const appendCharges = useMutation({
    mutationFn: (chargeIds: string[]) =>
      billingApi.addBillCharges(current.id, chargeIds, current.version),
    onSuccess: (updated) =>
      applyUpdatedBill(updated, "Charges added and bill totals recalculated"),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not add charges",
      ),
  });
  const createSiblingDraft = (chargeIds: string[]) => {
    if (!current.branch.id || !current.serviceCustomer?.id)
      throw new Error("Bill branch or customer details are incomplete");
    return billingApi.createBill({
      branchId: current.branch.id,
      billType: current.billType,
      billingPartyType: current.billingPartyType,
      customerId: current.serviceCustomer.id,
      ...(current.billType === "ROAD_GTA"
        ? { chargeMechanism: current.chargeMechanism }
        : {}),
      billDate: current.billDate,
      billingCutoffDate: current.billingCutoffDate ?? null,
      remarks: `Separate ${currentChargeKind === "FREIGHT" ? "additional-charge" : "freight"} draft linked to ${current.billNumber ?? "the original draft"}`,
      lrChargeIds: chargeIds,
    });
  };
  const createSeparateDraft = useMutation({
    mutationFn: () => createSiblingDraft([...selectedSeparate]),
    onSuccess: (created) => {
      setSelectedSeparate(new Set());
      void availableCharges.refetch();
      void queryClient.invalidateQueries({ queryKey: ["billing", "bills"] });
      toast.success("Separate charge draft created");
      router.push(`/accounts/bills/${created[0]!.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create the separate draft",
      ),
  });
  const createAndAppendCharge = useMutation({
    mutationFn: async () => {
      const rupees = Number(manualAmount);
      if (!manualLRId || !Number.isFinite(rupees) || rupees <= 0)
        throw new Error("Select an LR and enter a valid charge amount");
      if (manualReason.trim().length < 3)
        throw new Error("Enter a reason for the charge");
      const charge = await billingApi.createManualCharge(manualLRId, {
        type: manualType,
        effect: manualEffect,
        amountPaise: String(Math.round(rupees * 100)),
        reason: manualReason.trim() || undefined,
        description: manualReason.trim() || undefined,
        isTaxable: manualType !== "DAMAGE_DEDUCTION",
      });
      await billingApi.approveCharge(charge.id);
      const manualChargeKind =
        manualType === "FREIGHT" ? "FREIGHT" : "ADDITIONAL";
      if (splitByChargeType && manualChargeKind !== currentChargeKind)
        return {
          kind: "SEPARATE" as const,
          bills: await createSiblingDraft([charge.id]),
        };
      return {
        kind: "UPDATED" as const,
        bill: await billingApi.addBillCharges(
          current.id,
          [charge.id],
          current.version,
        ),
      };
    },
    onSuccess: (result) => {
      setManualAmount("");
      setManualReason("");
      if (result.kind === "SEPARATE") {
        toast.success("New charge added to a separate draft");
        void queryClient.invalidateQueries({ queryKey: ["billing", "bills"] });
        router.push(`/accounts/bills/${result.bills[0]!.id}`);
      } else {
        applyUpdatedBill(result.bill, "New charge added to the existing draft");
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not add charge",
      ),
  });
  const returnToDraft = useMutation({
    mutationFn: () =>
      billingApi.returnBillToDraft(
        current.id,
        current.version,
        "Returned to draft for charge amendment",
      ),
    onSuccess: (updated) =>
      applyUpdatedBill(updated, "Bill returned to draft for amendment"),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not return bill",
      ),
  });
  const action = useMutation({
    mutationFn: (name: "approve" | "finalise") =>
      billingApi.transition(current.id, name),
    onSuccess: (updated) => {
      // approve returns a slim { id, version, status } patch (no line/LR/
      // group data changed); finalise still returns the full detail since
      // it recalculates totals — merging handles both correctly either way.
      setCurrent((prev) => ({ ...prev, ...updated }));
      void queryClient.invalidateQueries({ queryKey: ["billing", "bills"] });
      toast.success(`Bill moved to ${updated.status}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Bill action failed",
      ),
  });
  const cancelBill = useMutation({
    mutationFn: () => billingApi.cancel(current.id, cancelReason.trim()),
    onSuccess: (updated) => {
      setCurrent((prev) => ({ ...prev, ...updated }));
      setCancelOpen(false);
      setCancelReason("");
      void queryClient.invalidateQueries({ queryKey: ["billing", "bills"] });
      toast.success(
        "Bill cancelled. Its LR charges are available for billing again.",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Bill cancellation failed",
      ),
  });
  const cancelCharge = useMutation({
    mutationFn: () =>
      billingApi.cancelCharge(chargeToCancel!.id, chargeCancelReason.trim()),
    onSuccess: () => {
      setChargeToCancel(null);
      setChargeCancelReason("");
      setSelectedAdditional(new Set());
      setSelectedSeparate(new Set());
      void availableCharges.refetch();
      void queryClient.invalidateQueries({ queryKey: ["billing", "eligible"] });
      toast.success("Charge cancelled and removed from billing");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not cancel charge",
      ),
  });
  const workflow = ["DRAFT", "APPROVED", "FINALISED"];
  const currentStep = Math.max(0, workflow.indexOf(current.status));
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="flex-col items-start justify-between gap-4 border-b bg-muted/30 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{current.billNumber ?? "Draft invoice"}</CardTitle>
            <BillStatusBadge status={current.status as BillStatus} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatLabel(current.billType)} /{" "}
            {formatLabel(current.taxTreatment)}
          </p>
          <p className="hidden">
            {current.status} · {current.taxTreatment}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["PENDING_REVIEW", "APPROVED"].includes(current.status) &&
            canApprove ? (
            <Button
              variant="outline"
              onClick={() => returnToDraft.mutate()}
              disabled={returnToDraft.isPending}
            >
              {returnToDraft.isPending ? "Returning..." : "Return to draft"}
            </Button>
          ) : null}
          {["DRAFT", "PENDING_REVIEW"].includes(current.status) &&
            canApprove ? (
            <Button
              onClick={() => action.mutate("approve")}
              disabled={action.isPending}
            >
              <IconCheck size={16} className="mr-1" /> Approve bill
            </Button>
          ) : null}
          {current.status === "APPROVED" && canFinalise ? (
            <Button
              onClick={() => action.mutate("finalise")}
              disabled={action.isPending}
            >
              <IconCircleCheck size={16} className="mr-1" /> Finalise invoice
            </Button>
          ) : null}
          {canCancel &&
            !["CANCELLED", "PARTIALLY_PAID", "PAID"].includes(current.status) ? (
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={action.isPending || cancelBill.isPending}
              className="text-destructive hover:text-destructive"
            >
              <IconX size={16} className="mr-1" /> Cancel bill
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-4 gap-2" aria-label="Bill workflow">
          {workflow.map((status, index) => (
            <div key={status} className="space-y-2">
              <div
                className={`h-1 rounded-sm ${index <= currentStep ? "bg-primary" : "bg-muted"}`}
              />
              <p
                className={`text-xs font-medium ${index <= currentStep ? "text-foreground" : "text-muted-foreground"}`}
              >
                {formatLabel(status)}
              </p>
            </div>
          ))}
        </div>
        <div
          className={
            current.status === "DRAFT" && canUpdate
              ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]"
              : "space-y-6"
          }
        >
          {current.status === "DRAFT" && canUpdate ? (
            <aside className="space-y-4 rounded-md border border-primary/20 bg-primary/5 p-4 xl:col-start-2 xl:row-span-4 xl:row-start-1">
              <div>
                <p className="font-semibold">Edit draft charges</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {splitByChargeType
                    ? "This customer separates freight and additional charges. Matching charges update this draft; the other category creates its separate draft."
                    : "This draft already reserves its LRs. Add later approved charges here instead of creating another invoice."}{" "}
                  GST and totals are recalculated automatically.
                </p>
              </div>
              {compatibleCharges.length ? (
                <div className="space-y-2">
                  {compatibleCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between gap-4 rounded-md border bg-background p-3 text-sm"
                    >
                      <span className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedAdditional.has(charge.id)}
                          onCheckedChange={(checked) =>
                            setSelectedAdditional((currentSelection) => {
                              const next = new Set(currentSelection);
                              if (checked) next.add(charge.id);
                              else next.delete(charge.id);
                              return next;
                            })
                          }
                        />
                        <span>
                          <span className="font-medium">
                            {charge.lrNumber} · {formatLabel(charge.type)}
                          </span>
                          {charge.description ? (
                            <span className="block text-xs text-muted-foreground">
                              {charge.description}
                            </span>
                          ) : null}
                          {charge.source !== "MANUAL" ? (
                            <span className="block text-xs text-muted-foreground">
                              System charge — correct its source record to
                              remove it
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="font-medium">
                        {charge.effect === "DEDUCTION" ? "−" : ""}
                        {money(charge.remainingAmountPaise)}
                      </span>
                      {charge.source === "MANUAL" && canApproveCharge ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setChargeToCancel(charge)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !selectedAdditional.size || appendCharges.isPending
                    }
                    onClick={() =>
                      appendCharges.mutate([...selectedAdditional])
                    }
                  >
                    {appendCharges.isPending
                      ? "Adding charges..."
                      : `Add ${selectedAdditional.size} approved charge${selectedAdditional.size === 1 ? "" : "s"}`}
                  </Button>
                </div>
              ) : null}
              {separateBillCharges.length && canCreate ? (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                  <div>
                    <p className="font-semibold">Separate bill required</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This customer separates freight and additional charges.
                      Select these charges to create the matching second draft.
                    </p>
                  </div>
                  {separateBillCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
                    >
                      <span className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedSeparate.has(charge.id)}
                          onCheckedChange={(checked) =>
                            setSelectedSeparate((currentSelection) => {
                              const next = new Set(currentSelection);
                              if (checked) next.add(charge.id);
                              else next.delete(charge.id);
                              return next;
                            })
                          }
                        />
                        <span>
                          <span className="font-medium">
                            {charge.lrNumber} · {formatLabel(charge.type)}
                          </span>
                          {charge.description ? (
                            <span className="block text-xs text-muted-foreground">
                              {charge.description}
                            </span>
                          ) : null}
                          {charge.source !== "MANUAL" ? (
                            <span className="block text-xs text-muted-foreground">
                              System charge — correct its source record to
                              remove it
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="font-medium">
                        {charge.effect === "DEDUCTION" ? "−" : ""}
                        {money(charge.remainingAmountPaise)}
                      </span>
                      {charge.source === "MANUAL" && canApproveCharge ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setChargeToCancel(charge)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="button"
                    disabled={
                      !selectedSeparate.size || createSeparateDraft.isPending
                    }
                    onClick={() => createSeparateDraft.mutate()}
                  >
                    {createSeparateDraft.isPending
                      ? "Creating separate draft..."
                      : `Create ${currentChargeKind === "FREIGHT" ? "additional-charge" : "freight"} draft`}
                  </Button>
                </div>
              ) : null}
              {canCreate && canApproveCharge ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Create a new manual charge
                  </summary>

                  <form
                    className="mt-4 space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      createAndAppendCharge.mutate();
                    }}
                  >
                    {/* Separate LR row */}
                    <Field label="LR">
                      <Select value={manualLRId} onValueChange={setManualLRId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select LR" />
                        </SelectTrigger>

                        <SelectContent>
                          {invoiceRows.map((row) => (
                            <SelectItem key={row.lr.id} value={row.lr.id}>
                              {row.lr.lrNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    {/* Charge and Effect */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Charge">
                        <Select
                          value={manualType}
                          onValueChange={setManualType}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select charge" />
                          </SelectTrigger>

                          <SelectContent>
                            {[
                              "DETENTION",
                              "HAMALI",
                              "UNLOADING",
                              "TOLL",
                              "MULTIPOINT",
                              "FREIGHT_ADJUSTMENT",
                              "DAMAGE_DEDUCTION",
                              "OTHER",
                            ].map((type) => (
                              <SelectItem key={type} value={type}>
                                {formatLabel(type)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Effect">
                        <Select
                          value={manualEffect}
                          onValueChange={(value) =>
                            setManualEffect(value as "ADDITION" | "DEDUCTION")
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select effect" />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="ADDITION">Addition</SelectItem>
                            <SelectItem value="DEDUCTION">Deduction</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    {/* Amount */}
                    <div className="md:max-w-[calc(50%-0.5rem)]">
                      <Field label="Amount (₹)">
                        <Input
                          inputMode="decimal"
                          value={manualAmount}
                          onChange={(event) =>
                            setManualAmount(event.target.value)
                          }
                          placeholder="0.00"
                        />
                      </Field>
                    </div>

                    {/* Full-width Reason */}
                    <Field label="Reason">
                      <Textarea
                        value={manualReason}
                        onChange={(event) =>
                          setManualReason(event.target.value)
                        }
                        placeholder="Enter the reason for this manual charge"
                        rows={3}
                        className="resize-none"
                      />
                    </Field>

                    <Button
                      type="submit"
                      disabled={
                        createAndAppendCharge.isPending ||
                        !manualLRId ||
                        !manualAmount.trim()

                      }
                    >
                      {createAndAppendCharge.isPending
                        ? "Adding charge..."
                        : "Add and approve charge"}
                    </Button>
                  </form>
                </details>
              ) : null}
            </aside>
          ) : null}
          <div className="grid gap-4 text-sm md:grid-cols-2 xl:col-start-1">
            <div className="rounded-md border p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <IconBuilding size={15} /> Supplier
              </p>
              <p className="font-semibold">{current.supplierNameSnapshot}</p>
              <p className="mt-1 text-muted-foreground">
                GSTIN: {current.supplierGstinSnapshot ?? "Not available"}
              </p>
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <p className="hidden">
                <IconUsers size={15} /> Bill To ·{" "}
                {formatLabel(current.billingPartyType)}
              </p>
              <p className="mb-3 flex items-center gap-2 text-xs font-medium text-primary">
                <IconUsers size={15} /> Bill To /{" "}
                {formatLabel(current.billingPartyType)}
              </p>
              <p className="font-semibold">
                {current.billingPartyNameSnapshot}
              </p>
              <p className="mt-1 text-muted-foreground">
                GSTIN: {current.billingGstinSnapshot ?? "Not available"}
              </p>
              <p className="mt-2 flex items-center gap-1">
                <IconMapPin size={15} /> Place of Supply:{" "}
                {current.placeOfSupplyNameSnapshot}
              </p>
            </div>
          </div>
          {firstLR ? (
            <div className="grid gap-4 text-sm lg:grid-cols-2 xl:col-start-1">
              <div className="rounded-md border p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Consignor / pickup
                </p>
                <p className="font-semibold">{firstLR.group.consignor.name}</p>
                <p className="mt-1 text-muted-foreground">
                  {firstLR.loadingLocation?.address ??
                    firstLR.group.consignor.address ??
                    "Address not recorded"}
                </p>
                <p className="mt-2 text-xs">
                  GSTIN:{" "}
                  {firstLR.loadingLocation?.gstNo ??
                    firstLR.group.consignor.gstNo ??
                    "Not available"}
                  {firstLR.group.consignor.customerPAN
                    ? ` · PAN: ${firstLR.group.consignor.customerPAN}`
                    : ""}
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Consignee / delivery
                </p>
                <p className="font-semibold">{firstLR.group.consignee.name}</p>
                <p className="mt-1 text-muted-foreground">
                  {firstLR.unloadingLocation?.address ??
                    firstLR.group.consignee.address ??
                    "Address not recorded"}
                </p>
                <p className="mt-2 text-xs">
                  GSTIN:{" "}
                  {firstLR.unloadingLocation?.gstNo ??
                    firstLR.group.consignee.gstNo ??
                    "Not available"}
                  {firstLR.group.consignee.customerPAN
                    ? ` · PAN: ${firstLR.group.consignee.customerPAN}`
                    : ""}
                </p>
              </div>
            </div>
          ) : null}
          <div className="space-y-4 xl:col-start-1">
            {invoiceRows.map((row) => {
              const vehicle =
                row.lr.group.marketVehicleNumber ??
                row.lr.group.marketVehicle?.vehicleNumber ??
                row.lr.group.primaryTrip?.vehicle.vehicleNumber ??
                row.lr.group.secondaryTrip?.vehicle.vehicleNumber ??
                "—";

              const vehicleType =
                row.lr.group.primaryTrip?.vehicle.vehicleTypeRef.name ??
                row.lr.group.marketVehicle?.vehicleTypeRef.name ??
                "Vehicle size not recorded";

              const quantity = row.lr.goods.reduce(
                (total, goods) => total + goods.quantity,
                0,
              );

              return (
                <div
                  key={row.lr.id}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  {/* Card header */}
                  <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{row.lr.lrNumber}</p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{invoiceDate(row.lr.createdAt)}</span>
                        <span>{formatLabel(row.lr.group.transportType)}</span>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-xs text-muted-foreground">LR total</p>
                      <p className="text-lg font-semibold">
                        {money(row.totalPaise)}
                      </p>
                    </div>
                  </div>

                  {/* LR information */}
                  <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Customer invoice
                      </p>
                      <p className="mt-1 break-words text-sm font-medium">
                        {row.lr.invoiceNumber ?? "—"}
                      </p>

                      {row.lr.invoiceAmount ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Invoice value: {money(row.lr.invoiceAmount)}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Route
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {row.lr.group.originBranch.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        to {row.lr.group.destinationBranch.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Vehicle
                      </p>
                      <p className="mt-1 break-words text-sm font-medium">
                        {vehicle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vehicleType}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Quantity / weight
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {quantity} item(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.lr.totalWeight ?? "—"}{" "}
                        {row.lr.weightUnit?.code ?? row.lr.unit ?? ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Delivery
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {invoiceDate(row.lr.delivery?.deliveredAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        POD received
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {invoiceDate(row.lr.acknowledgement?.receivedAt)}
                      </p>
                    </div>

                    {/* Charges use the remaining width */}
                    <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Approved charges
                      </p>

                      {row.charges.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {row.charges.map((charge, index) => (
                            <span
                              key={`${row.lr.id}-${charge}-${index}`}
                              className="rounded-md border bg-muted/40 px-2 py-1 text-xs"
                            >
                              {charge}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          No additional charges
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial breakdown */}
                  <div className="grid grid-cols-2 border-t bg-muted/20 sm:grid-cols-4">
                    <div className="border-b p-3 sm:border-b-0 sm:border-r">
                      <p className="text-xs text-muted-foreground">Freight</p>
                      <p className="mt-1 text-sm font-medium">
                        {money(row.freightPaise)}
                      </p>
                    </div>

                    <div className="border-b border-l p-3 sm:border-b-0 sm:border-l-0 sm:border-r">
                      <p className="text-xs text-muted-foreground">Add-ons</p>
                      <p className="mt-1 text-sm font-medium text-emerald-700">
                        {row.additionsPaise > 0n ? "+" : ""}
                        {money(row.additionsPaise)}
                      </p>
                    </div>

                    <div className="p-3 sm:border-r">
                      <p className="text-xs text-muted-foreground">
                        Deductions
                      </p>
                      <p className="mt-1 text-sm font-medium text-destructive">
                        {row.deductionsPaise > 0n
                          ? `−${money(row.deductionsPaise)}`
                          : money(0n)}
                      </p>
                    </div>

                    <div className="border-l p-3">
                      <p className="text-xs text-muted-foreground">
                        Final LR total
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {money(row.totalPaise)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {invoiceRows.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                No LR details are attached to this bill.
              </div>
            ) : null}

            {companionRows.length > 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Also on this truck — no separate charge
                  {freightOwnerLRNumber
                    ? ` (freight billed via ${freightOwnerLRNumber})`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {companionRows.map((lr) => (
                    <span
                      key={lr.id}
                      className="rounded-sm border bg-background px-2 py-1 text-xs font-medium"
                    >
                      {lr.lrNumber}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

          </div>
          <div className="ml-auto grid max-w-md grid-cols-2 gap-x-8 gap-y-3 rounded-md bg-muted/40 p-4 text-sm xl:col-start-1">
            <span>Subtotal</span>
            <span className="text-right">
              {money(current.subtotalAmountPaise)}
            </span>
            {(current.taxLines ?? []).map((line) => (
              <React.Fragment key={line.id}>
                <span>
                  {line.taxType} @ {(line.rateBps / 100).toFixed(2)}%
                </span>
                <span className="text-right">{money(line.taxAmountPaise)}</span>
              </React.Fragment>
            ))}
            <span>Round off</span>
            <span className="text-right">{money(current.roundOffPaise)}</span>
            <span className="border-t pt-3 text-base font-semibold">
              Bill total
            </span>
            <span className="border-t pt-3 text-right text-base font-semibold text-primary">
              {money(current.totalAmountPaise)}
            </span>
          </div>
        </div>
      </CardContent>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this bill?</DialogTitle>
            <DialogDescription>
              The bill will be marked cancelled and its LR charges will become
              available for a new bill. This action is recorded in bill history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor={`cancel-reason-${current.id}`}
              className="text-sm font-medium"
            >
              Cancellation reason
            </label>
            <Textarea
              id={`cancel-reason-${current.id}`}
              value={cancelReason}
              maxLength={500}
              placeholder="For example: Whirlpool must use one combined bill"
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelBill.isPending}
            >
              Keep bill
            </Button>
            <Button
              onClick={() => cancelBill.mutate()}
              disabled={cancelReason.trim().length < 3 || cancelBill.isPending}
            >
              {cancelBill.isPending ? "Cancelling..." : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(chargeToCancel)}
        onOpenChange={(open) => {
          if (!open) {
            setChargeToCancel(null);
            setChargeCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this manual charge?</DialogTitle>
            <DialogDescription>
              {chargeToCancel
                ? `${chargeToCancel.lrNumber} · ${formatLabel(chargeToCancel.type)} · ${money(chargeToCancel.remainingAmountPaise)}`
                : ""}
              . It will disappear from billing but remain in the audit record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor={`charge-cancel-reason-${chargeToCancel?.id ?? "charge"}`}
              className="text-sm font-medium"
            >
              Cancellation reason
            </label>
            <Textarea
              id={`charge-cancel-reason-${chargeToCancel?.id ?? "charge"}`}
              value={chargeCancelReason}
              maxLength={500}
              placeholder="For example: Added by mistake during testing"
              onChange={(event) => setChargeCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChargeToCancel(null)}
              disabled={cancelCharge.isPending}
            >
              Keep charge
            </Button>
            <Button
              onClick={() => cancelCharge.mutate()}
              disabled={
                chargeCancelReason.trim().length < 3 || cancelCharge.isPending
              }
            >
              {cancelCharge.isPending ? "Cancelling..." : "Cancel charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function LRToBillWorkbench() {
  const router = useRouter();
  const canCreate = useCan(PERMS.BILLING.CREATE);
  const canApproveCharge = useCan(PERMS.BILLING.CHARGE_APPROVE);
  const options = useQuery({
    queryKey: ["billing", "options"],
    queryFn: billingApi.options,
  });
  const [branchId, setBranchId] = React.useState("");
  const [partyType, setPartyType] = React.useState<BillPartyType>("CONSIGNOR");
  const [customerId, setCustomerId] = React.useState("");
  const [billType, setBillType] = React.useState<BillType>("ROAD");
  const [mechanism, setMechanism] =
    React.useState<ChargeMechanism>("FORWARD_CHARGE");
  const [billDate, setBillDate] = React.useState(today());
  const [cutoffDate, setCutoffDate] = React.useState(today());
  const [remarks, setRemarks] = React.useState("");
  const [searched, setSearched] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [manualLRId, setManualLRId] = React.useState("");
  const [manualType, setManualType] = React.useState("HAMALI");
  const [manualEffect, setManualEffect] = React.useState<
    "ADDITION" | "DEDUCTION"
  >("ADDITION");
  const [manualAmount, setManualAmount] = React.useState("");
  const [manualReason, setManualReason] = React.useState("");

  const branch = options.data?.branches.find((item) => item.id === branchId);
  const clientFilters = {
    branchId,
    billingPartyType: partyType,
    billType,
    cutoffDate,
  };
  const clients = useQuery({
    queryKey: ["billing", "eligible-clients", clientFilters],
    queryFn: () => billingApi.eligibleClients(clientFilters),
    enabled: Boolean(branchId),
  });
  const client = clients.data?.find((item) => item.id === customerId);
  const filters: EligibilityFilters = {
    branchId,
    billingPartyType: partyType,
    customerId,
    billType,
    cutoffDate,
  };
  const eligible = useQuery({
    queryKey: ["billing", "eligible", filters],
    queryFn: () => billingApi.eligibleLRs(filters),
    enabled: searched && Boolean(branchId && customerId),
  });
  // How many eligible LRs share each truck's LRGroup — used to only badge
  // rows that are actually part of a multi-LR truckload, not every LR.
  const groupCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const lr of eligible.data ?? [])
      counts.set(lr.groupId, (counts.get(lr.groupId) ?? 0) + 1);
    return counts;
  }, [eligible.data]);
  const refresh = useMutation({
    mutationFn: async () => {
      await billingApi.evaluateEligible(filters);
      return billingApi.eligibleLRs(filters);
    },
    onSuccess: (data) => {
      eligible.refetch();
      setSelected(new Set());
      toast.success(
        `${data.length} eligible LR${data.length === 1 ? "" : "s"} found`,
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not evaluate LRs",
      ),
  });
  const create = useMutation({
    mutationFn: () => {
      const selectedLRIds = new Set(
        eligible.data
          ?.filter((lr) => lr.charges.some((charge) => selected.has(charge.id)))
          .map((lr) => lr.id) ?? [],
      );
      const lrChargeIds = [
        ...new Set([
          ...selected,
          ...(eligible.data
            ?.filter((lr) => selectedLRIds.has(lr.id))
            .flatMap((lr) => lr.charges.map((charge) => charge.id)) ?? []),
        ]),
      ];

      return billingApi.createBill({
        branchId,
        billType,
        billingPartyType: partyType,
        customerId,
        ...(billType === "ROAD_GTA" ? { chargeMechanism: mechanism } : {}),
        billDate,
        billingCutoffDate: cutoffDate,
        remarks: remarks || null,
        lrChargeIds,
      });
    },
    onSuccess: (created) => {
      setSelected(new Set());
      toast.success(
        `${created.length} draft bill${created.length === 1 ? "" : "s"} created`,
      );
      router.push(
        created.length === 1
          ? `/accounts/bills/${created[0]!.id}`
          : "/accounts/bills",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not create bill",
      ),
  });
  const addCharge = useMutation({
    mutationFn: async () => {
      const rupees = Number(manualAmount);
      if (!manualLRId || !Number.isFinite(rupees) || rupees <= 0)
        throw new Error("Select an LR and enter a valid charge amount");
      if (manualReason.trim().length < 3)
        throw new Error("Enter the reason for this adjustment");
      const charge = await billingApi.createManualCharge(manualLRId, {
        type: manualType,
        effect: manualEffect,
        amountPaise: String(Math.round(rupees * 100)),
        reason: manualReason.trim() || undefined,
        description: manualReason.trim() || undefined,
        isTaxable: manualType !== "DAMAGE_DEDUCTION",
      });
      if (canApproveCharge) await billingApi.approveCharge(charge.id);
      return { charge, approved: canApproveCharge };
    },
    onSuccess: ({ charge, approved }) => {
      setManualAmount("");
      setManualReason("");
      if (approved) {
        setSelected((current) => new Set(current).add(charge.id));
      }
      void eligible.refetch();
      toast.success(
        approved
          ? "Charge added, approved and selected for this draft"
          : "Charge submitted for approval",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not add charge",
      ),
  });

  React.useEffect(() => {
    const branches = options.data?.branches;
    if (branches?.length === 1) setBranchId(branches[0]!.id);
  }, [options.data?.branches]);

  React.useEffect(() => {
    setCustomerId("");
    setSearched(false);
    setSelected(new Set());
  }, [branchId, partyType, billType, cutoffDate]);

  const showLRs = () => {
    if (!branchId || !customerId)
      return toast.error("Select Bill Head, transport type and client");
    setSearched(true);
    refresh.mutate();
  };
  const toggleLR = (
    chargeIds: string[],
    checked: boolean,
    placeOfSupplyId?: string,
  ) =>
    setSelected((current) => {
      if (checked && placeOfSupplyId) {
        const selectedStates = new Set(
          eligible.data
            ?.filter((lr) =>
              lr.charges.some((charge) => current.has(charge.id)),
            )
            .map((lr) => lr.placeOfSupply?.id)
            .filter((id): id is string => Boolean(id)),
        );
        if (selectedStates.size && !selectedStates.has(placeOfSupplyId)) {
          toast.error(
            "Select LRs from one Place of Supply. Create a separate bill for another state.",
          );
          return current;
        }
      }
      const next = new Set(current);
      for (const id of chargeIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const selectedGroupIds = new Set(
    eligible.data
      ?.filter((lr) => lr.charges.some((charge) => selected.has(charge.id)))
      .map((lr) => lr.groupId) ?? [],
  );
  const selectedLRs =
    eligible.data?.filter((lr) => selectedGroupIds.has(lr.groupId)) ?? [];
  const selectedTotal = selectedLRs.reduce(
    (sum, lr) =>
      sum +
      lr.charges.reduce(
        (chargeSum, charge) =>
          selected.has(charge.id)
            ? chargeSum +
            (charge.effect === "DEDUCTION"
              ? -BigInt(charge.remainingAmountPaise)
              : BigInt(charge.remainingAmountPaise))
            : chargeSum,
        0n,
      ),
    0n,
  );
  const selectedFreightTotal = selectedLRs.reduce(
    (sum, lr) =>
      sum +
      lr.charges.reduce(
        (chargeSum, charge) =>
          selected.has(charge.id) && charge.type === "FREIGHT"
            ? chargeSum + BigInt(charge.remainingAmountPaise)
            : chargeSum,
        0n,
      ),
    0n,
  );
  const selectedAdditionalTotal = selectedTotal - selectedFreightTotal;

  if (options.isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <StepHeading
            step={1}
            title="Set billing context"
            description="Choose the payer and transport service. Only clients with acknowledged, unbilled LRs are shown."
          />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(options.data?.branches.length ?? 0) > 1 ? (
            <Field label="Branch">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {options.data?.branches.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : branch ? (
            <div className="space-y-1.5 text-xs font-medium">
              <span>Branch</span>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-normal">
                {branch.name}
              </p>
            </div>
          ) : null}
          <Field label="Bill Head">
            <Select
              value={partyType}
              onValueChange={(value) => setPartyType(value as BillPartyType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONSIGNOR">Consignor</SelectItem>
                <SelectItem value="CONSIGNEE">Consignee</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Transport Type">
            <Select
              value={billType}
              onValueChange={(value) => setBillType(value as BillType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROAD">Road</SelectItem>
                <SelectItem value="ROAD_GTA">Road GTA</SelectItem>
                <SelectItem value="ROAD_RAIL">Road + Rail</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Client" className="col-span-full">
            <Select
              disabled={!branchId || clients.isLoading}
              value={customerId}
              onValueChange={setCustomerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select eligible client" />
              </SelectTrigger>
              <SelectContent>
                {clients.data?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {/* Billing GSTIN is derived from the selected client.
          <Field label="Billing GST location">
            <Select
              value="master"
              onValueChange={() => undefined}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Customer master GSTIN</SelectItem>
                {([] as Array<{ id: string; name: string; city: { state: { name: string } } }>).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.city.state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          */}
          {/* Transport Type is selected before the client.
          <Field label="Transport Type">
            <Select
              value={billType}
              onValueChange={(value) => setBillType(value as BillType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROAD">Road</SelectItem>
                <SelectItem value="ROAD_RAIL">Road + Rail</SelectItem>
                <SelectItem value="ROAD_GTA">Road GTA</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          */}
          {billType === "ROAD_GTA" ? (
            <Field label="GST Mechanism">
              <Select
                value={mechanism}
                onValueChange={(value) =>
                  setMechanism(value as ChargeMechanism)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FORWARD_CHARGE">Forward charge</SelectItem>
                  <SelectItem value="REVERSE_CHARGE">Reverse charge</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {/* Place of Supply is derived from every selected LR destination.
          <Field label="Place of Supply">
            <Select
              value="derived"
              onValueChange={() => undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {([] as Array<{ id: string; name: string }>).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          */}
          <Field label="Bill date">
            <Input
              type="date"
              value={billDate}
              onChange={(event) => setBillDate(event.target.value)}
            />
          </Field>
          <Field label="LR cut-off date">
            <Input
              type="date"
              value={cutoffDate}
              onChange={(event) => setCutoffDate(event.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button
              onClick={showLRs}
              disabled={refresh.isPending || !branchId || !customerId}
            >
              <IconRefresh size={16} className="mr-1" />
              {refresh.isPending ? "Checking…" : "Show eligible LRs"}
            </Button>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 md:col-span-2 xl:col-span-4">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <p className="flex items-center gap-2">
                <IconMapPin size={16} className="text-primary" />
                Place of Supply comes from LR destination
              </p>
              <p className="flex items-center gap-2">
                <IconShieldCheck size={16} className="text-primary" />
                GST and Bill To details are automatic
              </p>
              <p className="flex items-center gap-2">
                <IconReceiptRupee size={16} className="text-primary" />
                Split billing applies automatically
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {searched ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <StepHeading
                step={2}
                title="Select lorry receipts"
                description="Review the route, payer, POD, Place of Supply and remaining approved charges."
              />
              {eligible.data?.length ? (
                <span className="rounded-sm border bg-background px-3 py-1 text-xs font-medium">
                  {eligible.data.length} eligible LR
                  {eligible.data.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {eligible.isLoading || refresh.isPending ? (
              <Skeleton className="h-40" />
            ) : !eligible.data?.length ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconTruckDelivery size={20} />
                </span>
                <p className="mt-3 font-medium">No eligible LR found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check the branch, Bill Head, transport type and cut-off date.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>LR / Route</TableHead>
                    <TableHead>Parties</TableHead>
                    <TableHead>POD</TableHead>
                    <TableHead>Available charges</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligible.data.map((lr) => {
                    const ids = eligible.data
                      .filter((item) => item.groupId === lr.groupId)
                      .flatMap((item) =>
                        item.charges.map((charge) => charge.id),
                      );
                    const checked =
                      ids.length > 0 && ids.every((id) => selected.has(id));
                    const total = lr.charges.reduce(
                      (sum, charge) =>
                        sum +
                        (charge.effect === "DEDUCTION"
                          ? -BigInt(charge.remainingAmountPaise)
                          : BigInt(charge.remainingAmountPaise)),
                      0n,
                    );
                    return (
                      <TableRow key={lr.id}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              toggleLR(
                                ids,
                                value === true,
                                lr.placeOfSupply?.id,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <p className="flex items-center gap-1.5 font-medium">
                            {lr.lrNumber}
                            {(groupCounts.get(lr.groupId) ?? 0) > 1 ? (
                              <span
                                title={`Same truckload as ${(groupCounts.get(lr.groupId) ?? 0) - 1} other LR${(groupCounts.get(lr.groupId) ?? 0) - 1 === 1 ? "" : "s"} — group ${lr.groupNumber}`}
                                className="inline-flex items-center gap-0.5 rounded-sm bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                              >
                                <IconLink size={10} />
                                {lr.groupNumber}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-1 text-xs">
                            <IconMapPin size={12} />
                            Place of Supply:{" "}
                            {lr.placeOfSupply?.name ?? "Missing"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lr.origin} → {lr.destination}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{lr.consignor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Consignee: {lr.consignee.name}
                          </p>
                        </TableCell>
                        <TableCell>
                          {lr.podReceivedAt
                            ? new Date(lr.podReceivedAt).toLocaleDateString(
                              "en-IN",
                            )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {lr.charges.length ? (
                            lr.charges.map((charge) => (
                              <p key={charge.id} className="text-xs">
                                {charge.effect === "DEDUCTION" ? "− " : ""}
                                {charge.type.replaceAll("_", " ")}:{" "}
                                {money(charge.remainingAmountPaise)}
                              </p>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Shared freight included through LR{" "}
                              {lr.sharedFreightOwnerLRNumber ??
                                "in this truckload"}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {lr.isCompanionOnly ? "Included" : money(total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {eligible.data?.length ? (
              <details className="rounded-md border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Add an approved adjustment
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <Field label="Add charge to LR" className="md:col-span-2 xl:col-span-2">
                    <Select value={manualLRId} onValueChange={setManualLRId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select LR" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligible.data.map((lr) => (
                          <SelectItem key={lr.id} value={lr.id}>
                            {lr.lrNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Charge type">
                    <Select value={manualType} onValueChange={setManualType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "HAMALI",
                          "DETENTION",
                          "UNLOADING",
                          "TOLL",
                          "INVOICE",
                          "MULTIPOINT",
                          "ADDITIONAL FREIGHT",
                          "DAMAGE_DEDUCTION",
                          "OTHER",
                        ].map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Effect">
                    <Select
                      value={manualEffect}
                      onValueChange={(value) =>
                        setManualEffect(value as "ADDITION" | "DEDUCTION")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADDITION">Addition</SelectItem>
                        <SelectItem value="DEDUCTION">Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Amount">
                    <Input
                      inputMode="decimal"
                      value={manualAmount}
                      onChange={(event) => setManualAmount(event.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Reason">
                    <Input
                      value={manualReason}
                      onChange={(event) => setManualReason(event.target.value)}
                      placeholder="Enter the Reason"
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canCreate || addCharge.isPending}
                      onClick={() => addCharge.mutate()}
                    >
                      {addCharge.isPending
                        ? "Adding"
                        : canApproveCharge
                          ? "Add and approve"
                          : "Submit charge"}
                    </Button>
                  </div>
                </div>
              </details>
            ) : null}
            <Field label="Bill remarks">
              <Textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Optional invoice remarks"
              />
            </Field>
            {selected.size ? (
              <div className="grid gap-4 rounded-md border border-primary/20 bg-primary/5 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <IconReceiptRupee size={18} className="text-primary" />
                    Ready to create draft
                    {client?.splitBillsByChargeType ? "s" : ""}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Bill To:{" "}
                    <span className="font-medium text-foreground">
                      {client?.name}
                    </span>
                    {" · "}
                    {selectedLRs.length} LR{selectedLRs.length === 1 ? "" : "s"}
                    {" · "}
                    {selected.size} charge{selected.size === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {client?.splitBillsByChargeType
                      ? "Freight and additional charges will be separated into individual drafts."
                      : "All selected charges will be combined into one draft."}
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  {client?.splitBillsByChargeType ? (
                    <div className="space-y-1 text-sm">
                      <p>Freight draft: {money(selectedFreightTotal)}</p>
                      <p>
                        Additional-charge draft:{" "}
                        {money(selectedAdditionalTotal)}
                      </p>
                      <p className="border-t pt-1 font-semibold text-primary">
                        Combined selected: {money(selectedTotal)}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-muted-foreground">
                        SELECTED VALUE
                      </p>
                      <p className="mt-1 text-xl font-semibold text-primary">
                        {money(selectedTotal)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button
                disabled={!canCreate || !selected.size || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending
                  ? "Creating draft…"
                  : `Create draft from ${selected.size} charge${selected.size === 1 ? "" : "s"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BillsList() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["billing", "bills"],
    queryFn: billingApi.listBills,
  });
  if (query.isLoading) return <Skeleton className="h-72" />;
  const bills = query.data ?? [];
  const draftCount = bills.filter((bill) => bill.status === "DRAFT").length;
  const reviewCount = bills.filter(
    (bill) => bill.status === "PENDING_REVIEW",
  ).length;
  const approvedCount = bills.filter(
    (bill) => bill.status === "APPROVED",
  ).length;
  const outstanding = bills.reduce(
    (sum, bill) => sum + BigInt(bill.outstandingAmountPaise),
    0n,
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Draft bills", value: draftCount, icon: IconReceipt },
          { label: "Awaiting review", value: reviewCount, icon: IconClock },
          {
            label: "Ready to finalise",
            value: approvedCount,
            icon: IconShieldCheck,
          },
          {
            label: "Outstanding",
            value: money(outstanding),
            icon: IconReceiptRupee,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-semibold">{item.value}</p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <item.icon size={18} />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Billing register</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select any row to review its charges, GST calculation and approval
            actions.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill no.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Place of Supply</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow
                  key={bill.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/accounts/bills/${bill.id}`)}
                >
                  <TableCell className="font-medium">
                    {bill.billNumber ?? "Draft"}
                  </TableCell>
                  <TableCell>
                    {new Date(bill.billDate).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    {bill.billingCustomer?.name ??
                      bill.billingPartyNameSnapshot}
                  </TableCell>
                  <TableCell>
                    {bill.placeOfSupplyState?.name ??
                      bill.placeOfSupplyNameSnapshot}
                  </TableCell>
                  <TableCell>
                    <BillStatusBadge status={bill.status as BillStatus} />

                  </TableCell>
                  <TableCell className="text-right">
                    {money(bill.totalAmountPaise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TaxRules() {
  const canManage = useCan(PERMS.BILLING.TAX_RULE_MANAGE);
  const queryClient = useQueryClient();
  const rules = useQuery({
    queryKey: ["billing", "tax-rules"],
    queryFn: billingApi.taxRules,
  });
  const [billType, setBillType] = React.useState<BillType>("ROAD_RAIL");
  const [mechanism, setMechanism] =
    React.useState<ChargeMechanism>("FORWARD_CHARGE");
  const [effectiveFrom, setEffectiveFrom] = React.useState(today());
  const [cgst, setCgst] = React.useState("2.5");
  const [sgst, setSgst] = React.useState("2.5");
  const [igst, setIgst] = React.useState("5");
  const create = useMutation({
    mutationFn: () =>
      billingApi.createTaxRule({
        name: `${billType} ${mechanism}`,
        billType,
        chargeMechanism: mechanism,
        sacCode: "9965",
        effectiveFrom,
        effectiveTo: null,
        cgstRateBps: Math.round(Number(cgst) * 100),
        sgstRateBps: Math.round(Number(sgst) * 100),
        igstRateBps: Math.round(Number(igst) * 100),
        isActive: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["billing", "tax-rules"],
      });
      toast.success("GST rule created");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not create GST rule",
      ),
  });
  return (
    <div className="space-y-5">
      {canManage ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>Create effective GST rule</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rates are effective-dated. Finalised invoices retain their
              original tax snapshot.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Bill type">
              <Select
                value={billType}
                onValueChange={(value) => setBillType(value as BillType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROAD_RAIL">Road + Rail</SelectItem>
                  <SelectItem value="ROAD_GTA">Road GTA</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mechanism">
              <Select
                value={mechanism}
                onValueChange={(value) =>
                  setMechanism(value as ChargeMechanism)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FORWARD_CHARGE">Forward charge</SelectItem>
                  <SelectItem value="REVERSE_CHARGE">Reverse charge</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Effective from">
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </Field>
            <Field label="CGST %">
              <Input
                value={cgst}
                onChange={(event) => setCgst(event.target.value)}
              />
            </Field>
            <Field label="SGST %">
              <Input
                value={sgst}
                onChange={(event) => setSgst(event.target.value)}
              />
            </Field>
            <Field label="IGST %">
              <Input
                value={igst}
                onChange={(event) => setIgst(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                Create rule
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Configured tax rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            The ERP selects the latest active rule for the bill type and invoice
            date.
          </p>
        </CardHeader>
        <CardContent>
          {rules.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mechanism</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>CGST / SGST / IGST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.data?.map((rule) => (
                  <TableRow key={String(rule.id)}>
                    <TableCell>{String(rule.name)}</TableCell>
                    <TableCell>{formatLabel(String(rule.billType))}</TableCell>
                    <TableCell>
                      {formatLabel(String(rule.chargeMechanism))}
                    </TableCell>
                    <TableCell>
                      {new Date(String(rule.effectiveFrom)).toLocaleDateString(
                        "en-IN",
                      )}
                    </TableCell>
                    <TableCell>
                      {Number(rule.cgstRateBps) / 100}% /{" "}
                      {Number(rule.sgstRateBps) / 100}% /{" "}
                      {Number(rule.igstRateBps) / 100}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <IconFileInvoice size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function LRToBillPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        title="LR to Bill"
        description="Select the billing customer and eligible LRs, then create one draft. All later work happens on that draft's detail page."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/accounts/bills")}
          >
            Open billing register
          </Button>
        }
      />
      <LRToBillWorkbench />
    </div>
  );
}

export function BillingRegisterPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing register"
        description="Open a bill to review its invoice, edit draft charges, or continue approval and finalisation."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => router.push("/accounts/billing-settings")}
            >
              GST rules
            </Button>
            <Button onClick={() => router.push("/accounts/lr-to-bill")}>
              Create from LR
            </Button>
          </>
        }
      />
      <BillsList />
    </div>
  );
}

export function BillDetailPage({ billId }: { billId: string }) {
  const router = useRouter();
  const bill = useQuery({
    queryKey: ["billing", "bill", billId],
    queryFn: () => billingApi.bill(billId),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title={bill.data?.billNumber ?? "Draft bill details"}
        description="Review the invoice on the left. For a draft, add or explain later charges in the amendment panel on the right."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/accounts/bills")}
          >
            Back to register
          </Button>
        }
      />
      {bill.isLoading ? <Skeleton className="h-96" /> : null}
      {bill.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {bill.error instanceof Error
              ? bill.error.message
              : "Could not load this bill"}
          </CardContent>
        </Card>
      ) : null}
      {bill.data ? <BillPreview bill={bill.data} /> : null}
    </div>
  );
}

export function BillingSettingsPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing GST rules"
        description="Maintain effective-dated GST calculation rules separately from daily LR billing work."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/accounts/bills")}
          >
            Back to register
          </Button>
        }
      />
      <TaxRules />
    </div>
  );
}

export default LRToBillPage;
