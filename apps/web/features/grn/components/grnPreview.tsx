// apps/web/src/features/grn/components/LRPreviewPanel.tsx

"use client";

import * as React from "react";
import { IconFileText, IconTruck } from "@tabler/icons-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@skerp/ui/components/tooltip";
import { formatPaise } from "@/lib/money";
type MoneyLike = number | string | null | undefined;

export type LRPreviewPanelData = {
  lorryReceipt: {
    lrNumber?: string | null;
    status?: string | null;
    invoiceNumber?: string | null;
    invoiceAmount?: MoneyLike;
  };

  vehicleInfo: {
    type?: "MARKET" | "OWN" | string | null;
    vehicleNumber?: string | null;
    driverName?: string | null;
    tripNumber?: string | null;
    tripName?: string | null;
  };

  chargeDefaults: {
    totalFreight?: MoneyLike;
    advanceAmount?: MoneyLike;
    hamaliAmount?: MoneyLike;
    tdsAmount?: MoneyLike;
    commissionAmount?: MoneyLike;
  };
};
const DASH = <span className="text-muted-foreground">—</span>;
function PreviewRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  const displayValue =
  typeof value === "string" && value.length > 25
    ? `${value.slice(0, 25)}...`
    : value;
  return (
  <div
  className={`flex items-center gap-2 text-sm ${
    strong ? "rounded bg-muted px-2 py-1.5" : ""
  }`}
>
 <span
  className={`w-20 shrink-0 ${
    strong
      ? "font-medium text-foreground"
      : "text-muted-foreground"
  }`}
>
  {label}
</span>

<div className="min-w-0 flex-1 overflow-hidden">
<Tooltip>
  <TooltipTrigger asChild>
    <span
      className={`block truncate text-right ${
        strong ? "font-semibold" : ""
      }`}
    >
      {displayValue ?? DASH}
    </span>
  </TooltipTrigger>

  <TooltipContent className="max-w-sm break-all">
    {value}
  </TooltipContent>
</Tooltip>
</div>
</div>
  );
}
function PreviewSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2 border-t px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{title}</span>
      </div>

      {children}
    </div>
  );
}
export default function LRPreviewPanel({
  preview,
  loading,

  detentionAmountPaise,
  grossTotalPaise,
}: {
  preview?: LRPreviewPanelData;
  loading: boolean;
  detentionAmountPaise?: number;
  grossTotalPaise?: number;
}) {
  if (loading) {
    return (
      <aside className="h-full w-full min-w-0 max-w-full overflow-hidden rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold">LR Preview</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Loading LR details...
        </p>
      </aside>
    );
  }

  if (!preview) {
    return (
      <aside className="h-full w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-dashed bg-muted/20 p-5 text-center">
        <IconFileText className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium">No LR selected</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select LR number from the form to show preview.
        </p>
      </aside>
    );
  }
  const isMarketVehicle = preview.vehicleInfo.type === "MARKET";
  return (
    <aside className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border bg-card">
      <div className="shrink-0 border-b bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">LR Preview</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Verify LR details before receiving goods.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PreviewSection icon={<IconFileText size={14} />} title="LR Details">
          <div className="space-y-2">
            <PreviewRow label="LR No" value={preview.lorryReceipt.lrNumber} />
            <PreviewRow label="Status" value={preview.lorryReceipt.status} />
            <PreviewRow
              label="Invoice No"
              value={preview.lorryReceipt.invoiceNumber}
            />
            <PreviewRow
              label="Invoice Amt"
              value={formatPaise(preview.lorryReceipt.invoiceAmount)}
            />
          </div>
        </PreviewSection>

        <PreviewSection icon={<IconTruck size={14} />} title="Vehicle">
          <div className="space-y-2">
            <PreviewRow label="Type" value={preview.vehicleInfo.type} />
            <PreviewRow
              label="Vehicle"
              value={preview.vehicleInfo.vehicleNumber}
            />
            <PreviewRow label="Driver" value={preview.vehicleInfo.driverName} />
            <PreviewRow
              label="Trip"
              value={
                preview.vehicleInfo.tripName ?? preview.vehicleInfo.tripNumber
              }
            />

          </div>
        </PreviewSection>

        <PreviewSection icon={<IconFileText size={14} />} title="Charges">
          <div className="space-y-2">
            <PreviewRow
              label="Freight"
              value={formatPaise(preview.chargeDefaults.totalFreight)}
            />

            {isMarketVehicle ? (
              <>
                <PreviewRow
                  label="Advance"
                  value={formatPaise(preview.chargeDefaults.advanceAmount)}
                />

                <PreviewRow
                  label="Hamali"
                  value={formatPaise(preview.chargeDefaults.hamaliAmount)}
                />

                <PreviewRow
                  label="TDS"
                  value={formatPaise(preview.chargeDefaults.tdsAmount)}
                />

                <PreviewRow
                  label="Commission"
                  value={formatPaise(preview.chargeDefaults.commissionAmount)}
                />
              </>
            ) : null}

            <PreviewRow
              label="Detention"
              value={formatPaise(detentionAmountPaise ?? 0)}
            />

            <PreviewRow
              label="Gross Total"
              strong
              value={formatPaise(
                grossTotalPaise ?? preview.chargeDefaults.totalFreight ?? 0,
              )}
            />
          </div>
        </PreviewSection>
      </div>
    </aside>
  );
}
