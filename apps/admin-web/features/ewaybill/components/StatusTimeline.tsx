import { cn } from "@skerp/ui/lib/util";
import {
  IconFileInvoice,
  IconTruckLoading,
  IconRoute,
  IconClockHour4,
  IconCircleCheck,
} from "@tabler/icons-react";
import type { EwayBill } from "../types";

type Step = {
  label: string;
  sub?: string;
  at?: string;
  icon: typeof IconFileInvoice;
  state: "done" | "current" | "pending";
};

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export function StatusTimeline({ bill }: { bill: EwayBill }) {
  const hasVehicle = !!bill.vehicleNo;
  const isInTransit =
    bill.status === "IN_TRANSIT" ||
    bill.status === "DELIVERED" ||
    (bill.status === "ACTIVE" && hasVehicle);
  const isDelivered = bill.status === "DELIVERED";
  const lastVehicle = bill.vehicleHistory.at(-1);

  const steps: Step[] = [
    {
      label: "Generated",
      sub: `${bill.docType} · ${bill.docNo}`,
      at: bill.generatedDate,
      icon: IconFileInvoice,
      state: "done",
    },
    {
      label: hasVehicle ? "Part-B Updated" : "Awaiting Part-B",
      sub: hasVehicle ? bill.vehicleNo : "Vehicle not assigned yet",
      at: lastVehicle?.updatedAt,
      icon: IconTruckLoading,
      state: hasVehicle ? "done" : "current",
    },
    {
      label: "In Transit",
      sub: hasVehicle
        ? `${bill.transDistance} km via ${bill.transMode}`
        : undefined,
      icon: IconRoute,
      state: isDelivered
        ? "done"
        : isInTransit
        ? "current"
        : "pending",
    },
    bill.extensions.length > 0
      ? ({
          label: `Validity Extended ×${bill.extensions.length}`,
          sub: `Last: ${bill.extensions.at(-1)!.reasonRem}`,
          at: bill.extensions.at(-1)!.extendedAt,
          icon: IconClockHour4,
          state: "done",
        } satisfies Step)
      : null,
    {
      label: "Delivered",
      sub: isDelivered ? "Consignment closed" : undefined,
      icon: IconCircleCheck,
      state: isDelivered ? "done" : "pending",
    },
  ].filter(Boolean) as Step[];

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        return (
          <li key={`${step.label}-${idx}`} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] flex size-5 items-center justify-center border bg-card",
                step.state === "done" &&
                  "border-primary bg-primary text-primary-foreground",
                step.state === "current" &&
                  "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-300",
                step.state === "pending" &&
                  "border-border text-muted-foreground"
              )}
            >
              <Icon className="size-3" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    step.state === "pending" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {step.at && (
                  <span className="text-[11px] text-muted-foreground">
                    {fmt(step.at)}
                  </span>
                )}
              </div>
              {step.sub && (
                <span className="text-xs text-muted-foreground">
                  {step.sub}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
