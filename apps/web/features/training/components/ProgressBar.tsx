import { cn } from "@skerp/ui/lib/util";

export function ProgressBar({
  percent,
  label,
  className,
}: {
  percent: number;
  label: string;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("h-2 w-full overflow-hidden rounded-sm bg-muted", className)}
    >
      <div
        className="h-full rounded-sm bg-primary transition-[width] duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
