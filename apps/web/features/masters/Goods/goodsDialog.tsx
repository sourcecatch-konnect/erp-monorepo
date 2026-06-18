"use client";

import * as React from "react";


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
  IconBox,
  IconCategory,
  IconRulerMeasure,
  IconWeight,
  IconStack,
  IconCalendar,
  IconClockEdit,
  IconAlignBoxBottomCenter,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { goodsKeys } from "./goods.key";
import { goodsApi } from "./goods.service";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
};
const BooleanBadge = ({ value }: { value?: boolean }) => {
  if (value === true)
    return <span className="text-green-600">Yes</span>;

  if (value === false)
    return <span className="text-red-600">No</span>;

  return <span>-</span>;
};
export default function GoodsDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
    const goodsDetail = useQuery({
    queryKey: id ? goodsKeys.detail(id) : ["goods-empty"],
    queryFn: () => goodsApi.detail(id!),
    enabled: Boolean(open && id),
  });

  const data = goodsDetail.data;
  const isLoading = goodsDetail.isLoading;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[1000px] h-[90vh] !max-h-[90vh] gap-0 overflow-hidden rounded-lg p-0">
        {/* Header */}

        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBox size={20} />
            </span>

            <div>
              <DialogTitle>Goods Details</DialogTitle>

              {!isLoading && data && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <IconCircleCheckFilled size={10} />
                  Active Goods
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <SkeletonBody />
        ) : (
          <div className="h-[calc(90vh-120px)] overflow-y-auto">
            {/* Overview */}

            <div className="px-5 py-5">
              <SectionLabel>Goods Overview</SectionLabel>

              <PartyCard
                label="Goods"
                name={data?.name}
                subtitle={data?.category}
                colorClass="bg-blue-100 text-blue-700"
                icon={<IconBox size={15} />}
              />
            </div>

            <div className="mx-5 border-t" />

            {/* Goods Information */}

            <div className="px-5 py-5">
              <SectionLabel>Goods Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Category"
                  value={data?.category}
                  icon={<IconCategory size={12} />}
                />

                <Field
                  label="Weight"
                  value={data?.weight != null ? `${data.weight} kg` : "-"}
                  icon={<IconWeight size={12} />}
                />

                <Field
                  label="Dimensions"
                  value={`${data?.length ?? "-"} × ${data?.width ?? "-"} × ${data?.height ?? "-"}`}
                  icon={<IconRulerMeasure size={12} />}
                />

                <Field
                  label="Storage Position"
                  value={data?.storagePosition}
                  icon={<IconStack size={12} />}
                />

                <Field
                  label="Storage Layer"
                  value={data?.storageLayer}
                  icon={<IconAlignBoxBottomCenter size={12} />}
                />

               <Field
  label="Stacking Allowed"
  value={<BooleanBadge value={data?.isStackingAllowed} />}
  icon={<IconStack size={12} />}
/>

                <Field
                  label="Description"
                  value={data?.description}
                  icon={<IconBox size={12} />}
                />
              </div>
            </div>

            <div className="mx-5 border-t" />

            {/* System */}

            <div className="px-5 py-5">
              <SectionLabel>System Information</SectionLabel>

              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Created At"
                  value={formatDate(data?.createdAt)}
                  icon={<IconCalendar size={12} />}
                />

                <Field
                  label="Updated At"
                  value={formatDate(data?.updatedAt)}
                  icon={<IconClockEdit size={12} />}
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
