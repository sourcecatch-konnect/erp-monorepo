"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
    IconRefresh,
    IconShieldCheck,
    IconTruckDelivery,
    IconUsers,
} from "@tabler/icons-react";
import { PERMS } from "@skerp/types";

import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
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
import { Combobox } from "@skerp/ui/components/combobox";

import { useCan } from "@/features/auth";
import { cn } from "@/lib/utils";
import {
    billingApi,
    type BillPartyType,
    type BillType,
    type EligibilityFilters,
} from "../billing.service";

import { Field } from "../components/Field";
import { formatLabel, invoiceDate, money, today } from "../billing.util";
type InlineChargeDraft = {
    detention: string;
    hamali: string;
    freightAdd: string;
    deduction: string;
};
const emptyInlineCharge = (): InlineChargeDraft => ({
    detention: "",
    hamali: "",
    freightAdd: "",
    deduction: "",
});
/**
 * Simple, single-page billing form.
 *
 * The API still stores auditable LRCharge rows. Users select LRs and type the
 * four common adjustments directly in the grid; this component translates
 * those values into approved manual charges immediately before creating the
 * draft bill.
 */

const paiseFromInput = (
    value: string | undefined,
): bigint => {
    const rupees = Number(value || 0);

    if (!Number.isFinite(rupees) || rupees <= 0) {
        return 0n;
    }

    return BigInt(Math.round(rupees * 100));
};

const rateAmount = (amountPaise: bigint, rateBps: number) =>
    (amountPaise * BigInt(Math.max(0, Math.round(rateBps)))) / 10_000n;


