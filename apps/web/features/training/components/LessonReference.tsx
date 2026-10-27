"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBook2,
  IconChevronDown,
  IconListCheck,
  IconRefresh,
  type Icon,
} from "@tabler/icons-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@skerp/ui/components/collapsible";
import { cn } from "@skerp/ui/lib/util";
import { GLOSSARY } from "../content/glossary";
import type { LessonContent } from "../content/lessons";
import { Term } from "./Term";

const GLOSSARY_BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

/** One closed row: icon, title with a count, and a one-line preview of what is inside. */
function ReferenceRow({
  icon: RowIcon,
  tone,
  title,
  preview,
  children,
}: {
  icon: Icon;
  tone: "success" | "primary" | "warning";
  title: string;
  preview: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-b border-border last:border-b-0"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-muted">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            tone === "success"
              ? "bg-success/15 text-success"
              : tone === "warning"
                ? "bg-warning/15 text-warning"
                : "bg-primary/10 text-primary",
          )}
        >
          <RowIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {preview}
          </span>
        </span>
        <IconChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open ? "rotate-180" : undefined,
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3.5 pb-4 pl-[3.1rem] pt-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The parts of a lesson that are reference, not action: what must exist
 * first, how the status moves, the words used, the thing to watch out for.
 * Closed by default — a lesson that opens everything at once is a wall.
 */
export function LessonReference({ content }: { content: LessonContent }) {
  const needs = content.needs ?? [];
  const terms = (content.terms ?? [])
    .map((id) => GLOSSARY_BY_ID.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  const flow = content.statusFlow;

  if (needs.length === 0 && terms.length === 0 && !flow && !content.warn)
    return null;

  return (
    <div className="h-fit w-full overflow-hidden rounded-lg border border-border">
      {needs.length > 0 ? (
        <ReferenceRow
          icon={IconListCheck}
          tone="success"
          title={`Before you start — ${needs.length} ${needs.length === 1 ? "thing" : "things"} needed`}
          preview={needs.join(" · ")}
        >
          <ul className="space-y-1.5">
            {needs.map((need) => (
              <li
                key={need}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <IconListCheck className="size-2.5" aria-hidden />
                </span>
                <span>{need}</span>
              </li>
            ))}
          </ul>
        </ReferenceRow>
      ) : null}

      {flow ? (
        <ReferenceRow
          icon={IconRefresh}
          tone="primary"
          title={`How the ${flow.document}'s status moves`}
          preview={flow.steps.join(" → ")}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {flow.steps.map((status, index) => (
              <span key={status} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <IconArrowRight
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    index === flow.steps.length - 1
                      ? "border-success/35 bg-success/15 text-foreground"
                      : index === 0
                        ? "border-border bg-background text-foreground"
                        : "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  {status}
                </span>
              </span>
            ))}
          </div>
          {flow.also ? (
            <p className="mt-2 text-xs text-muted-foreground">{flow.also}</p>
          ) : null}
        </ReferenceRow>
      ) : null}

      {terms.length > 0 ? (
        <ReferenceRow
          icon={IconBook2}
          tone="primary"
          title={`Words in this lesson (${terms.length})`}
          preview={terms.map((entry) => entry.term).join(" · ")}
        >
          <div className="flex flex-wrap gap-1.5">
            {terms.map((entry) => (
              <span
                key={entry.id}
                className="rounded-lg border border-dashed border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                <Term id={entry.id}>
                  <span className="font-semibold text-foreground">
                    {entry.term}
                  </span>
                </Term>
                {entry.fullName ? ` — ${entry.fullName}` : null}
              </span>
            ))}
          </div>
        </ReferenceRow>
      ) : null}

      {content.warn ? (
        <ReferenceRow
          icon={IconAlertTriangle}
          tone="warning"
          title="Watch out — 1 thing"
          preview={content.warn}
        >
          <p className="text-sm text-muted-foreground">{content.warn}</p>
        </ReferenceRow>
      ) : null}
    </div>
  );
}
