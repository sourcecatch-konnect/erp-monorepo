import { cn } from "@skerp/ui/lib/util";

/**
 * A percentage as a ring, for places where a track has to read at a glance
 * (the track cards on "My role & training", the header of a lesson list).
 * Use ProgressBar where the number sits in a row of text instead.
 */
export function ProgressRing({
  percent,
  label,
  size = 44,
  className,
}: {
  percent: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = size <= 40 ? 4 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = value === 100;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className={cn(
            "transition-[stroke-dashoffset] duration-300",
            complete ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      <span
        aria-hidden
        className="absolute text-[11px] font-semibold tabular-nums text-foreground"
      >
        {value}%
      </span>
    </span>
  );
}
