import type { Bill } from "../billing.service";
import { formatLabel, invoiceDate, money } from "../billing.util";

/** One LR's charges rolled up for the invoice view — computed once in
 * `BillPreview` from `bill.lines`, then rendered per row. */
export type InvoiceRow = {
    lr: NonNullable<Bill["lines"]>[number]["lr"];
    charges: string[];
    freightPaise: bigint;
    additionsPaise: bigint;
    deductionsPaise: bigint;
    totalPaise: bigint;
};

export type LRInvoiceCardProps = {
    row: InvoiceRow;
};

/** One LR's full breakdown: route, vehicle, quantity, charges and the
 * freight/add-ons/deductions/total strip. */
export function LRInvoiceCard({ row }: LRInvoiceCardProps) {
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

    const quantity = row.lr.goods.reduce((total, goods) => total + goods.quantity, 0);

    return (
        <div className="overflow-hidden rounded-lg border bg-card">
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
                    <p className="text-lg font-semibold">{money(row.totalPaise)}</p>
                </div>
            </div>

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
                    <p className="text-xs font-medium text-muted-foreground">Route</p>
                    <p className="mt-1 text-sm font-medium">
                        {row.lr.group.originBranch.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        to {row.lr.group.destinationBranch.name}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground">Vehicle</p>
                    <p className="mt-1 break-words text-sm font-medium">{vehicle}</p>
                    <p className="text-xs text-muted-foreground">{vehicleType}</p>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Quantity / weight
                    </p>
                    <p className="mt-1 text-sm font-medium">{quantity} item(s)</p>
                    <p className="text-xs text-muted-foreground">
                        {row.lr.totalWeight ?? "—"}{" "}
                        {row.lr.weightUnit?.code ?? row.lr.unit ?? ""}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground">Delivery</p>
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

            <div className="grid grid-cols-2 border-t bg-muted/20 sm:grid-cols-4">
                <div className="border-b p-3 sm:border-b-0 sm:border-r">
                    <p className="text-xs text-muted-foreground">Freight</p>
                    <p className="mt-1 text-sm font-medium">{money(row.freightPaise)}</p>
                </div>
                <div className="border-b border-l p-3 sm:border-b-0 sm:border-l-0 sm:border-r">
                    <p className="text-xs text-muted-foreground">Add-ons</p>
                    <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {row.additionsPaise > 0n ? "+" : ""}
                        {money(row.additionsPaise)}
                    </p>
                </div>
                <div className="p-3 sm:border-r">
                    <p className="text-xs text-muted-foreground">Deductions</p>
                    <p className="mt-1 text-sm font-medium text-destructive">
                        {row.deductionsPaise > 0n
                            ? `−${money(row.deductionsPaise)}`
                            : money(0n)}
                    </p>
                </div>
                <div className="border-l p-3">
                    <p className="text-xs text-muted-foreground">Final LR total</p>
                    <p className="mt-1 text-sm font-semibold">{money(row.totalPaise)}</p>
                </div>
            </div>
        </div>
    );
}
