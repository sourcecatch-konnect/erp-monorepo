"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconHelpCircle,
  IconPlayerPlay,
  IconRoute,
  IconSchool,
} from "@tabler/icons-react";
import type { TrainingStageKey } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { HelpSection, HelpSheet } from "@skerp/ui/components/help-sheet";
import { Tour, type TourCloseReason, type TourStep } from "@skerp/ui/components/tour";
import { useStepProgress, useTrainingMe } from "../hooks/useTraining";
import { STAGE_BY_KEY, TRACK_BY_KEY, previousStages } from "../lib/catalog-lookup";
import { Term } from "./Term";

/** A guided tour for one screen. Seen state is saved as training step `tour.<key>`. */
export type PageTour = { key: string; steps: TourStep[] };

/**
 * What the Help panel says about one screen. Each feature keeps its own copy
 * in features/<feature>/help.ts — written for the people using that screen.
 */
export type PageHelpContent = {
  title: string;
  /** What this screen is for, in one or two sentences. */
  purpose: string;
  /** Where it sits in the business flow (process map stage). */
  stage?: TrainingStageKey;
  /** How to use it, in order. */
  howTo?: string[];
  /** What happens after the work on this screen is done. */
  next?: string;
  mistakes?: string[];
  /** Glossary ids. */
  terms?: string[];
  /** Training step that practises this screen. */
  trainingStep?: string;
  tour?: PageTour;
};

const TOUR_OFFER_DELAY_MS = 1200;

/** "Help" button for a page header: opens the Help panel and runs the tour. */
export function PageHelp({ content }: { content: PageHelpContent }) {
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const { data: me } = useTrainingMe();
  const { mutate } = useStepProgress();
  const offered = useRef(false);

  const tour = content.tour;
  const tourStepKey = tour ? `tour.${tour.key}` : null;
  const tourSeen =
    !tourStepKey || !me || me.progress.some((entry) => entry.stepKey === tourStepKey);

  // First visit: offer the tour once the page's parts have rendered.
  useEffect(() => {
    if (!tour || !tourStepKey || tourSeen || offered.current) return;
    const timer = setTimeout(() => {
      const ready = tour.steps.some((step) => document.querySelector(step.target));
      if (!ready) return;
      offered.current = true;
      toast(`New to ${content.title}?`, {
        description: "Take a one-minute tour of the main parts of this screen.",
        duration: 20_000,
        action: { label: "Show me", onClick: () => setTouring(true) },
        cancel: {
          label: "No thanks",
          onClick: () => mutate({ stepKey: tourStepKey, status: "SKIPPED" }),
        },
      });
    }, TOUR_OFFER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tour, tourStepKey, tourSeen, content.title, mutate]);

  const closeTour = (reason: TourCloseReason) => {
    setTouring(false);
    if (!tourStepKey || reason === "unavailable") return;
    mutate({ stepKey: tourStepKey, status: reason === "finished" ? "DONE" : "SKIPPED" });
  };

  const stage = content.stage ? STAGE_BY_KEY.get(content.stage) : undefined;
  const before = stage ? previousStages(stage.key) : [];
  const after = stage
    ? stage.next.map((key) => STAGE_BY_KEY.get(key)).filter((s) => s !== undefined)
    : [];
  const practiceTrack =
    content.trainingStep && me
      ? me.tracks.find((view) => view.stepKeys.includes(content.trainingStep!))
      : undefined;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconHelpCircle className="size-4" aria-hidden />
        Help
      </Button>

      <HelpSheet
        open={open}
        onOpenChange={setOpen}
        title={content.title}
        description={content.purpose}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {tour ? (
              <Button
                onClick={() => {
                  setOpen(false);
                  // Let the panel close before the tour dims the page.
                  setTimeout(() => setTouring(true), 300);
                }}
              >
                <IconPlayerPlay className="size-4" aria-hidden />
                Take the guided tour
              </Button>
            ) : null}
          </>
        }
      >
        {stage ? (
          <HelpSection title="Where this fits in the business" icon={<IconRoute className="size-4" />}>
            <p>
              This screen is the step <span className="font-medium">{stage.title}</span>.{" "}
              {stage.summary}
            </p>
            {before.length > 0 ? (
              <p className="text-muted-foreground">
                Before it: {before.map((s) => s.title).join(", ")}.
              </p>
            ) : null}
            {after.length > 0 ? (
              <p className="text-muted-foreground">
                After it: {after.map((s) => s!.title).join(", ")}.
              </p>
            ) : null}
            <Link
              href="/training/process-map"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              See it on the process map
            </Link>
          </HelpSection>
        ) : null}

        {content.howTo && content.howTo.length > 0 ? (
          <HelpSection title="How to use it">
            <ol className="list-decimal space-y-1.5 pl-5">
              {content.howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </HelpSection>
        ) : null}

        {content.next ? (
          <HelpSection title="What happens next">
            <p>{content.next}</p>
          </HelpSection>
        ) : null}

        {content.mistakes && content.mistakes.length > 0 ? (
          <HelpSection title="Common mistakes" icon={<IconAlertTriangle className="size-4" />}>
            <ul className="list-disc space-y-1.5 pl-5">
              {content.mistakes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </HelpSection>
        ) : null}

        {content.terms && content.terms.length > 0 ? (
          <HelpSection title="Words used here">
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {content.terms.map((id) => (
                <Term key={id} id={id} />
              ))}
            </p>
            <p className="text-xs text-muted-foreground">Click a word to see what it means.</p>
          </HelpSection>
        ) : null}

        {practiceTrack ? (
          <HelpSection title="Practise it" icon={<IconSchool className="size-4" />}>
            <Link
              href={`/training/${practiceTrack.key}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open your training: {TRACK_BY_KEY.get(practiceTrack.key)?.title}
            </Link>
          </HelpSection>
        ) : null}
      </HelpSheet>

      {tour ? <Tour steps={tour.steps} open={touring} onClose={closeTour} /> : null}
    </>
  );
}
