"use client";

import { useEffect } from "react";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import GRNForm from "@/features/grn/GRNForm";
import { useGRNDetail } from "@/features/grn/useHook/useGRN";


export default function GRNEditPage({
  params,
}: {
  params: {
    id: string;
  };
}) {
  const grnId = decodeURIComponent(params.id);
  const { setLabel } = useBreadcrumbLabels();

  const grnQuery = useGRNDetail(grnId);
  const grn = grnQuery.data;

  useEffect(() => {
    const href = `/vp-management/grn/${encodeURIComponent(grnId)}`;
    setLabel(href, grn?.grnNumber ?? null);

    return () => setLabel(href, null);
  }, [grn?.grnNumber, grnId, setLabel]);

  if (grnQuery.isLoading || !grn) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <GRNForm mode="edit" grn={grn} />;
}