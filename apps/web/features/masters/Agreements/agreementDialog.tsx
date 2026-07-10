"use client";

import type { AgreementWithRelations } from "@skerp/types";
import { Dialog, DialogContent, DialogTitle } from "@skerp/ui/components/dialog";

import {
  Field,
  PartyCard,
  SectionLabel,
  SkeletonBody,
  formatDate,
  getDaysRemaining,
} from "../_shared/dialog-parts";

import {
  IconBuilding,
  IconUser,
  IconMapPin,
  IconBuildingStore,
  IconCalendarCheck,
  IconTruck,
  IconClockEdit,
  IconCirclePlus,
  IconFileDescription,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { agreementKeys } from "./agreements.key";
import { agreementApi } from "./agreements.service";
import { useQuery } from "@tanstack/react-query";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
  data?: AgreementWithRelations;
  isLoading?: boolean;
};

export default function AgreementDetailDialog({
  open,
  onOpenChange,
  id,
  data: initialData,
  isLoading: initialLoading = false,
}: Props) {
  const detailQuery = useQuery({
    queryKey: id ? agreementKeys.detail(id) : ["agreement-detail-empty"],
    queryFn: () => agreementApi.detail(id!),
    enabled: Boolean(open && id && !initialData),
  });

  const data =
    initialData ?? (detailQuery.data as AgreementWithRelations | undefined);

  const isLoading = initialLoading || detailQuery.isLoading;

  const daysRemaining = getDaysRemaining(data?.expiryDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[580px] gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[900px]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFileDescription size={18} />
            </span>

            <div>
    <DialogTitle>Agreement Details</DialogTitle>

              <div className="mt-0.5 flex items-center gap-2">
                {!isLoading && data && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <IconCircleCheckFilled size={10} />
                      Active
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="max-h-[calc(90vh-130px)] overflow-y-auto">
            <div className="px-5 py-5">
              <SectionLabel>Parties</SectionLabel>

              <div className="grid grid-cols-2 gap-2.5">
                <PartyCard
                  label="Company"
                  name={data?.company?.name}
                  colorClass="bg-violet-100 text-violet-700"
                  icon={<IconBuilding size={15} />}
                />

                <PartyCard
                  label="Customer"
                  name={data?.client?.name}
                  colorClass="bg-teal-100 text-teal-700"
                  icon={<IconUser size={15} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            <div className="px-5 py-5">
              <SectionLabel>Timeline</SectionLabel>

              <div className="relative mb-4 grid grid-cols-3">
                <div className="absolute left-[6px] right-[6px] top-[5px] h-px bg-border" />

                {[
                  {
                    label: "Agreement date",
                    value: formatDate(data?.agreementDate),
                    sub: null,
                    warn: false,
                  },
                  {
                    label: "Start date",
                    value: formatDate(data?.startDate),
                    sub: null,
                    warn: false,
                  },
                  {
                    label: "Expiry date",
                    value: formatDate(data?.expiryDate),
                    sub:
                      daysRemaining !== null
                        ? daysRemaining > 0
                          ? `${daysRemaining} days left`
                          : "Expired"
                        : null,
                   
                  },
                ].map((item) => (
                  <div key={item.label} className="relative z-10">
                    <div
                      className={`mb-2 size-[11px] rounded-full border-2 bg-background ${
                        item.warn ? "border-amber-500" : "border-primary"
                      }`}
                    />

                    <p className="mb-1 text-xs text-muted-foreground">
                      {item.label}
                    </p>

                    <p
                      className={`text-[13px] font-medium ${
                        item.warn ? "text-amber-600" : "text-foreground"
                      }`}
                    >
                      {item.value}
                    </p>

                    {item.sub && (
                      <p className="mt-0.5 text-xs text-amber-500">
                        {item.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-5 border-t" />

            <div className="px-5 py-5">
              <SectionLabel>Location & Logistics</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="Branch"
                  value={data?.branch?.name}
                  icon={<IconBuildingStore size={12} />}
                />

            
              </div>
            </div>

            <div className="mx-5 border-t" />

            <div className="px-5 py-5">
              <SectionLabel>System info</SectionLabel>

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

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconCalendarCheck size={12} />
            Updated {formatDate(data?.updatedAt)}
          </span>

          <button
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