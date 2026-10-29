"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowRight,
  IconBook2,
  IconHelpCircle,
  IconPlayerPlay,
  IconRoute,
  IconSchool,
} from "@tabler/icons-react";
import type { TrainingStageKey } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { HelpSection, HelpSheet } from "@skerp/ui/components/help-sheet";
import {
  Tour,
  type TourCloseReason,
  type TourStep,
} from "@skerp/ui/components/tour";
import { PlayText } from "../audio/PlayText";
import { playClips, stopPlayback, toLines } from "../audio/player";
import { useVoicePrefs, voiceRate } from "../audio/prefs";
import { type TrainingLanguage, useTrainingLanguage } from "../i18n";
import { useStepProgress, useTrainingMe } from "../hooks/useTraining";
import {
  STAGE_BY_KEY,
  TRACK_BY_KEY,
  previousStages,
} from "../lib/catalog-lookup";
import { GLOSSARY } from "../content/glossary";
import { STAGE_OUTPUT } from "../content/stages";
import { Term } from "./Term";

const GLOSSARY_BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

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
  /**
   * The same explanation in Hindi, kept here beside the English rather than
   * in the training dictionary: one source per screen, edited by whoever
   * edits the English, and a missing translation is visible in review.
   *
   * Until a screen has it, read-aloud hides itself in Hindi instead of
   * speaking English at a reader who chose हिंदी — the silent fallback is
   * worse than no button, because nothing tells them what happened.
   */
  hi?: { purpose: string; howTo?: string[]; next?: string; tour?: string[] };
};

const TOUR_OFFER_DELAY_MS = 1200;

/**
 * The whole screen explanation as one spoken passage: what this screen is
 * for, the steps in order, and what follows.
 *
 * One button for all of it, rather than one per section. Somebody who opened
 * Help wants the screen explained, not a page of speaker icons — and the
 * steps only make sense read in order anyway. Mistakes are left out: a
 * warning should be read, not heard once and forgotten.
 */
const spokenHelp = (
  content: PageHelpContent,
  lang: TrainingLanguage,
): string | null => {
  const source = lang === "hi" ? content.hi : content;
  // No Hindi for this screen yet: say nothing rather than speak English.
  if (!source) return null;

  const parts = [content.title, source.purpose];
  const howTo = source.howTo;
  if (howTo?.length) {
    parts.push(
      lang === "hi" ? "इस क्रम में कीजिये।" : "Do this, in this order.",
    );
    /*
     * Spoken as "Step 1 … Step 2 …", because a digit alone is not heard as a
     * list the way an indented number is read as one.
     */
    howTo.forEach((line, index) =>
      parts.push(
        lang === "hi"
          ? `स्टेप ${index + 1}. ${line}`
          : `Step ${index + 1}. ${line}`,
      ),
    );
  }
  if (source.next) {
    parts.push(
      lang === "hi"
        ? `आगे क्या होता है। ${source.next}`
        : `What happens next. ${source.next}`,
    );
  }
  return parts.join(" ");
};

