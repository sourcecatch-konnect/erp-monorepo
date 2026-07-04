"use client";

import * as React from "react";
import type { VehicleJourney } from "@skerp/types";
import { IconArrowRight, IconHome, IconTruck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "./journey-ui";

/**
 * City chain for the journey: start city, then each leg's destination.
 * The current city is highlighted; the return city carries a home marker.
 */
export default function JourneyTimeline({
  journey,
}: {
  journey: VehicleJourney;
}) {
  const legs = (journey.trips ?? []).filter((l) => l.status !== "Cancelled");

  const nodes: {
    key: string;
    city: string;
    cityId: string | null;
    caption?: string;
    legStatus?: string;
  }[] = [
    {
      key: "start",
      city: journey.startCity?.name ?? "?",
      cityId: journey.startCityId,
      caption: formatDateTime(journey.startedAt),
    },
    ...legs.map((leg) => ({
      key: leg.id,
      city: leg.toCity?.name ?? "?",
      cityId: leg.toCityId,
      caption:
        leg.status === "Closed"
          ? `${formatDateTime(leg.endDateTime)}${leg.closingKm !== null ? ` · KM ${leg.closingKm}` : ""}`
          : leg.status === "InTransit"
            ? "In transit"
            : "Planned",
      legStatus: leg.status,
    })),
  ];

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border bg-card p-4">
      {nodes.map((node, index) => {
        const isCurrent =
          node.cityId === journey.currentCityId &&
          // Highlight the last occurrence of the current city in the chain.
          nodes.slice(index + 1).every((n) => n.cityId !== journey.currentCityId);
        const isReturn = node.cityId === journey.returnCityId && index > 0;
        return (
          <React.Fragment key={node.key}>
            {index > 0 ? (
              <IconArrowRight
                size={16}
                className="mt-2 shrink-0 text-muted-foreground"
              />
            ) : null}
            <div
              className={cn(
                "rounded-md border px-3 py-1.5",
                isCurrent
                  ? "border-primary bg-primary/5"
                  : node.legStatus === "InTransit"
                    ? "border-blue-500/30 bg-blue-500/5"
                    : "bg-background",
              )}
            >
              <div className="flex items-center gap-1.5">
                {isReturn ? (
                  <IconHome size={14} className="text-muted-foreground" />
                ) : null}
                {isCurrent ? (
                  <IconTruck size={14} className="text-primary" />
                ) : null}
                <span className="text-sm font-medium">{node.city}</span>
              </div>
              {node.caption ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {node.caption}
                </p>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
