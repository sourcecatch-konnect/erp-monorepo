import { useRouter } from "next/navigation";
import { useCan } from "../auth";
import { AvailableBillCharge, Bill, billingApi } from "./billing.service";
import { PERMS } from "@skerp/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { formatLabel, invoiceDate, money } from "./billing.util";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import { BillStatus, BillStatusBadge } from "./components/billingStatusBadge";
import { Button } from "@skerp/ui/components/button";
import { IconBuilding, IconCheck, IconCircleCheck, IconDownload, IconEye, IconLoader2, IconMapPin, IconPrinter, IconUsers, IconX } from "@tabler/icons-react";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Field } from "./components/Field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@skerp/ui/components/select";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@skerp/ui/components/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { runPdfAction } from "@/lib/pdf-actions";

export function BillPreview({ bill }: { bill: Bill }) {
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
            ...(current.billType !== "ROAD" && current.placeOfSupplyState?.id
                ? { placeOfSupplyStateId: current.placeOfSupplyState.id }
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
    const [pdfBusy, setPdfBusy] = React.useState(false);
    const handlePdf = async (pdfAction: "download" | "print") => {
        try {
            setPdfBusy(true);
            const blob = await billingApi.downloadPdf(current.id);
            runPdfAction(
                blob,
                pdfAction,
                `${(current.billNumber ?? "bill").replaceAll("/", "-")}.pdf`,
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Could not generate the bill PDF",
            );
        } finally {
            setPdfBusy(false);
        }
    };
    const openBillPreview = () => {
        window.open(
            `/api/billing/bills/${encodeURIComponent(current.id)}/print-preview`,
            "_blank",
            "noopener,noreferrer",
        );
    };

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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={pdfBusy}>
                                {pdfBusy ? (
                                    <IconLoader2 size={16} className="mr-1 animate-spin" />
                                ) : (
                                    <IconDownload size={16} className="mr-1" />
                                )}
                                {pdfBusy ? "Preparing…" : "Print / PDF"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Tax invoice</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handlePdf("download")}>
                                <IconDownload size={16} className="mr-2" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePdf("print")}>
                                <IconPrinter size={16} className="mr-2" /> Print
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={openBillPreview}>
                                <IconEye size={16} className="mr-2" /> Preview
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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