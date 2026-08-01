"use client";

import * as React from "react";

import { Skeleton } from "@skerp/ui/components/skeleton";

import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import RailBranchGRNForm from "./RailBranchGRNForm";
import { useRailBranchGRNDetail } from "./useRailBranchGRN";

type Props = {
    branchGrnId: string;
};

export default function RailBranchGRNEditPage({
    branchGrnId,
}: Props) {
    const { setLabel } = useBreadcrumbLabels();
    const detailQuery = useRailBranchGRNDetail(branchGrnId);

    React.useEffect(() => {
        const href = `/vp-management/branch-grn/${encodeURIComponent(
            branchGrnId,
        )}`;

        const label = detailQuery.data
            ? `${detailQuery.data.railRake.rakeNumber} · ${detailQuery.data.vpWagonLoading.mrRrRow.vpNo || "VP"
            }`
            : null;

        setLabel(href, label);

        return () => {
            setLabel(href, null);
        };
    }, [branchGrnId, detailQuery.data, setLabel]);

    if (detailQuery.isLoading) {
        return (
            <div className="mx-auto max-w-7xl space-y-4 p-4">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-96 rounded-lg" />
            </div>
        );
    }

    if (detailQuery.isError || !detailQuery.data) {
        return (
            <div className="mx-auto max-w-3xl p-4">
                <div className="rounded-lg border bg-card p-5">
                    <p className="font-semibold">Unable to load Branch GRN</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getErrorMessage(detailQuery.error)}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <RailBranchGRNForm
            mode="edit"
            id={branchGrnId}
        />
    );
}