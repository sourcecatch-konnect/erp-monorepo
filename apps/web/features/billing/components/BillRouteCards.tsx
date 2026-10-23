import type { BillLRDetail } from "../billing.service";

export type BillRouteCardsProps = {
    lr: BillLRDetail;
};

/** Consignor (pickup) / Consignee (delivery) address cards, sourced from the
 * bill's first LR — every LR on one bill shares the same route parties. */
export function BillRouteCards({ lr }: BillRouteCardsProps) {
    return (
        <div className="grid gap-4 text-sm lg:grid-cols-2">
            <div className="rounded-md border p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Consignor / pickup
                </p>
                <p className="font-semibold">{lr.group.consignor.name}</p>
                <p className="mt-1 text-muted-foreground">
                    {lr.loadingLocation?.address ??
                        lr.group.consignor.address ??
                        "Address not recorded"}
                </p>
                <p className="mt-2 text-xs">
                    GSTIN:{" "}
                    {lr.loadingLocation?.gstNo ??
                        lr.group.consignor.gstNo ??
                        "Not available"}
                    {lr.group.consignor.customerPAN
                        ? ` · PAN: ${lr.group.consignor.customerPAN}`
                        : ""}
                </p>
            </div>
            <div className="rounded-md border p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Consignee / delivery
                </p>
                <p className="font-semibold">{lr.group.consignee.name}</p>
                <p className="mt-1 text-muted-foreground">
                    {lr.unloadingLocation?.address ??
                        lr.group.consignee.address ??
                        "Address not recorded"}
                </p>
                <p className="mt-2 text-xs">
                    GSTIN:{" "}
                    {lr.unloadingLocation?.gstNo ??
                        lr.group.consignee.gstNo ??
                        "Not available"}
                    {lr.group.consignee.customerPAN
                        ? ` · PAN: ${lr.group.consignee.customerPAN}`
                        : ""}
                </p>
            </div>
        </div>
    );
}
