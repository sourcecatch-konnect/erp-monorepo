"use client";

import type { RateMatrixWithRelations } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import {
  Field,
  SectionLabel,
  SkeletonBody,
  formatCurrencyFromPaise,
} from "../_shared/dialog-parts";

import {
  IconUser,
  IconRoute,
  IconTruck,
  IconPackage,
  IconCurrencyRupee,
  IconClock,
  IconNotes,
  IconFileInvoice,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { rateMatrixKeys } from "./rateMatrix.key";
import { rateMatrixApi } from "./rateMatrix.service";
import { useQuery } from "@tanstack/react-query";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
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
  id,
}: Props) {
  const detailQuery = useQuery<RateMatrixWithRelations>({
    queryKey: id ? rateMatrixKeys.detail(id) : ["rateMatrix-detail-empty"],
    queryFn: () => rateMatrixApi.detail(id!),
    enabled: Boolean(open && id),
  });

  const data = detailQuery.data;
  const isLoading = detailQuery.isLoading;
  console.log(data,"rate Matrix")
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

          
          </div>
        )}

        {/* FOOTER */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
        

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
