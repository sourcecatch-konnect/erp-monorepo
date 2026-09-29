import { useRouter } from "next/navigation";
import { useCan } from "../auth";
import {
    AvailableBillCharge,
    Bill,
    BillCreditNoteType,
    billingApi,
} from "./billing.service";
import { PERMS } from "@skerp/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { addDays, formatLabel } from "./billing.util";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import { BillStatus, BillStatusBadge } from "./components/billingStatusBadge";
import { Button } from "@skerp/ui/components/button";
import {
    IconCheck,
    IconCircleCheck,
    IconDownload,
    IconEye,
    IconFileDollar,
    IconLoader2,
    IconPrinter,
    IconX,
} from "@tabler/icons-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { runPdfAction } from "@/lib/pdf-actions";
import { BillPartiesCard } from "./components/BillPartiesCard";
import { BillRouteCards } from "./components/BillRouteCards";
import { LRInvoiceCard, type InvoiceRow } from "./components/LRInvoiceCard";
import { CompanionLRNote } from "./components/CompanionLRNote";
import { BillTotalsCard } from "./components/BillTotalsCard";
import { BillAccountingCard } from "./components/BillAccountingCard";
import { DraftChargeEditor } from "./components/DraftChargeEditor";
import { CancelBillDialog } from "./components/CancelBillDialog";
import { CreditNoteDialog } from "./components/CreditNoteDialog";
import { CancelChargeDialog } from "./components/CancelChargeDialog";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";

// Mirrors RECEIVABLE_BILL_STATUSES on the server (customer-statement.compute.ts)
// — a note only makes sense once a bill is a real, live receivable.
const RECEIVABLE_BILL_STATUSES = ["FINALISED", "SENT", "PARTIALLY_PAID", "PAID"];

