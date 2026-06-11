import { cn } from "@skerp/ui/lib/util";
import {
  IconTruck,
  IconTrain,
  IconPlane,
  IconShip,
  IconArrowNarrowRight,
} from "@tabler/icons-react";
import type { EwbTransMode } from "../types";

const MODE_ICON = {
  ROAD: IconTruck,
  RAIL: IconTrain,
  AIR: IconPlane,
  SHIP: IconShip,
} satisfies Record<EwbTransMode, typeof IconTruck>;

export function RouteHeader({
  fromPlace,
  fromState,
  toPlace,
  toState,
  distanceKm,
  transMode,
  className,
}: {
  fromPlace: string;
  fromState: string;
  toPlace: string;
  toState: string;
  distanceKm: number;
  transMode: EwbTransMode;
  className?: string;
}) {
  const Icon = MODE_ICON[transMode];
  return (
    <div
      className={cn(
        "flex items-center gap-4 border bg-card p-4",
        className
      )}
    >
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          From
        </div>
        <div className="text-base font-semibold text-foreground">
          {fromPlace}
        </div>
        <div className="text-xs text-muted-foreground">{fromState}</div>
      </div>

      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-px w-8 bg-border" />
          <Icon className="size-4" />
          <div className="h-px w-8 bg-border" />
        </div>
        <div className="text-[10px] tabular-nums">{distanceKm} km</div>
      </div>

      <div className="flex-1 text-right">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          To
        </div>
        <div className="text-base font-semibold text-foreground">{toPlace}</div>
        <div className="text-xs text-muted-foreground">{toState}</div>
      </div>

      <IconArrowNarrowRight className="size-5 text-muted-foreground sr-only" />
    </div>
  );
}
