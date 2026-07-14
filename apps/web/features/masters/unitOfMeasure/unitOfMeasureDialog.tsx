"use client";

import { useQuery } from "@tanstack/react-query";
import {
  IconCalendar,
  IconCategory,
  IconCircleCheckFilled,
  IconClockEdit,
  IconHash,
  IconRulerMeasure,
} from "@tabler/icons-react";

import { Dialog, DialogContent, DialogTitle } from "@skerp/ui/components/dialog";
import {
  Field,
  formatDate,
  SectionLabel,
  SkeletonBody,
} from "../_shared/dialog-parts";
import { unitOfMeasureKeys } from "./unitOfMeasure.key";
import { unitOfMeasureApi } from "./unitOfMeasure.service";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  id?: string | null;
};

const categoryLabel = (value?: string) =>
  value
    ? value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "-";



export default function UnitOfMeasureDetailDialog({
  open,
  onOpenChange,
  id,
}: Props) {
  const detail = useQuery({
    queryKey: id
      ? unitOfMeasureKeys.detail(id)
      : ["unit-of-measure-detail-empty"],
    queryFn: () => unitOfMeasureApi.detail(id!),
    enabled: Boolean(open && id),
  });

  const data = detail.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[760px] h-[70vh] !max-h-[70vh] gap-0 overflow-hidden rounded-lg p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconRulerMeasure size={20} />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">
                {data?.name ?? "Unit of Measure"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {data?.code ?? "Unit details"}
              </p>
            </div>
          </div>
        </div>

        <div className="h-full overflow-y-auto px-5 py-5">
          {detail.isLoading ? (
            <SkeletonBody />
          ) : (
            <div className="space-y-6">
              <section>
                <SectionLabel>Unit</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Code" value={data?.code} icon={<IconHash size={14} />} mono />
                  <Field label="Name" value={data?.name} />
                  <Field
                    label="Category"
                    value={categoryLabel(data?.category)}
                    icon={<IconCategory size={14} />}
                  />
                  <Field
                    label="Status"
                    value={data?.isActive ? "Active" : "Inactive"}
                    icon={<IconCircleCheckFilled size={14} />}
                  />
                </div>
              </section>

            

              <section>
                <SectionLabel>Timeline</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Created"
                    value={formatDate(data?.createdAt)}
                    icon={<IconCalendar size={14} />}
                  />
                  <Field
                    label="Updated"
                    value={formatDate(data?.updatedAt)}
                    icon={<IconClockEdit size={14} />}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