export function BillPreview({ bill }: { bill: Bill }) {
    const router = useRouter();
    const canCreate = useCan(PERMS.BILLING.CREATE);
    const canUpdate = useCan(PERMS.BILLING.UPDATE);
    const canApproveCharge = useCan(PERMS.BILLING.CHARGE_APPROVE);
    const canApprove = useCan(PERMS.BILLING.APPROVE);
    const canFinalise = useCan(PERMS.BILLING.FINALISE);
    const canCancel = useCan(PERMS.BILLING.CANCEL);
    const canCreateCreditNote = useCan(PERMS.BILLING.CREDIT_NOTE_CREATE);
    const canViewVoucher = useCan(PERMS.LEDGER.VOUCHER_VIEW);
    const queryClient = useQueryClient();
    const [current, setCurrent] = React.useState(bill);
    const [voucherOpen, setVoucherOpen] = React.useState(false);
    const [cancelOpen, setCancelOpen] = React.useState(false);
    const [cancelReason, setCancelReason] = React.useState("");
    const [creditNoteOpen, setCreditNoteOpen] = React.useState(false);
    const [creditNoteType, setCreditNoteType] =
        React.useState<BillCreditNoteType>("CREDIT_NOTE");
    const [creditNoteAmount, setCreditNoteAmount] = React.useState("");
    const [creditNoteReason, setCreditNoteReason] = React.useState("");
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

    const toggleInSet = (
        setter: React.Dispatch<React.SetStateAction<Set<string>>>,
        id: string,
        checked: boolean,
    ) =>
        setter((currentSelection) => {
            const next = new Set(currentSelection);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });

    const invoiceRows = React.useMemo<InvoiceRow[]>(() => {
        const rows = new Map<string, InvoiceRow>();

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
    const voucher = useQuery({
        queryKey: ["billing", "bill", current.id, "voucher"],
        queryFn: () => billingApi.voucher(current.id),
        enabled: voucherOpen && Boolean(current.journalEntryId),
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
            // Falls back to the parent bill's own date/terms when the sibling
            // draft's due date wasn't set — required field, see billing.schema.ts.
            dueDate: current.dueDate ?? addDays(current.billDate, 30),
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
    const creditNotes = useQuery({
        queryKey: ["billing", "bill", current.id, "credit-notes"],
        queryFn: () => billingApi.creditNotes(current.id),
        enabled: RECEIVABLE_BILL_STATUSES.includes(current.status),
    });
    const createCreditNote = useMutation({
        mutationFn: () =>
            billingApi.createCreditNote(current.id, {
                noteType: creditNoteType,
                amountPaise: String(Math.round(Number(creditNoteAmount) * 100)),
                reason: creditNoteReason.trim(),
            }),
        onSuccess: () => {
            setCreditNoteOpen(false);
            setCreditNoteAmount("");
            setCreditNoteReason("");
            void creditNotes.refetch();
            void queryClient.invalidateQueries({
                queryKey: ["billing", "bill", current.id],
            });
            void queryClient.invalidateQueries({ queryKey: ["billing", "bills"] });
            toast.success(
                creditNoteType === "CREDIT_NOTE"
                    ? "Credit note posted — outstanding amount reduced"
                    : "Debit note posted — outstanding amount increased",
            );
        },
        onError: (error) =>
            toast.error(
                error instanceof Error ? error.message : "Could not post the note",
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
                    {canCreateCreditNote &&
                        RECEIVABLE_BILL_STATUSES.includes(current.status) ? (
                        <Button
                            variant="outline"
                            onClick={() => setCreditNoteOpen(true)}
                        >
                            <IconFileDollar size={16} className="mr-1" /> Credit/Debit
                            Note
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
                        <DraftChargeEditor
                            splitByChargeType={splitByChargeType}
                            currentChargeKind={currentChargeKind}
                            compatibleCharges={compatibleCharges}
                            separateBillCharges={separateBillCharges}
                            selectedAdditional={selectedAdditional}
                            selectedSeparate={selectedSeparate}
                            onToggleAdditional={(id, checked) =>
                                toggleInSet(setSelectedAdditional, id, checked)
                            }
                            onToggleSeparate={(id, checked) =>
                                toggleInSet(setSelectedSeparate, id, checked)
                            }
                            onAppendCharges={() =>
                                appendCharges.mutate([...selectedAdditional])
                            }
                            appendPending={appendCharges.isPending}
                            onCreateSeparateDraft={() => createSeparateDraft.mutate()}
                            createSeparatePending={createSeparateDraft.isPending}
                            canCreate={canCreate}
                            canApproveCharge={canApproveCharge}
                            onRequestCancelCharge={setChargeToCancel}
                            lrOptions={invoiceRows.map((row) => ({
                                id: row.lr.id,
                                lrNumber: row.lr.lrNumber,
                            }))}
                            manualCharge={{
                                lrId: manualLRId,
                                type: manualType,
                                effect: manualEffect,
                                amount: manualAmount,
                                reason: manualReason,
                                onLrIdChange: setManualLRId,
                                onTypeChange: setManualType,
                                onEffectChange: setManualEffect,
                                onAmountChange: setManualAmount,
                                onReasonChange: setManualReason,
                                onSubmit: () => createAndAppendCharge.mutate(),
                                pending: createAndAppendCharge.isPending,
                            }}
                        />
                    ) : null}
                    <div className="space-y-6 xl:col-start-1">
                        <BillPartiesCard
                            supplierName={current.supplierNameSnapshot}
                            supplierGstin={current.supplierGstinSnapshot}
                            billingPartyType={current.billingPartyType}
                            billingPartyName={current.billingPartyNameSnapshot}
                            billingGstin={current.billingGstinSnapshot}
                            placeOfSupplyName={current.placeOfSupplyNameSnapshot}
                        />
                        {firstLR ? <BillRouteCards lr={firstLR} /> : null}
                        <div className="space-y-4">
                            {invoiceRows.map((row) => (
                                <LRInvoiceCard key={row.lr.id} row={row} />
                            ))}
                            {invoiceRows.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                                    No LR details are attached to this bill.
                                </div>
                            ) : null}
                            <CompanionLRNote
                                lrs={companionRows}
                                freightOwnerLRNumber={freightOwnerLRNumber}
                            />
                        </div>
                        <BillTotalsCard
                            subtotalAmountPaise={current.subtotalAmountPaise}
                            taxLines={current.taxLines ?? []}
                            roundOffPaise={current.roundOffPaise}
                            totalAmountPaise={current.totalAmountPaise}
                        />
                        {current.journalEntry ? (
                            <BillAccountingCard
                                journalEntry={current.journalEntry}
                                outstandingAmountPaise={current.outstandingAmountPaise}
                                canViewVoucher={canViewVoucher}
                                onViewVoucher={() => setVoucherOpen(true)}
                            />
                        ) : null}
                        {creditNotes.data && creditNotes.data.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">
                                        Credit / Debit Notes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 p-4 pt-0">
                                    {creditNotes.data.map((note) => (
                                        <div
                                            key={note.id}
                                            className="flex items-center justify-between rounded-md border p-2 text-sm"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {note.noteNumber}
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        {note.noteType === "CREDIT_NOTE"
                                                            ? "Credit"
                                                            : "Debit"}
                                                    </span>
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {note.reason}
                                                </p>
                                            </div>
                                            <p
                                                className={
                                                    note.noteType === "CREDIT_NOTE"
                                                        ? "font-medium text-green-600"
                                                        : "font-medium text-destructive"
                                                }
                                            >
                                                {note.noteType === "CREDIT_NOTE" ? "-" : "+"}₹
                                                {(Number(note.amountPaise) / 100).toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </CardContent>

            <CancelBillDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                billId={current.id}
                reason={cancelReason}
                onReasonChange={setCancelReason}
                onConfirm={() => cancelBill.mutate()}
                pending={cancelBill.isPending}
            />
            <CreditNoteDialog
                open={creditNoteOpen}
                onOpenChange={setCreditNoteOpen}
                billId={current.id}
                outstandingAmountPaise={current.outstandingAmountPaise}
                noteType={creditNoteType}
                onNoteTypeChange={setCreditNoteType}
                amount={creditNoteAmount}
                onAmountChange={setCreditNoteAmount}
                reason={creditNoteReason}
                onReasonChange={setCreditNoteReason}
                onConfirm={() => createCreditNote.mutate()}
                pending={createCreditNote.isPending}
            />
            <CancelChargeDialog
                charge={chargeToCancel}
                onOpenChange={(open) => {
                    if (!open) {
                        setChargeToCancel(null);
                        setChargeCancelReason("");
                    }
                }}
                reason={chargeCancelReason}
                onReasonChange={setChargeCancelReason}
                onConfirm={() => cancelCharge.mutate()}
                pending={cancelCharge.isPending}
            />
            <VoucherDialog
                open={voucherOpen}
                onOpenChange={setVoucherOpen}
                voucher={voucher.data}
                isLoading={voucher.isLoading}
                isError={voucher.isError}
                errorMessage={
                    voucher.error instanceof Error ? voucher.error.message : undefined
                }
                fallbackVoucherNumber={current.journalEntry?.voucherNumber}
            />
        </Card>
    );
}
