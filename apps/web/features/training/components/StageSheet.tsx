"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconBulb,
  IconCircleCheck,
} from "@tabler/icons-react";
import type { TrainingMe, TrainingStageKey } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { STAGE_CONTENT, STAGE_TERMS } from "../content/stages";
import { LANE_BY_KEY, STAGE_BY_KEY, previousStages } from "../lib/catalog-lookup";
import { Term } from "./Term";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

const CHIP =
  "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-sm text-foreground";

/** Everything about one business step: what, who, what's needed, what's next. */
export function StageSheet({
  stageKey,
  me,
  onOpenStage,
  onClose,
}: {
  stageKey: TrainingStageKey | null;
  me: TrainingMe;
  onOpenStage: (key: TrainingStageKey) => void;
  onClose: () => void;
}) {
  const stage = stageKey ? STAGE_BY_KEY.get(stageKey) : undefined;
  const view = stageKey ? me.stages.find((s) => s.key === stageKey) : undefined;
  const content = stageKey ? STAGE_CONTENT[stageKey] : undefined;
  const terms = stageKey ? (STAGE_TERMS[stageKey] ?? []) : [];

  const relatedButton = (key: TrainingStageKey) => {
    const related = STAGE_BY_KEY.get(key);
    if (!related) return null;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => onOpenStage(key)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <IconArrowRight className="size-4" aria-hidden />
          {related.title}
        </button>
      </li>
    );
  };

  return (
    <Sheet
      open={stage !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        {stage && view && content ? (
          <>
            <SheetHeader className="gap-1 border-b border-border px-6 py-4 pr-12">
              <p className="text-xs font-medium text-muted-foreground">
                {LANE_BY_KEY.get(stage.lane)?.title}
              </p>
              <SheetTitle className="text-lg">{stage.title}</SheetTitle>
              <SheetDescription>{stage.summary}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {view.owned ? (
                <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                  <IconCircleCheck className="size-4 shrink-0" aria-hidden />
                  This is one of your steps
                </p>
              ) : null}

              <Section title="What happens here">
                <p className="text-sm text-foreground">{content.explain}</p>
              </Section>

              <Section title="Who does it">
                <div className="flex flex-wrap gap-2">
                  {view.owned ? <span className={CHIP}>You</span> : null}
                  {view.owners.map((owner) => (
                    <span key={owner} className={CHIP}>
                      {owner}
                    </span>
                  ))}
                </div>
                {!view.owned && view.owners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No role is set up for this step yet.
                  </p>
                ) : null}
              </Section>

              <Section title="Before you start, you need">
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {content.needs.map((need) => (
                    <li key={need}>{need}</li>
                  ))}
                </ul>
              </Section>

              {content.statusFlows && content.statusFlows.length > 0 ? (
                <Section title="How the document's status changes">
                  <div className="space-y-3">
                    {content.statusFlows.map((flow) => (
                      <div key={flow.document} className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          {flow.document}
                        </p>
                        <ol className="flex flex-wrap items-center gap-1.5">
                          {flow.steps.map((status, index) => (
                            <li key={status} className="flex items-center gap-1.5">
                              {index > 0 ? (
                                <IconArrowRight
                                  className="size-3.5 text-muted-foreground"
                                  aria-hidden
                                />
                              ) : null}
                              <span className={CHIP}>{status}</span>
                            </li>
                          ))}
                        </ol>
                        {flow.also ? (
                          <p className="text-xs text-muted-foreground">{flow.also}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title="What you can do here">
                {view.abilities.length > 0 ? (
                  <ul className="space-y-1.5">
                    {view.abilities.map((ability) => (
                      <li key={ability} className="flex items-start gap-2 text-sm text-foreground">
                        <IconCircleCheck
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden
                        />
                        {ability}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {view.canOpen
                      ? "You can look at this step, but another team does the work."
                      : "Another team does this step."}
                  </p>
                )}
              </Section>

              {terms.length > 0 ? (
                <Section title="Words used here">
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                    {terms.map((id) => (
                      <Term key={id} id={id} />
                    ))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click a word to see what it means.
                  </p>
                </Section>
              ) : null}

              {previousStages(stage.key).length > 0 || stage.next.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {previousStages(stage.key).length > 0 ? (
                    <Section title="Comes before">
                      <ul className="space-y-1">
                        {previousStages(stage.key).map((prev) => relatedButton(prev.key))}
                      </ul>
                    </Section>
                  ) : null}
                  {stage.next.length > 0 ? (
                    <Section title="Comes next">
                      <ul className="space-y-1">{stage.next.map(relatedButton)}</ul>
                    </Section>
                  ) : null}
                </div>
              ) : null}

              {content.tip ? (
                <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  <IconBulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {content.tip}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {view.canOpen ? (
                <Button asChild>
                  <Link href={stage.href}>Go to this screen</Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <SheetTitle className="sr-only">Business step</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
