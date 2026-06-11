import { cn } from "../lib/util";
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-md bg-muted",
        "bg-[linear-gradient(100deg,var(--muted)_40%,var(--background)_50%,var(--muted)_60%)] bg-[size:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
