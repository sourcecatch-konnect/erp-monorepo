import * as React from "react";
import type { OrderEvent } from "@skerp/types";
import { formatDateTime } from "./order-ui";

const EVENT_LABELS: Record<string, string> = {
  submitted: "Submitted for approval",
  resubmitted: "Edited & resubmitted",
  edited: "Edited",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const actorName = (e: OrderEvent) =>
  e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "—";

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  if (!events.length) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-medium">
              {EVENT_LABELS[e.eventType] ?? e.eventType}
            </span>
            <span className="text-xs text-muted-foreground">
              by {actorName(e)} · {formatDateTime(e.createdAt)}
            </span>
          </div>
          {e.note ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{e.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
