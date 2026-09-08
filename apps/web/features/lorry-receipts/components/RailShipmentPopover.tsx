"use client";

import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { IconChevronRight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import type { LRDeliveryEligibility, LRDeliveryEligibilityStage } from "@skerp/types";

const STAGE_LABEL: Record<LRDeliveryEligibilityStage, string> = {
  LR_NOT_FINALISED: "LR not finalised",
  AWAITING_ROAD_DISPATCH: "Awaiting road dispatch",
  AWAITING_BRANCH_GRN: "Awaiting branch GRN",
  AWAITING_DELIVERY_CHALLAN: "Awaiting delivery challan",
  PARTIALLY_CHALLANED: "Partially challaned",
  READY_FOR_DELIVERY: "Ready for delivery",
  ALREADY_DELIVERED: "Already delivered",
};

const qty = (n: number) => n.toLocaleString("en-IN");

const branchGrnLabel = (id: string) => `BR-GRN-${id.slice(-8).toUpperCase()}`;

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right text-xs">{children}</div>
    </div>
  );
}

/**
 * One table cell for a "pending delivery" row's rail shipment. Road LRs render
 * as plain text; rail LRs render a summary that opens a popover with the full
 * rake / VP / branch-GRN / DC / quantity breakdown — replacing what used to be
 * eight separate columns.
 */
export function RailShipmentCell({
  lrNumber,
  eligibility,
}: {
  lrNumber: string;
  eligibility: LRDeliveryEligibility;
}) {
  const rail = eligibility.railwayDetails;

  if (!rail) {
    return <span className="text-muted-foreground">Road</span>;
  }

  const rakeCount = rail.rakeNumbers.length;
  const summary = rakeCount > 0 ? `${rakeCount} rake${rakeCount === 1 ? "" : "s"}` : "Rail";
  const hasLoss = rail.damageQuantity > 0 || rail.shortageQuantity > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm transition-colors hover:bg-muted"
        >
          <span>{summary}</span>
          <span className="tabular-nums text-xs text-muted-foreground">
            · {qty(rail.balanceQuantity)} bal
          </span>
          <IconChevronRight size={13} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Rail shipment · {lrNumber}</p>
          <p className="text-xs text-muted-foreground">
            {STAGE_LABEL[eligibility.stage]}
          </p>
        </div>

        <div className="space-y-3 p-3">
          <div className="divide-y divide-border">
            <DetailRow label="Rake IDs">
              <Chips items={rail.rakeNumbers} />
            </DetailRow>
            <DetailRow label="VP numbers">
              <Chips items={rail.vpNumbers} />
            </DetailRow>
            <DetailRow label="Branch GRNs">
              <Chips items={rail.branchGrnIds.map(branchGrnLabel)} />
            </DetailRow>
          </div>

          <div className="rounded-md bg-muted/40 px-2 py-1">
            <DetailRow label="Received">
              <span className="font-medium tabular-nums">
                {qty(rail.receivedQuantity)}
              </span>
            </DetailRow>
            <DetailRow label="Damage / shortage">
              <span
                className={cn(
                  "tabular-nums",
                  hasLoss && "font-medium text-destructive",
                )}
              >
                {qty(rail.damageQuantity)} / {qty(rail.shortageQuantity)}
              </span>
            </DetailRow>
            <DetailRow label="Issued (DC)">
              <span className="font-medium tabular-nums">
                {qty(rail.issuedQuantity)}
              </span>
            </DetailRow>
            <DetailRow label="Balance">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  rail.balanceQuantity > 0 && "text-amber-600",
                )}
              >
                {qty(rail.balanceQuantity)}
              </span>
            </DetailRow>
          </div>

          <DetailRow label="DC numbers">
            <Chips items={rail.dcNumbers} />
          </DetailRow>
        </div>
      </PopoverContent>
    </Popover>
  );
}
