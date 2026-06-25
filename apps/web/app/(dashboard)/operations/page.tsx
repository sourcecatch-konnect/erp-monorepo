import Link from "next/link";
import { IconTrain } from "@tabler/icons-react";

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Operations</h1>
        <p className="text-sm text-muted-foreground">
          Railway and transport operation workflows
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Link
          href="/operations/vp-schedule"
          className="group flex items-start gap-3 rounded-md border border-border bg-white p-3.5 transition-all duration-150 hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary">
            <IconTrain size={16} strokeWidth={1.75} />
          </span>

          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-snug text-foreground">
              VP Schedule
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Plan railway VP schedule, wagons and capacity
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}