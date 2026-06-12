"use client";

import type { RateMatrixWithRelations } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import {
  Field,
  PartyCard,
  SectionLabel,
  SkeletonBody,
  formatDate,
  formatCurrencyFromPaise,
} from "../_shared/dialog-parts";

import {
  IconBuilding,
  IconUser,
  IconRoute,
  IconMapPin,
  IconTruck,
  IconPackage,
  IconCurrencyRupee,
  IconClock,
  IconNotes,
  IconFileInvoice,
  IconCircleCheckFilled,
  IconClockEdit,
  IconCirclePlus,
  IconId,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: RateMatrixWithRelations;
  isLoading?: boolean;
};

const formatTransportType = (value?: string | null) => {
  if (!value) return "-";

  const labels: Record<string, string> = {
    ROAD: "Road",
    RAIL_ROAD: "Rail / Road",
  };

  return labels[value] ?? value;
};

export default function RateMatrixDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  console.log(data, "rate maitrix");
  const unitLabel =
    data?.unit?.unitValue != null && data?.unit?.unitType
      ? `${data.unit.unitValue} ${data.unit.unitType}`
      : "-";

  const routeLabel =
    data?.route?.sourceCity?.name || data?.route?.destinationCity?.name
      ? `${data?.route?.sourceCity?.name ?? "-"} to ${data?.route?.destinationCity?.name ?? "-"
      }`
      : "-";

  const agreementLabel =
    data?.agreement?.company?.name || data?.agreement?.client?.name
      ? `${data?.agreement?.company?.name ?? "-"} - ${data?.agreement?.client?.name ?? "-"
      }`
      : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[580px] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[900px]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFileInvoice size={18} />
            </span>

            <div>
              <DialogTitle className="text-lg font-semibold">
                Rate Matrix Details
              </DialogTitle>

              <div className="mt-0.5 flex items-center gap-2">
                {!isLoading && data ? (
                  <>
                    <span className="text-[11px] text-muted-foreground">
                      {routeLabel}
                    </span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <IconCircleCheckFilled size={10} />
                      Active
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Route-wise pricing details
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="max-h-[calc(90vh-130px)] overflow-y-auto">
            {/* AGREEMENT */}
            <div className="px-5 py-5">
              <SectionLabel>Agreement</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Agreement"
                  value={agreementLabel}
                  icon={<IconFileInvoice size={12} />}
                />
                <Field
                  label="Customer"
                  value={data?.agreement?.client?.name}
                  icon={<IconUser size={15} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* ROUTE */}
            <div className="px-5 py-5">
              <SectionLabel>Route Details</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="From City"
                  value={data?.route?.sourceCity?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="To City"
                  value={data?.route?.destinationCity?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="Route"
                  value={routeLabel}
                  icon={<IconRoute size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* VEHICLE & UNIT */}
            <div className="px-5 py-5">
              <SectionLabel>Vehicle & Unit</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Vehicle Type"
                  value={data?.vehicleType?.name}
                  icon={<IconTruck size={12} />}
                />

                <Field
                  label="Transport Type"
                  value={formatTransportType(data?.transportType)}
                  icon={<IconRoute size={12} />}
                />

                <Field
                  label="Unit"
                  value={unitLabel}
                  icon={<IconPackage size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* PRICING */}
            <div className="px-5 py-5">
              <SectionLabel>Pricing & Transit</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Rate"
                  value={formatCurrencyFromPaise(data?.rate)}
                  icon={<IconCurrencyRupee size={12} />}
                />

                <Field
                  label="Transit Days"
                  value={
                    data?.transitDays != null ? `${data.transitDays} days` : "-"
                  }
                  icon={<IconClock size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* REMARKS */}
            <div className="px-5 py-5">
              <SectionLabel>Remarks</SectionLabel>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <IconNotes size={13} />
                  Notes
                </div>

                <p className="text-sm font-medium leading-6 text-foreground">
                  {data?.remarks || "-"}
                </p>
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* SYSTEM INFO */}
            <div className="px-5 py-5">
              <SectionLabel>System Info</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Created at"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCirclePlus size={12} />}
                />

                <Field
                  label="Last updated"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12} />}
                />
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconClockEdit size={12} />
            Updated {formatDate(data?.updatedAt)}
          </span>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
