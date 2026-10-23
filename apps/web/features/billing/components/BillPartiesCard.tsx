import { IconBuilding, IconMapPin, IconUsers } from "@tabler/icons-react";
import { formatLabel } from "../billing.util";

export type BillPartiesCardProps = {
    supplierName: string;
    supplierGstin: string | null;
    billingPartyType: string;
    billingPartyName: string;
    billingGstin: string | null;
    placeOfSupplyName: string;
};

/** Supplier (us) and Bill To (the customer) — the two identity cards at the
 * top of the invoice. */
export function BillPartiesCard({
    supplierName,
    supplierGstin,
    billingPartyType,
    billingPartyName,
    billingGstin,
    placeOfSupplyName,
}: BillPartiesCardProps) {
    return (
        <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-md border p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <IconBuilding size={15} /> Supplier
                </p>
                <p className="font-semibold">{supplierName}</p>
                <p className="mt-1 text-muted-foreground">
                    GSTIN: {supplierGstin ?? "Not available"}
                </p>
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-primary">
                    <IconUsers size={15} /> Bill To / {formatLabel(billingPartyType)}
                </p>
                <p className="font-semibold">{billingPartyName}</p>
                <p className="mt-1 text-muted-foreground">
                    GSTIN: {billingGstin ?? "Not available"}
                </p>
                <p className="mt-2 flex items-center gap-1">
                    <IconMapPin size={15} /> Place of Supply: {placeOfSupplyName}
                </p>
            </div>
        </div>
    );
}
