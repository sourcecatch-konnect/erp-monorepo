"use client";

import { Skeleton } from "@skerp/ui/components/skeleton";

import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import DeliveryChallanForm from "./DeliveryChallanForm";
import { useDeliveryChallanDetail } from "./useDeliveryChallan";

export default function DeliveryChallanEdit({
  deliveryChallanId,
}: {
  deliveryChallanId: string;
}) {
  const query = useDeliveryChallanDetail(deliveryChallanId);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border bg-card p-5">
          <p className="font-semibold">Unable to load Delivery Challan</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getErrorMessage(query.error)}
          </p>
        </div>
      </div>
    );
  }

  if (query.data.status !== "DRAFT") {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border bg-card p-5">
          <p className="font-semibold">This challan cannot be edited</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Only draft Delivery Challans can be changed.
          </p>
        </div>
      </div>
    );
  }

  return <DeliveryChallanForm mode="edit" initialData={query.data} />;
}
