"use client";

import * as React from "react";
import type { LorryReceipt, LRGroup } from "@skerp/types";
import { cn } from "@/lib/utils";

type Step = {
  label: string;
  at: string | null;
  by?: string | null;
  done: boolean;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * One-glance answer to "where is this consignment?": Created → Finalised →
 * (Held at hub → Dispatched from hub) → Delivered → POD received. Hub steps
 * only render when the group actually went through the hub.
 */
export default function LRTimeline({
  lr,
  group,
}: {
  lr: LorryReceipt;
  group: Pick<LRGroup, "finalisedAt" | "hubArrivalAt" | "hubId" | "secondaryTrip">;
}) {
  if (lr.status === "CANCELLED") return null;

  const name = (u?: { firstName: string; lastName: string } | null) =>
    u ? `${u.firstName} ${u.lastName}` : null;

  const wentViaHub = Boolean(group.hubId);
  const delivery = lr.delivery ?? null;
  const ack = lr.acknowledgement ?? null;

  const steps: Step[] = [
    { label: "Created", at: lr.createdAt, done: true },
    {
      label: "Finalised",
      at: group.finalisedAt,
      done: Boolean(group.finalisedAt),
    },
    ...(wentViaHub
      ? [
          {
            label: "Held at hub",
            at: group.hubArrivalAt,
            done: Boolean(group.hubArrivalAt),
          },
          {
            label: "Dispatched from hub",
            at: null,
            done: Boolean(group.secondaryTrip),
          },
        ]
      : []),
    {
      label: "Delivered",
      at: delivery?.deliveredAt ?? null,
      by: name(delivery?.createdBy),
      done: Boolean(delivery),
    },
    {
      label: "POD received",
      at: ack?.receivedAt ?? null,
      by: name(ack?.createdBy),
      done: Boolean(ack),
    },
  ];

  return (
    <ol className="mb-3 flex flex-wrap items-start gap-0 text-xs">
      {steps.map((step, idx) => (
        <li key={step.label} className="flex items-start">
          {idx > 0 && (
            <span
              aria-hidden
              className={cn(
                "mx-1.5 mt-[5px] h-px w-5",
                step.done ? "bg-primary" : "bg-border",
              )}
            />
          )}
          <span className="flex flex-col items-start">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "h-2.5 w-2.5 rounded-full border",
                  step.done
                    ? "border-primary bg-primary"
                    : "border-border bg-background",
                )}
              />
              <span
                className={cn(
                  "font-medium",
                  step.done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </span>
            {step.at && step.done ? (
              <span className="ml-4 text-muted-foreground">
                {fmt(step.at)}
                {step.by ? ` · ${step.by}` : ""}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
