"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { tripApi } from "./trip.service";
import { tripKeys } from "./trip.keys";
import TripForm from "./TripForm";

export default function TripEditPage({ tripId }: { tripId: string }) {
  const { data: trip, isLoading } = useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: () => tripApi.detail(tripId),
  });

  if (isLoading || !trip) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <TripForm mode="edit" trip={trip} />;
}