/** "Help" button for a page header: opens the Help panel and runs the tour. */
export function PageHelp({ content }: { content: PageHelpContent }) {
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const { data: me } = useTrainingMe();
  const { mutate } = useStepProgress();
  const voice = useVoicePrefs();
  const lang = useTrainingLanguage();
  const offered = useRef(false);
  const spoken = spokenHelp(content, lang);

  const tour = content.tour;
  const tourStepKey = tour ? `tour.${tour.key}` : null;
  const tourSeen =
    !tourStepKey ||
    !me ||
    me.progress.some((entry) => entry.stepKey === tourStepKey);

  // First visit: offer the tour once the page's parts have rendered.
  useEffect(() => {
    if (!tour || !tourStepKey || tourSeen || offered.current) return;
    const offerId = `tour-offer-${tourStepKey}`;
    // A panel or dialog (Feedback, Help, a form) opens in the corner the offer
    // sits in, so the offer steps aside instead of covering its buttons.
    const onFocusIn = (event: FocusEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]')
      ) {
        toast.dismiss(offerId);
      }
    };
    const timer = setTimeout(() => {
      const ready = tour.steps.some((step) =>
        document.querySelector(step.target),
      );
      if (!ready) return;
      offered.current = true;
      document.addEventListener("focusin", onFocusIn);
      toast(`New to ${content.title}?`, {
        id: offerId,
        description: "Take a one-minute tour of the main parts of this screen.",
        duration: 20_000,
        action: { label: "Show me", onClick: () => setTouring(true) },
        cancel: {
          label: "No thanks",
          onClick: () => mutate({ stepKey: tourStepKey, status: "SKIPPED" }),
        },
      });
    }, TOUR_OFFER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      // The offer is about this screen; don't carry it to the next one.
      toast.dismiss(offerId);
    };
  }, [tour, tourStepKey, tourSeen, content.title, mutate]);

  const closeTour = (reason: TourCloseReason) => {
    setTouring(false);
    // The tour is the one thing that speaks on its own, so leaving it must
    // also be what stops it.
    stopPlayback();
    if (!tourStepKey || reason === "unavailable") return;
    mutate({
      stepKey: tourStepKey,
      status: reason === "finished" ? "DONE" : "SKIPPED",
    });
  };

  const stage = content.stage ? STAGE_BY_KEY.get(content.stage) : undefined;
  const before = stage ? previousStages(stage.key) : [];
  const after = stage
    ? stage.next
        .map((key) => STAGE_BY_KEY.get(key))
        .filter((s) => s !== undefined)
    : [];
  const terms = (content.terms ?? [])
    .map((id) => GLOSSARY_BY_ID.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  const practiceTrack =
    content.trainingStep && me
      ? me.tracks.find((view) => view.stepKeys.includes(content.trainingStep!))
      : undefined;

  return (
    <>
      {/*
        Tinted rather than another grey outline button: on a toolbar of
        Export / Filter / New, plain "Help" disappears, and the one control
        that explains the screen is the one a new joiner has to find.
      */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
      >
        <IconHelpCircle className="size-4" aria-hidden />
        Help
        {!tourSeen ? (
          <span
            aria-hidden
            className="ml-0.5 size-1.5 rounded-full bg-primary"
            title="There is a guided tour for this screen"
          />
        ) : null}
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
        {/*
          Read-aloud for the whole explanation, at the top where somebody who
          reads slowly will meet it first. It disappears entirely when
          read-aloud is switched off in the training nav.
        */}
        {voice.enabled && spoken ? (
          <div className="flex items-center gap-2.5">
            <PlayText
              id={`help.${content.tour?.key ?? content.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              text={spoken}
              label="Listen to this explanation"
            />
            <span className="text-xs text-muted-foreground">
              Listen to this explanation
            </span>
          </div>
        ) : null}

        {content.howTo && content.howTo.length > 0 ? (
          <HelpSection
            title="Do this, in this order"
            icon={<IconArrowRight className="size-4" />}
          >
            {/* Numbered circles joined by a line, the same shape the training
                lessons use — a bare <ol> read as a paragraph with digits. */}
            <ol className="mt-1">
              {content.howTo.map((line, index) => {
                const last = index === content.howTo!.length - 1;
                return (
                  <li
                    key={line}
                    className="relative flex gap-3.5 pb-4 last:pb-0"
                  >
                    {!last ? (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-border"
                      />
                    ) : null}
                    <span className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 pt-1 text-sm text-foreground">
                      {line}
                    </span>
                  </li>
                );
              })}
            </ol>
          </HelpSection>
        ) : null}

        {stage ? (
          <HelpSection
            title="Where this fits"
            icon={<IconRoute className="size-4" />}
          >
            {/* The handover as a chain: who hands it to you, what you make,
                who picks it up. Same block as the process map's detail panel. */}
            <ol className="space-y-1.5">
              <li className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Comes before</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {before.length > 0
                    ? before.map((s) => s.title).join(", ")
                    : "Nothing — this starts the chain"}
                </p>
              </li>
              <li
                aria-hidden
                className="flex justify-center text-muted-foreground"
              >
                <IconArrowDown className="size-4" />
              </li>
              <li className="rounded-lg border border-primary/35 bg-primary/5 px-3 py-2">
                <p className="text-xs font-medium text-primary">
                  This screen produces
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {STAGE_OUTPUT[stage.key]}
                </p>
              </li>
              <li
                aria-hidden
                className="flex justify-center text-muted-foreground"
              >
                <IconArrowDown className="size-4" />
              </li>
              <li className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Comes next</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {after.length > 0
                    ? after.map((s) => s!.title).join(", ")
                    : "Nothing — the flow ends here"}
                </p>
              </li>
            </ol>
            <Link
              href="/training/process-map"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <IconRoute className="size-4" aria-hidden />
              See it on the process map
            </Link>
          </HelpSection>
        ) : null}

        {content.next ? (
          <HelpSection
            title="What happens next"
            icon={<IconArrowRight className="size-4" />}
          >
            <p className="rounded-lg border border-border bg-background px-3 py-2">
              {content.next}
            </p>
          </HelpSection>
        ) : null}

        {content.mistakes && content.mistakes.length > 0 ? (
          <HelpSection
            title={`Watch out — ${content.mistakes.length} ${
              content.mistakes.length === 1 ? "thing" : "things"
            }`}
            icon={<IconAlertTriangle className="size-4" />}
          >
            {/* Mistakes cost money here, so they get their own tone rather
                than a bullet in the same grey as everything else. */}
            <ul className="space-y-1.5">
              {content.mistakes.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/8 px-3 py-2"
                >
                  <IconAlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-warning"
                    aria-hidden
                  />
                  <span className="text-sm text-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </HelpSection>
        ) : null}

        {terms.length > 0 ? (
          <HelpSection
            title="Words used here"
            icon={<IconBook2 className="size-4" />}
          >
            {/* The meaning, not just a clickable chip: a reader who does not
                already know the word should not have to click to find out. */}
            <dl className="space-y-2">
              {terms.map((entry) => (
                <div key={entry.id}>
                  <dt className="text-sm font-semibold text-foreground">
                    <Term id={entry.id}>{entry.term}</Term>
                    {entry.fullName ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {entry.fullName}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-xs text-muted-foreground">
                    {entry.meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </HelpSection>
        ) : null}

        {practiceTrack ? (
          <HelpSection
            title="Practise it"
            icon={<IconSchool className="size-4" />}
          >
            <Link
              href={`/training/${practiceTrack.key}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open your training: {TRACK_BY_KEY.get(practiceTrack.key)?.title}
            </Link>
          </HelpSection>
        ) : null}
      </HelpSheet>

      {tour ? (
        <Tour
          steps={tour.steps}
          open={touring}
          onClose={closeTour}
          /*
           * The only autoplay in the app. Somebody who pressed "Take the
           * guided tour" asked to be walked through the screen, so each step
           * reads itself; everywhere else the reader presses the button. A
           * step with no Hindi yet stays silent rather than switching to
           * English mid-tour.
           */
          onStepChange={(step, index) => {
            if (!voice.enabled) return;
            const hindi = content.hi?.tour?.[index];
            if (lang === "hi" && !hindi) {
              stopPlayback();
              return;
            }
            const text =
              lang === "hi"
                ? hindi!
                : [
                    step.title,
                    typeof step.content === "string" ? step.content : "",
                  ]
                    .filter(Boolean)
                    .join(". ");
            playClips(
              {
                id: `tour.${tour.key}.${index}`,
                title: step.title,
                lines: toLines(text),
              },
              lang,
              voiceRate(),
            );
          }}
        />
      ) : null}
    </>
  );
}
