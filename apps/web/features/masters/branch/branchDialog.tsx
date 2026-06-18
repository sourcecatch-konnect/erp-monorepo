"use client";

import * as React from "react";
import type { Branch } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@skerp/ui/components/dialog";



import {
  SectionLabel,
  Field,
  PartyCard,
  formatDate,
  SkeletonBody,
} from "../_shared/dialog-parts";

import {
  IconBuildingStore,
  IconBuilding,
  IconMapPin,
  IconPhone,
  IconMail,
  IconId,
  IconClock,
  IconCalendar,
  IconHome,
  IconCircleCheckFilled,
  IconClockEdit,
  IconShieldCheck,
  IconTrain,
  IconReceipt,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { branchKeys } from "./branch.key";
import { branchApi } from "./branch.service";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
};

export default function BranchDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
    const branchDetail = useQuery({
    queryKey: id ? branchKeys.detail(id) : ["branch-detail-empty"],
    queryFn: () => branchApi.detail(id!),
    enabled: Boolean(open && id),
  });
const yesNo = (value?: boolean) => (value ? "Yes" : "No");
  const data = branchDetail.data;
  const isLoading = branchDetail.isLoading;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBuildingStore size={20} />
            </span>

            <div>
              <DialogTitle>Branch Details</DialogTitle>
              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Branch
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(95vh-120px)] overflow-y-auto">
            {/* Branch Summary */}
          

            {/* Branch Information */}
            <div className="px-5 py-5">
              <SectionLabel>Branch Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                   <Field
      label="Branch Name"
      value={data?.name}
      icon={<IconBuildingStore size={12} />}
    />
                <Field
                  label="Branch Code"
                  value={data?.branchCode}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Short Code"
                  value={data?.shortCode}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Company"
                  value={data?.company?.name}
                  icon={<IconBuilding size={12} />}
                />

                <Field
                  label="City"
                  value={data?.city?.name}
                  icon={<IconMapPin size={12} />}
                />

                <Field
                  label="Contact Name"
                  value={data?.contactName}
                  icon={<IconPhone size={12} />}
                />

                <Field
                  label="Contact Phone"
                  value={data?.contactPhone}
                  icon={<IconPhone size={12} />}
                />

                <Field
                  label="Email"
                  value={data?.email}
                  icon={<IconMail size={12} />}
                />

                <Field
                  label="Weekly Off Day"
                  value={data?.weeklyOffDay}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="GST No"
                  value={data?.gstNo}
                  icon={<IconId size={12} />}
                />

                <Field
                  label="Working Hours"
                  value={data?.workingHours}
                  icon={<IconClock size={12} />}
                />

                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconCalendar size={12} />}
                />

                <div className="col-span-3">
                  <Field
                    label="Address"
                    value={data?.address}
                    icon={<IconHome size={12} />}
                  />
                </div>
              </div>
            </div>
            <div className="mx-5 border-t" />

<div className="px-5 py-5">
  <SectionLabel>Branch Permissions</SectionLabel>

  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
    <Field
      label="Allow LR"
      value={yesNo(data?.allowLR)}
      icon={<IconReceipt size={12} />}
    />

    <Field
      label="Allow Receipt"
      value={yesNo(data?.allowReceipt)}
      icon={<IconReceipt size={12} />}
    />

    <Field
      label="Rail Head"
      value={yesNo(data?.isRailHead)}
      icon={<IconTrain size={12} />}
    />

    <Field
      label="Head Office"
      value={yesNo(data?.isHeadOffice)}
      icon={<IconShieldCheck size={12} />}
    />
  </div>
</div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconClockEdit size={12} />
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
