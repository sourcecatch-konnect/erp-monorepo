import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Input } from "@skerp/ui/components/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@skerp/ui/components/select";
import { Textarea } from "@skerp/ui/components/textarea";
import type { AvailableBillCharge } from "../billing.service";
import { formatLabel, money } from "../billing.util";
import { Field } from "./Field";

const MANUAL_CHARGE_TYPES = [
    "DETENTION",
    "HAMALI",
    "UNLOADING",
    "TOLL",
    "MULTIPOINT",
    "FREIGHT_ADJUSTMENT",
    "DAMAGE_DEDUCTION",
    "OTHER",
];

function ChargeRow({
    charge,
    checked,
    onToggle,
    canApproveCharge,
    onRequestCancel,
}: {
    charge: AvailableBillCharge;
    checked: boolean;
    onToggle: (checked: boolean) => void;
    canApproveCharge: boolean;
    onRequestCancel: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-md border bg-background p-3 text-sm">
            <span className="flex items-center gap-3">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggle(Boolean(v))} />
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
                            System charge — correct its source record to remove it
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
                    onClick={onRequestCancel}
                >
                    Cancel
                </Button>
            ) : null}
        </div>
    );
}

export type ManualChargeFormState = {
    lrId: string;
    type: string;
    effect: "ADDITION" | "DEDUCTION";
    amount: string;
    reason: string;
    onLrIdChange: (value: string) => void;
    onTypeChange: (value: string) => void;
    onEffectChange: (value: "ADDITION" | "DEDUCTION") => void;
    onAmountChange: (value: string) => void;
    onReasonChange: (value: string) => void;
    onSubmit: () => void;
    pending: boolean;
};

export type DraftChargeEditorProps = {
    splitByChargeType: boolean;
    currentChargeKind: "FREIGHT" | "ADDITIONAL";
    compatibleCharges: AvailableBillCharge[];
    separateBillCharges: AvailableBillCharge[];
    selectedAdditional: Set<string>;
    selectedSeparate: Set<string>;
    onToggleAdditional: (chargeId: string, checked: boolean) => void;
    onToggleSeparate: (chargeId: string, checked: boolean) => void;
    onAppendCharges: () => void;
    appendPending: boolean;
    onCreateSeparateDraft: () => void;
    createSeparatePending: boolean;
    canCreate: boolean;
    canApproveCharge: boolean;
    onRequestCancelCharge: (charge: AvailableBillCharge) => void;
    lrOptions: Array<{ id: string; lrNumber: string }>;
    manualCharge: ManualChargeFormState;
};

/** The draft-only side panel: append already-approved charges to this bill,
 * spin off a separate draft for charges of the other kind, or raise + approve
 * a brand-new manual charge in one step. */
export function DraftChargeEditor({
    splitByChargeType,
    currentChargeKind,
    compatibleCharges,
    separateBillCharges,
    selectedAdditional,
    selectedSeparate,
    onToggleAdditional,
    onToggleSeparate,
    onAppendCharges,
    appendPending,
    onCreateSeparateDraft,
    createSeparatePending,
    canCreate,
    canApproveCharge,
    onRequestCancelCharge,
    lrOptions,
    manualCharge,
}: DraftChargeEditorProps) {
    return (
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
                        <ChargeRow
                            key={charge.id}
                            charge={charge}
                            checked={selectedAdditional.has(charge.id)}
                            onToggle={(checked) => onToggleAdditional(charge.id, checked)}
                            canApproveCharge={canApproveCharge}
                            onRequestCancel={() => onRequestCancelCharge(charge)}
                        />
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedAdditional.size || appendPending}
                        onClick={onAppendCharges}
                    >
                        {appendPending
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
                            This customer separates freight and additional charges. Select
                            these charges to create the matching second draft.
                        </p>
                    </div>
                    {separateBillCharges.map((charge) => (
                        <ChargeRow
                            key={charge.id}
                            charge={charge}
                            checked={selectedSeparate.has(charge.id)}
                            onToggle={(checked) => onToggleSeparate(charge.id, checked)}
                            canApproveCharge={canApproveCharge}
                            onRequestCancel={() => onRequestCancelCharge(charge)}
                        />
                    ))}
                    <Button
                        type="button"
                        disabled={!selectedSeparate.size || createSeparatePending}
                        onClick={onCreateSeparateDraft}
                    >
                        {createSeparatePending
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
                            manualCharge.onSubmit();
                        }}
                    >
                        <Field label="LR">
                            <Select value={manualCharge.lrId} onValueChange={manualCharge.onLrIdChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select LR" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lrOptions.map((lr) => (
                                        <SelectItem key={lr.id} value={lr.id}>
                                            {lr.lrNumber}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Charge">
                                <Select value={manualCharge.type} onValueChange={manualCharge.onTypeChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select charge" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MANUAL_CHARGE_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {formatLabel(type)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="Effect">
                                <Select
                                    value={manualCharge.effect}
                                    onValueChange={(value) =>
                                        manualCharge.onEffectChange(value as "ADDITION" | "DEDUCTION")
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

                        <div className="md:max-w-[calc(50%-0.5rem)]">
                            <Field label="Amount (₹)">
                                <Input
                                    inputMode="decimal"
                                    value={manualCharge.amount}
                                    onChange={(event) => manualCharge.onAmountChange(event.target.value)}
                                    placeholder="0.00"
                                />
                            </Field>
                        </div>

                        <Field label="Reason">
                            <Textarea
                                value={manualCharge.reason}
                                onChange={(event) => manualCharge.onReasonChange(event.target.value)}
                                placeholder="Enter the reason for this manual charge"
                                rows={3}
                                className="resize-none"
                            />
                        </Field>

                        <Button
                            type="submit"
                            disabled={
                                manualCharge.pending ||
                                !manualCharge.lrId ||
                                !manualCharge.amount.trim()
                            }
                        >
                            {manualCharge.pending ? "Adding charge..." : "Add and approve charge"}
                        </Button>
                    </form>
                </details>
            ) : null}
        </aside>
    );
}
