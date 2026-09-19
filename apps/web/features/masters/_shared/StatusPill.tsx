import { cn } from "@/lib/utils";

/**
 * Shared visual shell for document-status pills. Several detail/list pages
 * (purchase order, spare inward, service bill, supplier replacement, ...)
 * each defined their own near-identical badge component — same markup,
 * same size, different color maps. This extracts the shell + the fixed
 * semantic-color palette so a module only has to map its own status enum
 * to a tone and a label, not re-implement the pill.
 */
export type StatusPillTone =
  | "slate"
  | "blue"
  | "sky"
  | "amber"
  | "orange"
  | "emerald"
  | "violet"
  | "rose";

const TONE_STYLES: Record<StatusPillTone, string> = {
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  orange: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: StatusPillTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        TONE_STYLES[tone],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}
