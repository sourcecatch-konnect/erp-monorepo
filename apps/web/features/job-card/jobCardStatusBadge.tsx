import { cn } from "@/lib/utils";
import type { JobCardStatus } from "./api/job-card.service";

const STATUS_LABELS: Record<JobCardStatus, string> = {
    DRAFT: "Draft",
    FINALISED: "Finalised",
    CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<JobCardStatus, string> = {
    DRAFT:
        "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",

    FINALISED:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",

    CANCELLED:
        "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

type JobCardStatusBadgeProps = {
    status: JobCardStatus;
    className?: string;
};

export function JobCardStatusBadge({
    status,
    className,
}: JobCardStatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
                "text-xs font-semibold shadow-sm",
                STATUS_STYLES[status],
                className,
            )}
        >
            <span className="h-2 w-2 rounded-full bg-current" />

            {STATUS_LABELS[status]}
        </span>
    );
}