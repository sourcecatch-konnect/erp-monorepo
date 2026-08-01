"use client";

import { Skeleton } from "@skerp/ui/components/skeleton";

import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import RailRakeOperationForm from "./RailRakeOperationForm";
import { useRailRakeOperationDetail } from "./useRailRakeOperation";
import {
  railRakeOperationContext,
  type RailRakeOperationContext,
} from "./rail-rake-operation.context";

export default function RailRakeOperationEdit({
  id,
  context,
}: {
  id: string;
  context: RailRakeOperationContext;
}) {
  const contextConfig = railRakeOperationContext[context];
  const query = useRailRakeOperationDetail(id);

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
        <p className="font-semibold">Unable to load Rake operation</p>
        <p className="text-sm text-muted-foreground">
          {getErrorMessage(query.error)}
        </p>
      </div>
    );
  }
  if (query.data.status !== "DRAFT") {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="font-semibold">This Rake operation cannot be edited</p>
        <p className="text-sm text-muted-foreground">
          Only draft operations can be changed.
        </p>
      </div>
    );
  }
  if (query.data.stage !== contextConfig.stage) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="font-semibold">Rake operation not found on this page</p>
      </div>
    );
  }

  return (
    <RailRakeOperationForm
      mode="edit"
      context={context}
      initialData={query.data}
    />
  );
}
