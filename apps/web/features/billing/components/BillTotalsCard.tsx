import React from "react";
import { money } from "../billing.util";

export type BillTotalsCardProps = {
    subtotalAmountPaise: string;
    taxLines: Array<{
        id: string;
        taxType: string;
        rateBps: number;
        taxAmountPaise: string;
    }>;
    roundOffPaise: string;
    totalAmountPaise: string;
};

/** Subtotal → tax lines → round off → bill total. */
export function BillTotalsCard({
    subtotalAmountPaise,
    taxLines,
    roundOffPaise,
    totalAmountPaise,
}: BillTotalsCardProps) {
    return (
        <div className="ml-auto grid max-w-md grid-cols-2 gap-x-8 gap-y-3 rounded-md bg-muted/40 p-4 text-sm">
            <span>Subtotal</span>
            <span className="text-right">{money(subtotalAmountPaise)}</span>
            {taxLines.map((line) => (
                <React.Fragment key={line.id}>
                    <span>
                        {line.taxType} @ {(line.rateBps / 100).toFixed(2)}%
                    </span>
                    <span className="text-right">{money(line.taxAmountPaise)}</span>
                </React.Fragment>
            ))}
            <span>Round off</span>
            <span className="text-right">{money(roundOffPaise)}</span>
            <span className="border-t pt-3 text-base font-semibold">Bill total</span>
            <span className="border-t pt-3 text-right text-base font-semibold text-primary">
                {money(totalAmountPaise)}
            </span>
        </div>
    );
}
