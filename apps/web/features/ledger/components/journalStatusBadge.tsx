import { cn } from "@/lib/utils";
import type { JournalStatus } from "../voucher.types";

const STATUS_LABELS: Record<JournalStatus, string> = {
    DRAFT: "Draft",
    POSTED: "Posted",
    REVERSED: "Reversed",
};

const STATUS_STYLES: Record<JournalStatus, string> = {
    DRAFT:
        "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",
    POSTED:
        "border-primary/20 bg-primary/10 text-primary",
    REVERSED:
        "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function JournalStatusBadge({
    status,
    className,
}: {
    status: JournalStatus;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5",
                "text-xs font-medium",
                STATUS_STYLES[status],
                className,
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {STATUS_LABELS[status]}
        </span>
    );
}
