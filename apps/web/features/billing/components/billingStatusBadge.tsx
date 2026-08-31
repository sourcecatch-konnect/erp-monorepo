import { cn } from "@/lib/utils";

export type BillStatus =
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "FINALISED"
    | "SENT"
    | "PARTIALLY_PAID"
    | "PAID"
    | "CANCELLED";

const STATUS_LABELS: Record<BillStatus, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending review",
    APPROVED: "Approved",
    FINALISED: "Finalised",
    SENT: "Sent",
    PARTIALLY_PAID: "Partially paid",
    PAID: "Paid",
    CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<BillStatus, string> = {
    DRAFT:
        "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",

    PENDING_REVIEW:
        "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",

    APPROVED:
        "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",

    FINALISED:
        "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",

    SENT:
        "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",

    PARTIALLY_PAID:
        "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400",

    PAID:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",

    CANCELLED:
        "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
export function BillStatusBadge({
    status,
    className,
}: {
    status: BillStatus;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
                "text-xs font-semibold shadow-sm",
                STATUS_STYLES[status],
                className,
            )}
        >
            <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />

            {STATUS_LABELS[status]}
        </span>
    );
}
