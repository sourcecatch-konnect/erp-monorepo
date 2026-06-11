"use client";

import * as React from "react";
import type { CompanyWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
} from "@skerp/ui/components/dialog";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";

import { Skeleton } from "@skerp/ui/components/skeleton";


import { SectionLabel ,
    Field,
  PartyCard,
  formatDate,
} from "../_shared/dialog-parts"
import {
  IconBuilding,
  IconMapPin,
  IconPhone,
  IconCalendar,
  IconId,
  IconHome,
  IconPhoto,
  IconCircleCheckFilled,
  IconClockEdit,
  IconTruck,
  IconCalendarCheck,
  IconUser,
  IconFileDescription,
  IconClock,
  IconRoute,
} from "@tabler/icons-react";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data?: CompanyWithRelations;
  isLoading?: boolean;
};

function SkeletonBody() {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-4 w-28" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, x) => (
              <Skeleton
                key={x}
                className="h-14 rounded-lg"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CompanyDetailDialog({
  open,
  onOpenChange,
  data,
  isLoading,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
<DialogContent
  className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0"
>
        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">

            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuilding size={20}/>
            </span>

            <div>
              <p className="text-sm font-semibold">
                Company Details
              </p>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10}/>
                  Active Profile
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody/>
        ) : (
          <div className="h-[calc(95vh-120px)] overflow-y-auto">

            {/* Company Summary */}

            <div className="px-5 py-5">
              <SectionLabel>
                Company Overview
              </SectionLabel>

              <PartyCard
                label="Company"
                name={data?.name}
                subtitle={data?.city?.name}
                colorClass="bg-violet-100 text-violet-700"
                icon={<IconBuilding size={15}/>}
              />
            </div>

            <div className="mx-5 border-t"/>

            <Tabs
              defaultValue="profile"
              className="w-full"
            >
              <div className="px-5 py-4">

                <TabsList>
                  <TabsTrigger value="profile">
                    Profile
                  </TabsTrigger>

                  <TabsTrigger value="agreements">
                    Agreements (
                    {data?.agreements?.length ?? 0}
                    )
                  </TabsTrigger>

                  <TabsTrigger value="rates">
                    Rate Matrix
                  </TabsTrigger>

                </TabsList>

              </div>

              {/* Profile */}

              <TabsContent
                value="profile"
                className="m-0 px-5 pb-5"
              >

                <SectionLabel>
                  Company Information
                </SectionLabel>

                <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                  <Field
                    label="Country"
                    value={data?.country}
                    icon={<IconMapPin size={12}/>}
                  />

                  <Field
                    label="State"
                    value={data?.state?.name}
                    icon={<IconMapPin size={12}/>}
                  />

                  <Field
                    label="City"
                    value={data?.city?.name}
                    icon={<IconMapPin size={12}/>}
                  />

                  <Field
                    label="Contact"
                    value={data?.contactPhone}
                    icon={<IconPhone size={12}/>}
                  />

                  <Field
                    label="Established"
                    value={formatDate(
                      data?.establishmentYear
                    )}
                    icon={<IconCalendar size={12}/>}
                  />

                  <Field
                    label="PAN"
                    value={data?.companyPAN}
                    icon={<IconId size={12}/>}
                  />

                  <Field
                    label="TAN"
                    value={data?.companyTAN}
                    icon={<IconId size={12}/>}
                  />

                  <Field
                    label="Logo"
                    value={data?.mainLogoPath}
                    icon={<IconPhoto size={12}/>}
                  />

                  <Field
                    label="Address"
                    value={data?.address}
                    icon={<IconHome size={12}/>}
                  />

                </div>

              </TabsContent>

              {/* Agreements */}

            <TabsContent value="agreements" className="m-0 px-5 pb-5">
  <div className="space-y-5">
    {data?.agreements?.length ? (
      data.agreements.map((agreement) => (
        <div key={agreement.id} className="border-b pb-5">
          <SectionLabel>Agreement</SectionLabel>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <PartyCard
              label="Customer"
              name={agreement.client?.name}
              subtitle="Agreement client"
              colorClass="bg-teal-100 text-teal-700"
              icon={<IconUser size={15} />}
            />

            <PartyCard
              label="Branch"
              name={agreement.branch?.name}
              subtitle={agreement.city?.name}
              colorClass="bg-orange-100 text-orange-700"
              icon={<IconBuilding size={15} />}
            />
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Field
              label="Agreement Date"
              value={formatDate(agreement.agreementDate)}
              icon={<IconCalendarCheck size={12} />}
            />

            <Field
              label="Start Date"
              value={formatDate(agreement.startDate)}
              icon={<IconCalendarCheck size={12} />}
            />

            <Field
              label="Expiry Date"
              value={formatDate(agreement.expiryDate)}
              icon={<IconCalendarCheck size={12} />}
            />

            <Field
              label="City"
              value={agreement.city?.name ?? "-"}
              icon={<IconMapPin size={12} />}
            />

            <Field
              label="Carrying Capacity"
              value={
                agreement.carryingCapacity != null
                  ? `${agreement.carryingCapacity} Ton`
                  : "-"
              }
              icon={<IconTruck size={12} />}
            />

       
          </div>
        </div>
      ))
    ) : (
      <p className="text-sm text-muted-foreground">
        No agreements found for this company.
      </p>
    )}
  </div>
</TabsContent>

              {/* Rates */}
<TabsContent value="rates" className="m-0 px-5 pb-5">
  <div className="space-y-5">
    {data?.agreements?.some((a) => a.RateMatrix?.length) ? (
      data.agreements.flatMap((agreement) =>
        agreement.RateMatrix?.map((rate) => (
          <div key={rate.id} className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconRoute size={15} />
                  </span>

                  <div>
                    <p className="text-sm font-semibold">
                      {rate.route?.sourceCity?.name ?? "-"} →{" "}
                      {rate.route?.destinationCity?.name ?? "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Customer: {agreement.client?.name ?? "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-right text-emerald-700">
                <p className="text-xs font-medium">Freight Rate</p>
                <p className="text-sm font-bold">₹{rate.rate}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-x-6 gap-y-4 border-t pt-4">
              <Field
                label="Source City"
                value={rate.route?.sourceCity?.name ?? "-"}
                icon={<IconMapPin size={12} />}
              />

              <Field
                label="Destination City"
                value={rate.route?.destinationCity?.name ?? "-"}
                icon={<IconMapPin size={12} />}
              />

              <Field
                label="Transit Days"
                value={rate.transitDays ? `${rate.transitDays} days` : "-"}
                icon={<IconClock size={12} />}
              />

              <Field
                label="Agreement Client"
                value={agreement.client?.name ?? "-"}
                icon={<IconUser size={12} />}
              />

              <Field
                label="Remarks"
                value={rate.remarks ?? "-"}
                icon={<IconFileDescription size={12} />}
              />

            </div>
          </div>
        )) ?? []
      )
    ) : (
      <p className="text-sm text-muted-foreground">
        No rate matrix found for this company.
      </p>
    )}
  </div>
</TabsContent>

            </Tabs>
          </div>
        )}

        {/* Footer */}

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">

          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconClockEdit size={12}/>
            Updated {formatDate(data?.updatedAt)}
          </span>

          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border px-4 py-1.5 text-xs"
          >
            Close
          </button>

        </div>

      </DialogContent>
    </Dialog>
  );
}