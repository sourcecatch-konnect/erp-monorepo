"use client";

import * as React from "react";
import type { LorryReceipt, LRGroup } from "@skerp/types";
import { IconRoute } from "@tabler/icons-react";
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
  group: Pick<
    LRGroup,
    "finalisedAt" | "hubArrivalAt" | "hubId" | "secondaryTrip"
  >;
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
    <section className="mb-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <IconRoute size={17} className="text-primary" /> Consignment journey
      </h3>
      <ol className="space-y-0 rounded-md border border-border bg-muted/20 p-4 sm:hidden">
        {steps.map((step, idx) => (
          <li
            key={step.label}
            className="relative min-h-16 pb-4 pl-7 last:min-h-0 last:pb-0"
          >
            {idx < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 left-1.5 top-3 w-px",
                  steps[idx + 1]?.done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1 size-3 rounded-full border",
                step.done
                  ? "border-primary bg-primary"
                  : "border-border bg-background",
              )}
            />
            <p
              className={cn(
                "text-sm font-semibold",
                step.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </p>
            {step.at && step.done ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {fmt(step.at)}
                {step.by ? ` · ${step.by}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      <ol className="hidden items-start overflow-x-auto rounded-md border border-border bg-muted/20 p-4 sm:flex">
        {steps.map((step, idx) => (
          <li key={step.label} className="flex min-w-36 flex-1 items-start">
            {idx > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 mt-1.5 h-px w-6 shrink-0",
                  step.done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span className="flex flex-col items-start">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-3 rounded-full border",
                    step.done
                      ? "border-primary bg-primary"
                      : "border-border bg-background",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-semibold",
                    step.done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </span>
              {step.at && step.done ? (
                <span className="ml-5 mt-1 text-xs text-muted-foreground">
                  {fmt(step.at)}
                  {step.by ? ` · ${step.by}` : ""}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
