import { Skeleton } from "@skerp/ui/components/skeleton";
import {
    IconCircleCheck,
    IconClock,
    IconCurrencyRupee,
    IconFileDescription,
} from "@tabler/icons-react";
import { formatAmount, LRUnloadingReportRow } from "./lr-unloading-report.util";


type UnloadingReportSummaryProps = {
    rows: LRUnloadingReportRow[];
    isLoading: boolean;
};

type SummaryCardProps = {
    label: string;
    value: string | number;
    description: string;
    icon: React.ReactNode;
    isLoading: boolean;
};

function SummaryCard({
    label,
    value,
    description,
    icon,
    isLoading,
}: SummaryCardProps) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-muted-foreground">
                        {label}
                    </p>

                    {isLoading ? (
                        <Skeleton className="mt-2 h-7 w-20" />
                    ) : (
                        <p className="mt-1 text-2xl font-semibold tracking-tight">
                            {value}
                        </p>
                    )}

                    <p className="mt-1 text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {icon}
                </div>
            </div>
        </div>
    );
}

export function UnloadingReportSummary({
    rows,
    isLoading,
}: UnloadingReportSummaryProps) {
    const pendingPod = rows.filter(
        (row) => row.status === "DELIVERED",
    ).length;

    const acknowledged = rows.filter(
        (row) => row.status === "ACKNOWLEDGED",
    ).length;

    const detentionAmount = rows.reduce((total, row) => {
        const amount = Number(row.detentionAmount ?? 0);
        return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
                label="Total records"
                value={rows.length}
                description="Filtered unloading records"
                icon={<IconFileDescription size={20} />}
                isLoading={isLoading}
            />

            <SummaryCard
                label="Pending POD"
                value={pendingPod}
                description="Awaiting returned POD"
                icon={<IconClock size={20} />}
                isLoading={isLoading}
            />

            <SummaryCard
                label="Acknowledged"
                value={acknowledged}
                description="POD successfully received"
                icon={<IconCircleCheck size={20} />}
                isLoading={isLoading}
            />

            <SummaryCard
                label="Detention amount"
                value={formatAmount(detentionAmount)}
                description="For the filtered records"
                icon={<IconCurrencyRupee size={20} />}
                isLoading={isLoading}
            />
        </div>
    );
}