export function LRToBillWorkbench() {
    const router = useRouter();
    const canCreate = useCan(PERMS.BILLING.CREATE);
    const canApproveCharge = useCan(PERMS.BILLING.CHARGE_APPROVE);
    const queryClient = useQueryClient();
    const options = useQuery({
        queryKey: ["billing", "options"],
        queryFn: billingApi.options,
    });
    const taxRules = useQuery({
        queryKey: ["billing", "tax-rules"],
        queryFn: billingApi.taxRules,
    });

    const [partyType, setPartyType] =
        React.useState<BillPartyType>("CONSIGNOR");
    const [customerId, setCustomerId] = React.useState("");
    const [billType, setBillType] = React.useState<BillType>("ROAD");
    const [billDate, setBillDate] = React.useState(today());
    const [cutoffDate, setCutoffDate] = React.useState(today());
    const [remarks, setRemarks] = React.useState("");
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const [selectedLRIds, setSelectedLRIds] = React.useState<Set<string>>(
        new Set(),
    );
    const [billingStep, setBillingStep] = React.useState<
        "SELECT_LRS" | "PREPARE_BILL"
    >("SELECT_LRS");

    const [lrSearch, setLRSearch] = React.useState("");

    const [inlineCharges, setInlineCharges] = React.useState<
        Record<string, InlineChargeDraft>
    >({});
    // Operator-chosen GST Place of Supply. Defaults to the client's registered
    // state; only relevant for GST bill types (not ROAD).
    const [placeOfSupplyStateId, setPlaceOfSupplyStateId] = React.useState("");

    const clientFilters = {
        billingPartyType: partyType,
        billType,
        cutoffDate,
    };
    const clients = useQuery({
        queryKey: ["billing", "eligible-clients", clientFilters],
        queryFn: () => billingApi.eligibleClients(clientFilters),
    });
    const client = clients.data?.find((item) => item.id === customerId);
    React.useEffect(() => {
        setPlaceOfSupplyStateId(client?.stateId ?? "");
    }, [client?.id, client?.stateId]);
    const filters: EligibilityFilters = {
        billingPartyType: partyType,
        customerId,
        billType,
        cutoffDate,
    };

    const eligibleQueryKey = ["billing", "eligible", filters] as const;

    const eligible = useQuery({
        queryKey: eligibleQueryKey,
        queryFn: () => billingApi.eligibleLRs(filters),
        enabled: Boolean(customerId),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    const evaluateEligibility = useMutation({
        mutationFn: () => billingApi.evaluateEligible(filters),

        onSuccess: async () => {
            const data = await billingApi.eligibleLRs(filters);

            queryClient.setQueryData(eligibleQueryKey, data);

            setSelectedLRIds(new Set());
            setInlineCharges({});

            toast.success(
                `${data.length} eligible LR${data.length === 1 ? "" : "s"} found`,
            );
        },

        onError: (error) => {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Could not evaluate eligible LRs",
            );
        },
    });
    React.useEffect(() => {
        setCustomerId("");
        setSelectedLRIds(new Set());
        setInlineCharges({});
    }, [partyType, billType, cutoffDate]);

    React.useEffect(() => {
        setSelectedLRIds(new Set());
        setInlineCharges({});
    }, [customerId]);

    const availableLRs = React.useMemo(
        () => eligible.data ?? [],
        [eligible.data],
    );
    const normalizedSearch = lrSearch.trim().toLowerCase();

    const visibleLRs = React.useMemo(() => {
        if (!normalizedSearch) return availableLRs;

        return availableLRs.filter((lr) =>
            [
                lr.lrNumber,
                lr.groupNumber,
                lr.origin,
                lr.destination,
                lr.consignor?.name,
                lr.consignee?.name,
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLowerCase().includes(normalizedSearch),
                ),
        );
    }, [availableLRs, normalizedSearch]);
    const selectedLRs = availableLRs.filter((lr) => selectedLRIds.has(lr.id));
    const selectedBranchIds = new Set(
        selectedLRs.map((lr) => lr.originBranchId),
    );
    const derivedBranchId =
        selectedBranchIds.size === 1 ? [...selectedBranchIds][0] : undefined;
    const branch = options.data?.branches.find(
        (item) => item.id === derivedBranchId,
    );

    const setInlineValue = (
        lrId: string,
        key: keyof InlineChargeDraft,
        value: string,
    ) => {
        if (value && !/^\d*\.?\d{0,2}$/.test(value)) return;
        setInlineCharges((current) => ({
            ...current,
            [lrId]: {
                ...(current[lrId] ?? emptyInlineCharge()),
                [key]: value,
            },
        }));
    };

    const toggleTruckload = (lrId: string, checked: boolean) => {
        const lr = availableLRs.find((item) => item.id === lrId);
        if (!lr) return;
        const sameTruck = availableLRs.filter((item) => item.groupId === lr.groupId);

        setSelectedLRIds((current) => {
            const next = new Set(current);
            for (const row of sameTruck) {
                if (checked) next.add(row.id);
                else next.delete(row.id);
            }
            return next;
        });
    };



    const existingTotals = selectedLRs.reduce(
        (result, lr) => {
            for (const charge of lr.charges) {
                const amount = BigInt(charge.remainingAmountPaise);
                if (charge.type === "FREIGHT") result.freight += amount;
                else if (charge.effect === "DEDUCTION") result.deductions += amount;
                else result.additions += amount;
            }
            return result;
        },
        { freight: 0n, additions: 0n, deductions: 0n },
    );

    const inlineTotals = selectedLRs.reduce(
        (result, lr) => {
            const values = inlineCharges[lr.id] ?? emptyInlineCharge();
            result.detention += paiseFromInput(values.detention);
            result.hamali += paiseFromInput(values.hamali);
            result.freightAdd += paiseFromInput(values.freightAdd);
            result.deductions += paiseFromInput(values.deduction);
            return result;
        },
        { detention: 0n, hamali: 0n, freightAdd: 0n, deductions: 0n },
    );

    const totalAdditions =
        existingTotals.additions +
        inlineTotals.detention +
        inlineTotals.hamali +
        inlineTotals.freightAdd;
    const totalDeductions = existingTotals.deductions + inlineTotals.deductions;
    const taxableAmount =
        existingTotals.freight + totalAdditions > totalDeductions
            ? existingTotals.freight + totalAdditions - totalDeductions
            : 0n;

    // The billing branch (origin branch of the selected LRs) supplies the state
    // we compare Place of Supply against. Its state lives at branch.city.state.
    const supplierStateId = branch?.city?.state?.id;
    const supplierStateName = branch?.city?.state?.name;
    const placeOfSupplyId =
        billType === "ROAD" ? undefined : placeOfSupplyStateId || undefined;
    const placeOfSupplyName =
        billType === "ROAD"
            ? "—"
            : (options.data?.states.find((s) => s.id === placeOfSupplyStateId)?.name ??
                "—");
    const taxTreatment =
        billType === "ROAD"
            ? "NO_GST"
            : supplierStateId && placeOfSupplyId
                ? supplierStateId === placeOfSupplyId
                    ? "INTRA_STATE"
                    : "INTER_STATE"
                : "PENDING";

    const activeTaxRule = React.useMemo(() => {
        const invoiceTime = new Date(billDate).getTime();
        return [...(taxRules.data ?? [])]
            .filter((rule) => {
                const starts = new Date(String(rule.effectiveFrom)).getTime();
                const ends = rule.effectiveTo
                    ? new Date(String(rule.effectiveTo)).getTime()
                    : Number.POSITIVE_INFINITY;
                return (
                    String(rule.billType) === billType &&
                    rule.isActive !== false &&
                    starts <= invoiceTime &&
                    ends >= invoiceTime
                );
            })
            .sort(
                (a, b) =>
                    new Date(String(b.effectiveFrom)).getTime() -
                    new Date(String(a.effectiveFrom)).getTime(),
            )[0];
    }, [billDate, billType, taxRules.data]);

    const cgstRate = Number(activeTaxRule?.cgstRateBps ?? 0);
    const sgstRate = Number(activeTaxRule?.sgstRateBps ?? 0);
    const igstRate = Number(activeTaxRule?.igstRateBps ?? 0);
    const cgstAmount =
        taxTreatment === "INTRA_STATE" ? rateAmount(taxableAmount, cgstRate) : 0n;
    const sgstAmount =
        taxTreatment === "INTRA_STATE" ? rateAmount(taxableAmount, sgstRate) : 0n;
    const igstAmount =
        taxTreatment === "INTER_STATE" ? rateAmount(taxableAmount, igstRate) : 0n;
    const previewTax = cgstAmount + sgstAmount + igstAmount;
    const previewGrandTotal = taxableAmount + previewTax;

    const hasInlineAdjustments = selectedLRs.some((lr) => {
        const row = inlineCharges[lr.id];
        return row
            ? Object.values(row).some((value) => paiseFromInput(value) > 0n)
            : false;
    });

    const create = useMutation({
        mutationFn: async () => {
            if (!selectedLRs.length) throw new Error("Select at least one LR");
            if (billType !== "ROAD" && !placeOfSupplyStateId) {
                throw new Error("Select a Place of Supply state");
            }
            if (!derivedBranchId) {
                throw new Error("Selected LRs must belong to one branch");
            }
            if (hasInlineAdjustments && !canApproveCharge) {
                throw new Error(
                    "You can select existing approved charges, but inline adjustments require charge approval permission.",
                );
            }

            const chargeIds = new Set(
                selectedLRs.flatMap((lr) => lr.charges.map((charge) => charge.id)),
            );
            const adjustmentDefinitions: Array<{
                key: keyof InlineChargeDraft;
                type: string;
                effect: "ADDITION" | "DEDUCTION";
                label: string;
            }> = [
                    { key: "detention", type: "DETENTION", effect: "ADDITION", label: "Detention" },
                    { key: "hamali", type: "HAMALI", effect: "ADDITION", label: "Hamali" },
                    {
                        key: "freightAdd",
                        type: "FREIGHT_ADJUSTMENT",
                        effect: "ADDITION",
                        label: "Freight addition",
                    },
                    {
                        key: "deduction",
                        type: "FREIGHT_ADJUSTMENT",
                        effect: "DEDUCTION",
                        label: "Billing deduction",
                    },
                ];

            for (const lr of selectedLRs) {
                const row = inlineCharges[lr.id] ?? emptyInlineCharge();
                for (const definition of adjustmentDefinitions) {
                    const amountPaise = paiseFromInput(row[definition.key]);
                    if (amountPaise <= 0n) continue;
                    const reason = `${definition.label} entered while creating bill for ${lr.lrNumber}`;
                    const charge = await billingApi.createManualCharge(lr.id, {
                        type: definition.type,
                        effect: definition.effect,
                        amountPaise: String(amountPaise),
                        reason,
                        description: reason,
                        isTaxable: true,
                    });
                    await billingApi.approveCharge(charge.id);
                    chargeIds.add(charge.id);
                }
            }

            if (!chargeIds.size) {
                throw new Error("The selected LRs do not contain any billable charge");
            }

            return billingApi.createBill({
                branchId: derivedBranchId,
                billType,
                billingPartyType: partyType,
                customerId,
                ...(billType !== "ROAD" && placeOfSupplyStateId
                    ? { placeOfSupplyStateId }
                    : {}),
                billDate,
                billingCutoffDate: cutoffDate,
                remarks: remarks.trim() || null,
                lrChargeIds: [...chargeIds],
            });
        },
        onSuccess: (created) => {
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

    const continueToBill = () => {
        if (!selectedLRs.length) {
            toast.error("Select at least one LR");
            return;
        }

        if (selectedBranchIds.size > 1) {
            toast.error(
                "Selected LRs belong to different branches. Create separate bills.",
            );
            return;
        }

        setBillingStep("PREPARE_BILL");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const [customerSearch, setCustomerSearch] = React.useState("");
    const [, setCustomerLabel] = React.useState("");
    const [stateSearch, setStateSearch] = React.useState("");
    const stateOptions = React.useMemo(
        () =>
            (options.data?.states ?? []).map((state) => ({
                value: state.id,
                label: state.name,
            })),
        [options.data?.states],
    );
    const customerOptions =
        clients.data?.map((item) => ({
            value: item.id,
            label: item.name,
        })) ?? [];
    const backToLRSelection = () => {
        setBillingStep("SELECT_LRS");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    React.useEffect(() => {
        setCustomerId("");
        setSelectedLRIds(new Set());
        setInlineCharges({});
        setBillingStep("SELECT_LRS");
        setLRSearch("");
    }, [partyType, billType, cutoffDate]);

    React.useEffect(() => {
        setSelectedLRIds(new Set());
        setInlineCharges({});
        setBillingStep("SELECT_LRS");
        setLRSearch("");
    }, [customerId]);

    if (options.isLoading) {
        return <Skeleton className="h-[540px]" />;
    }



    const TAX_TREATMENT_LABEL: Record<string, string> = {
        INTRA_STATE: "CGST + SGST",
        INTER_STATE: "IGST",
        REVERSE_CHARGE: "Reverse Charge",
        NO_GST: "No GST",
        PENDING: "Select Place of Supply",
    };


    return (
        <div className="space-y-4">
            {/* STEP INDICATOR */}
            {/* STEP INDICATOR */}
            <div className="relative grid h-14 grid-cols-2 overflow-hidden rounded-lg border bg-card shadow-sm">
                {/* Perforated centre divider */}
                <div className="pointer-events-none absolute bottom-2 left-1/2 top-2 z-20 -translate-x-1/2 border-l border-dashed border-border" />

                <span className="pointer-events-none absolute left-1/2 top-0 z-30 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background" />

                <span className="pointer-events-none absolute bottom-0 left-1/2 z-30 size-3 -translate-x-1/2 translate-y-1/2 rounded-full border bg-background" />

                {/* Step 1 */}
                <button
                    type="button"
                    onClick={backToLRSelection}
                    className={cn(
                        "relative flex min-w-0 items-center gap-3 px-4 text-left transition-all duration-300",
                        billingStep === "SELECT_LRS"
                            ? "bg-gradient-to-r from-blue-50 to-sky-50/60"
                            : "bg-emerald-50/50 hover:bg-emerald-50",
                    )}
                >
                    <span
                        className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white text-xs font-bold shadow-sm",
                            billingStep === "SELECT_LRS"
                                ? "border-blue-200 text-blue-600"
                                : "border-emerald-200 text-emerald-600",
                        )}
                    >
                        {billingStep === "PREPARE_BILL" ? "✓" : "LR"}
                    </span>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p
                                className={cn(
                                    "truncate text-sm font-semibold",
                                    billingStep === "SELECT_LRS"
                                        ? "text-blue-700"
                                        : "text-emerald-700",
                                )}
                            >
                                Select LRs
                            </p>

                            {billingStep === "SELECT_LRS" && (
                                <span className="hidden rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-600 md:inline-flex">
                                    In progress
                                </span>
                            )}
                        </div>

                        <p className="truncate text-[11px] text-muted-foreground">
                            Choose records for billing
                        </p>
                    </div>

                    {billingStep === "SELECT_LRS" && (
                        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-400/70" />
                    )}
                </button>

                {/* Step 2 */}
                <div
                    className={cn(
                        "relative flex min-w-0 items-center gap-3 px-4 transition-all duration-300",
                        billingStep === "PREPARE_BILL"
                            ? "bg-gradient-to-r from-violet-50/60 to-blue-50"
                            : "bg-muted/10",
                    )}
                >
                    <span
                        className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white text-sm font-bold shadow-sm",
                            billingStep === "PREPARE_BILL"
                                ? "border-violet-200 text-violet-600"
                                : "border-border text-muted-foreground",
                        )}
                    >
                        ₹
                    </span>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p
                                className={cn(
                                    "truncate text-sm font-semibold",
                                    billingStep === "PREPARE_BILL"
                                        ? "text-violet-700"
                                        : "text-muted-foreground",
                                )}
                            >
                                Prepare Bill
                            </p>

                            {billingStep === "PREPARE_BILL" && (
                                <span className="hidden rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600 md:inline-flex">
                                    Final step
                                </span>
                            )}
                        </div>

                        <p className="truncate text-[11px] text-muted-foreground">
                            Charges, GST and final amount
                        </p>
                    </div>

                    {billingStep === "PREPARE_BILL" && (
                        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-400/70" />
                    )}
                </div>
            </div>
            {billingStep === "SELECT_LRS" ? (
                <>
                    {/* BILL FILTERS */}
                    <Card className="overflow-hidden">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <CardTitle>Bill information</CardTitle>

                            <p className="text-sm text-muted-foreground">
                                Select the billing details, client and eligible LRs.
                            </p>
                        </CardHeader>

                        <CardContent className="space-y-4 p-4 lg:p-5">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <Field label="Bill Head">
                                    <Select
                                        value={partyType}
                                        onValueChange={(value) =>
                                            setPartyType(value as BillPartyType)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="CONSIGNOR">
                                                Consignor
                                            </SelectItem>

                                            <SelectItem value="CONSIGNEE">
                                                Consignee
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Transport Type">
                                    <Select
                                        value={billType}
                                        onValueChange={(value) =>
                                            setBillType(value as BillType)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="ROAD">Road</SelectItem>

                                            <SelectItem value="ROAD_RAIL">
                                                Road + Rail
                                            </SelectItem>

                                            <SelectItem value="ROAD_GTA">
                                                Road GTA
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Bill Date">
                                    <Input
                                        type="date"
                                        value={billDate}
                                        onChange={(event) =>
                                            setBillDate(event.target.value)
                                        }
                                    />
                                </Field>

                                <Field label="Client" className="col-span-full max-w-xl">
                                    <Combobox
                                        options={customerOptions}
                                        value={customerId}
                                        onChange={(value) => {
                                            setCustomerId(value);
                                            setCustomerLabel(
                                                customerOptions.find((o) => o.value === value)?.label ?? "",
                                            );
                                        }}
                                        searchValue={customerSearch}
                                        onSearchChange={setCustomerSearch}
                                        placeholder="Select client"
                                        searchPlaceholder="Search clients..."
                                        disabled={clients.isLoading}
                                    />
                                </Field>
                            </div>

                            {billType !== "ROAD" ? (
                                <div className="max-w-sm">
                                    <Field label="Place of Supply">
                                        <Combobox
                                            options={stateOptions}
                                            value={placeOfSupplyStateId}
                                            onChange={setPlaceOfSupplyStateId}
                                            searchValue={stateSearch}
                                            onSearchChange={setStateSearch}
                                            placeholder="Select state"
                                            searchPlaceholder="Search state..."
                                            disabled={options.isLoading}
                                        />

                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {supplierStateId && placeOfSupplyStateId
                                                ? supplierStateId === placeOfSupplyStateId
                                                    ? "Same state as billing branch → CGST + SGST"
                                                    : "Different state → IGST"
                                                : "Defaults to the client's registered state; change if needed."}
                                        </p>
                                    </Field>
                                </div>
                            ) : null}

                            <button
                                type="button"
                                className="text-sm font-medium text-primary hover:underline"
                                onClick={() =>
                                    setFiltersOpen((current) => !current)
                                }
                            >
                                {filtersOpen ? "Hide filters" : "More filters"}
                            </button>

                            {filtersOpen ? (
                                <div className="max-w-sm rounded-md border bg-muted/20 p-3">
                                    <Field label="Include LRs up to">
                                        <Input
                                            type="date"
                                            value={cutoffDate}
                                            onChange={(event) =>
                                                setCutoffDate(event.target.value)
                                            }
                                        />
                                    </Field>
                                </div>
                            ) : null}

                            {client ? (
                                <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                                    <span>
                                        <span className="text-muted-foreground">
                                            Bill To:
                                        </span>{" "}
                                        <strong>{client.name}</strong>
                                    </span>

                                    <span>
                                        <span className="text-muted-foreground">
                                            Branch:
                                        </span>{" "}
                                        {branch?.name ?? "—"}
                                    </span>

                                    <span>
                                        <span className="text-muted-foreground">
                                            Selected:
                                        </span>{" "}
                                        <strong>{selectedLRs.length} LRs</strong>
                                    </span>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* LR SELECTION */}
                    {customerId ? (
                        <Card className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/20">
                                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                                    <div>
                                        <CardTitle>Select eligible LRs</CardTitle>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Search the LR number and select only the LRs
                                            required for this bill.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium">
                                            {visibleLRs.length} shown ·{" "}
                                            {selectedLRs.length} selected
                                        </span>

                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={evaluateEligibility.isPending}
                                            onClick={() =>
                                                evaluateEligibility.mutate()
                                            }
                                        >
                                            <IconRefresh
                                                size={15}
                                                className={
                                                    evaluateEligibility.isPending
                                                        ? "animate-spin"
                                                        : ""
                                                }
                                            />

                                            {evaluateEligibility.isPending
                                                ? "Checking..."
                                                : "Refresh"}
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 max-w-xl">
                                    <Input
                                        value={lrSearch}
                                        onChange={(event) =>
                                            setLRSearch(event.target.value)
                                        }
                                        placeholder="Search LR number, group, route or customer..."
                                    />
                                </div>
                            </CardHeader>

                            <CardContent className="p-0">
                                {eligible.isLoading || eligible.isFetching ? (
                                    <div className="p-5">
                                        <Skeleton className="h-56" />
                                    </div>
                                ) : !visibleLRs.length ? (
                                    <div className="py-16 text-center">
                                        <IconTruckDelivery
                                            className="mx-auto text-muted-foreground"
                                            size={32}
                                        />

                                        <p className="mt-3 font-medium">
                                            No eligible LR found
                                        </p>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try another LR number, client or cut-off date.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="max-h-[480px] overflow-auto">
                                        <Table className="min-w-[900px]">
                                            <TableHeader className="sticky top-0 z-10 bg-background">
                                                <TableRow>
                                                    <TableHead className="w-12" />

                                                    <TableHead>LR Number</TableHead>

                                                    <TableHead>Route</TableHead>

                                                    <TableHead>LR Date</TableHead>

                                                    <TableHead>Delivery/POD</TableHead>

                                                    <TableHead>Place of Supply</TableHead>

                                                    <TableHead className="text-right">
                                                        Freight
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {visibleLRs.map((lr) => {
                                                    const checked =
                                                        selectedLRIds.has(lr.id);

                                                    const freight = lr.charges.reduce(
                                                        (sum, charge) =>
                                                            charge.type === "FREIGHT"
                                                                ? sum +
                                                                BigInt(
                                                                    charge.remainingAmountPaise,
                                                                )
                                                                : sum,
                                                        0n,
                                                    );

                                                    const sameTruckCount =
                                                        availableLRs.filter(
                                                            (item) =>
                                                                item.groupId === lr.groupId,
                                                        ).length;

                                                    return (
                                                        <TableRow
                                                            key={lr.id}
                                                            className={
                                                                checked
                                                                    ? "bg-primary/5"
                                                                    : undefined
                                                            }
                                                        >
                                                            <TableCell>
                                                                <Checkbox
                                                                    checked={checked}
                                                                    onCheckedChange={(value) =>
                                                                        toggleTruckload(
                                                                            lr.id,
                                                                            value === true,
                                                                        )
                                                                    }
                                                                />
                                                            </TableCell>

                                                            <TableCell>
                                                                <p className="font-semibold">
                                                                    {lr.lrNumber}
                                                                </p>

                                                                {sameTruckCount > 1 ? (
                                                                    <span className="mt-1 inline-flex rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                                                                        {lr.groupNumber} ·{" "}
                                                                        {sameTruckCount} LRs
                                                                    </span>
                                                                ) : null}
                                                            </TableCell>

                                                            <TableCell className="text-sm">
                                                                {lr.origin} → {lr.destination}
                                                            </TableCell>

                                                            <TableCell>
                                                                {invoiceDate(lr.lrDate)}
                                                            </TableCell>

                                                            <TableCell>
                                                                {invoiceDate(lr.podReceivedAt)}
                                                            </TableCell>

                                                            <TableCell>
                                                                {lr.placeOfSupply?.name ?? "—"}
                                                            </TableCell>

                                                            <TableCell className="text-right font-medium">
                                                                {lr.isCompanionOnly
                                                                    ? "Included"
                                                                    : money(freight)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}

                                <div className="sticky bottom-0 z-20 flex flex-col justify-between gap-3 border-t bg-background/95 p-4 backdrop-blur sm:flex-row sm:items-center">
                                    <div>
                                        <p className="font-semibold">
                                            {selectedLRs.length} LR
                                            {selectedLRs.length === 1 ? "" : "s"}{" "}
                                            selected
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            Only selected LRs will appear in the next
                                            step.
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        disabled={!selectedLRs.length}
                                        onClick={continueToBill}
                                    >
                                        Continue to Billing
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="py-14 text-center">
                                <IconUsers
                                    className="mx-auto text-muted-foreground"
                                    size={32}
                                />

                                <p className="mt-3 font-medium">
                                    Select a client to view eligible LRs
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </>
            ) : (
                <>
                    {/* SELECTED BILL INFORMATION */}
                    <Card>
                        <CardContent className="flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Preparing bill for
                                </p>

                                <p className="mt-1 text-base font-semibold">
                                    {client?.name}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                                    <span>{branch?.name}</span>
                                    <span>{formatLabel(billType)}</span>
                                    <span>
                                        Bill Date: {invoiceDate(billDate)}
                                    </span>
                                    <span>Place of Supply: {placeOfSupplyName}</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={backToLRSelection}
                            >
                                Back to LR Selection
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-4">
                        <Card className="min-w-0 overflow-hidden">
                            <CardHeader className="border-b bg-muted/20">
                                <CardTitle>Selected LRs and charges</CardTitle>

                                <p className="text-sm text-muted-foreground">
                                    Enter additional charges only for the selected LRs.
                                    All amounts are in rupees.
                                </p>
                            </CardHeader>

                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[700px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-30">
                                                    LR Number
                                                </TableHead>

                                                <TableHead className="text-right">
                                                    Freight
                                                </TableHead>

                                                <TableHead className="w-28 text-right">
                                                    Detention
                                                </TableHead>

                                                <TableHead className="w-28 text-right">
                                                    Hamali
                                                </TableHead>

                                                <TableHead className="w-28 text-right">
                                                    Freight Add.
                                                </TableHead>

                                                <TableHead className="w-28 text-right">
                                                    Deduction
                                                </TableHead>

                                                <TableHead className="text-right">
                                                    Row Total
                                                </TableHead>

                                                <TableHead className="w-20" />
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {selectedLRs.map((lr) => {
                                                const row =
                                                    inlineCharges[lr.id] ??
                                                    emptyInlineCharge();

                                                const freight = lr.charges.reduce(
                                                    (sum, charge) =>
                                                        charge.type === "FREIGHT"
                                                            ? sum +
                                                            BigInt(
                                                                charge.remainingAmountPaise,
                                                            )
                                                            : sum,
                                                    0n,
                                                );

                                                const existingOther =
                                                    lr.charges.reduce(
                                                        (sum, charge) => {
                                                            if (charge.type === "FREIGHT") {
                                                                return sum;
                                                            }

                                                            const amount = BigInt(
                                                                charge.remainingAmountPaise,
                                                            );

                                                            return (
                                                                sum +
                                                                (charge.effect === "DEDUCTION"
                                                                    ? -amount
                                                                    : amount)
                                                            );
                                                        },
                                                        0n,
                                                    );

                                                const rowTotal =
                                                    freight +
                                                    existingOther +
                                                    paiseFromInput(row.detention) +
                                                    paiseFromInput(row.hamali) +
                                                    paiseFromInput(row.freightAdd) -
                                                    paiseFromInput(row.deduction);

                                                const amountInput = (
                                                    key: keyof InlineChargeDraft,
                                                    label: string,
                                                ) => (
                                                    <Input
                                                        aria-label={`${label} for ${lr.lrNumber}`}
                                                        inputMode="decimal"
                                                        value={row[key]}
                                                        onChange={(event) =>
                                                            setInlineValue(
                                                                lr.id,
                                                                key,
                                                                event.target.value,
                                                            )
                                                        }
                                                        placeholder="0"
                                                        className="h-8 text-right"
                                                    />
                                                );

                                                return (
                                                    <TableRow key={lr.id}>
                                                        <TableCell>
                                                            <p className="font-semibold">
                                                                {lr.lrNumber}
                                                            </p>

                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {lr.origin} → {lr.destination}
                                                            </p>
                                                        </TableCell>

                                                        <TableCell className="text-right font-medium">
                                                            {lr.isCompanionOnly
                                                                ? "Included"
                                                                : money(freight)}
                                                        </TableCell>

                                                        <TableCell>
                                                            {amountInput(
                                                                "detention",
                                                                "Detention",
                                                            )}
                                                        </TableCell>

                                                        <TableCell>
                                                            {amountInput("hamali", "Hamali")}
                                                        </TableCell>

                                                        <TableCell>
                                                            {amountInput(
                                                                "freightAdd",
                                                                "Freight addition",
                                                            )}
                                                        </TableCell>

                                                        <TableCell>
                                                            {amountInput(
                                                                "deduction",
                                                                "Deduction",
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="text-right font-semibold">
                                                            {money(rowTotal)}
                                                        </TableCell>

                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    toggleTruckload(lr.id, false)
                                                                }
                                                            >
                                                                Remove
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* STICKY BILL SUMMARY */}
                        <div className="space-y-4">
                            <Card className="overflow-hidden border-primary/20">
                                <CardHeader className="border-b bg-primary/5 pb-4">
                                    <CardTitle>Bill Summary</CardTitle>

                                    <p className="text-sm text-muted-foreground">
                                        {selectedLRs.length} LR
                                        {selectedLRs.length === 1 ? "" : "s"} selected
                                    </p>
                                </CardHeader>

                                <CardContent className="space-y-3 p-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Freight
                                        </span>

                                        <span>{money(existingTotals.freight)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Additions
                                        </span>

                                        <span className="text-emerald-600">
                                            + {money(totalAdditions)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Deductions
                                        </span>

                                        <span className="text-rose-600">
                                            − {money(totalDeductions)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between border-t pt-3 font-medium">
                                        <span>Taxable Amount</span>
                                        <span>{money(taxableAmount)}</span>
                                    </div>

                                    {taxTreatment === "INTRA_STATE" ? (
                                        <>
                                            <div className="flex justify-between">
                                                <span>CGST ({cgstRate / 100}%)</span>
                                                <span>{money(cgstAmount)}</span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span>SGST ({sgstRate / 100}%)</span>
                                                <span>{money(sgstAmount)}</span>
                                            </div>
                                        </>
                                    ) : taxTreatment === "INTER_STATE" ? (
                                        <div className="flex justify-between">
                                            <span>IGST ({igstRate / 100}%)</span>
                                            <span>{money(igstAmount)}</span>
                                        </div>
                                    ) : taxTreatment === "NO_GST" ? (
                                        <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                            No GST — this is a &quot;to pay&quot; (Road) bill.
                                        </div>
                                    ) : (
                                        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                                            Select a Place of Supply state to apply GST.
                                        </div>
                                    )}

                                    <div className="flex items-end justify-between border-t pt-3">
                                        <span className="font-semibold">
                                            Estimated Total
                                        </span>

                                        <span className="text-xl font-bold text-primary">
                                            {money(previewGrandTotal)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="space-y-4 p-4">
                                    <div className="flex items-start gap-2">
                                        <IconShieldCheck
                                            className="mt-0.5 shrink-0 text-primary"
                                            size={17}
                                        />

                                        <div className="text-sm">
                                            <p className="font-medium">
                                                {TAX_TREATMENT_LABEL[taxTreatment] ?? "GST checked automatically"}
                                            </p>

                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {supplierStateName ?? "Billing state"} → {placeOfSupplyName}
                                            </p>
                                        </div>
                                    </div>

                                    <Field label="Remarks">
                                        <Textarea
                                            value={remarks}
                                            onChange={(event) => setRemarks(event.target.value)}
                                            placeholder="Optional invoice remarks"
                                            rows={3}
                                        />
                                    </Field>
                                    <div className="flex gap-2 mt-2 justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={backToLRSelection}
                                        >
                                            Back
                                        </Button>

                                        <Button
                                            size="sm"
                                            disabled={!canCreate || !selectedLRs.length || create.isPending}
                                            onClick={() => create.mutate()}
                                        >
                                            {create.isPending
                                                ? "Creating draft…"
                                                : `Create Draft Bill (${selectedLRs.length} LR${selectedLRs.length === 1 ? "" : "s"})`}
                                        </Button>
                                    </div>

                                    {hasInlineAdjustments && !canApproveCharge ? (
                                        <p className="text-xs text-destructive">
                                            Inline charges require charge approval permission.
                                        </p>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


