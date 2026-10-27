import Link from "next/link";
import { IconChevronRight, type Icon } from "@tabler/icons-react";
import {
  StatTile as SharedStatTile,
  statToneBadge,
  statToneSurface,
  type StatTone,
} from "@skerp/ui/components/stat-tile";
import { cn } from "@/lib/utils";

export type { StatTone };

/**
 * The training pages' stat tile. The tile itself lives in @skerp/ui so the
 * dashboard and My Work use the same one; this only adds the "tile is a link"
 * case, which needs next/link and so cannot live in the shared package.
 */
export function StatTile({
  icon: TileIcon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: Icon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone: StatTone;
}) {
  if (!href)
    return (
      <SharedStatTile
        icon={TileIcon}
        label={label}
        value={value}
        hint={hint}
        tone={tone}
      />
    );

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors duration-150 hover:border-primary/40",
        statToneSurface(tone),
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          statToneBadge(tone),
        )}
      >
        <TileIcon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="block text-lg font-semibold leading-tight tabular-nums text-foreground">
          {value}
        </span>
        {hint ? (
          <span className="block truncate text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <IconChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}
