"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook2,
  IconCheck,
  IconCircleCheck,
  IconExternalLink,
  IconListCheck,
  type Icon,
} from "@tabler/icons-react";
import type { TrainingProgressEntry, TrainingStep } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { LESSON_CONTENT, type LessonContent } from "./content/lessons";
import { TRACK_ICONS } from "./content/track-icons";
import { LessonList, type LessonListItem } from "./components/LessonList";
import { LessonReference } from "./components/LessonReference";
import { ListenAll } from "./audio/ListenAll";
import { VoiceSettings } from "./audio/VoiceSettings";
import { type Clip } from "./audio/player";
import { LanguageToggle } from "./i18n/LanguageToggle";
import { type Translate, useTranslate } from "./i18n";
import { LessonStepper } from "./components/LessonStepper";
import { ProgressRing } from "./components/ProgressRing";
import { QuizPanel } from "./components/QuizPanel";
import {
  useStepProgress,
  useTrainingMe,
  useVerifyTrack,
} from "./hooks/useTraining";
import {
  TRACK_BY_KEY,
  findTrackView,
  progressMap,
  trackProgress,
  type TrackProgress,
} from "./lib/catalog-lookup";

/** A step with no written lesson still reads as one, just a shorter one. */
const fallbackContent = (trackTitle: string): LessonContent => ({
  group: trackTitle,
  icon: IconBook2,
  does: [],
});

/**
 * The lesson as a spoken passage: the opening, then each action in order,
 * then what has to be ready and the one mistake to avoid.
 *
 * One clip per action rather than one for the whole lesson, so the player can
 * show which action is being read and a listener can skip back to just that
 * one. A lesson is where somebody is being taught something new, so this is
 * the screen where listening instead of reading matters most.
 */
const lessonClips = (
  step: TrainingStep,
  content: LessonContent,
  { t, tList, lang }: Translate,
): Clip[] => {
  const key = step.key;
  const title = t(`lesson.${key}.title`, step.title);
  const doTitles = tList(
    `lesson.${key}.do.title`,
    content.does.map((action) => action.title),
  );
  const doDetails = tList(
    `lesson.${key}.do.detail`,
    content.does.map((action) => action.detail),
  );
  const step_ = lang === "hi" ? "स्टेप" : "Step";

  const clips: Clip[] = [
    {
      id: `lesson.${key}.intro`,
      title,
      lines: [
        title,
        t(`lesson.${key}.intro`, content.intro ?? step.summary ?? ""),
      ].filter(Boolean),
    },
    ...content.does.map((action, index) => ({
      id: `lesson.${key}.do.${index}`,
      title: doTitles[index] ?? action.title,
      lines: [
        `${step_} ${index + 1}. ${doTitles[index] ?? action.title}.`,
        doDetails[index] ?? action.detail,
      ],
    })),
  ];

  if (content.needs?.length) {
    clips.push({
      id: `lesson.${key}.needs`,
      title: t("ui.beforeYouStart", "Before you start"),
      lines: [
        t("ui.beforeYouStartSpoken", "Before you start, you need:"),
        ...tList(`lesson.${key}.needs`, content.needs),
      ],
    });
  }
  const warn = t(`lesson.${key}.warn`, content.warn ?? "");
  if (content.warn) {
    clips.push({
      id: `lesson.${key}.warn`,
      title: t("ui.watchOut", "Watch out"),
      lines: [t("ui.watchOutSpoken", "Watch out."), warn],
    });
  }
  return clips;
};

function LessonBody({
  step,
  content,
  index,
  total,
  entry,
}: {
  step: TrainingStep;
  content: LessonContent;
  index: number;
  total: number;
  entry: TrainingProgressEntry | undefined;
}) {
  const LessonIcon: Icon = content.icon;
  const translate = useTranslate();
  const { t, tList } = translate;
  const key = step.key;
  const title = t(`lesson.${key}.title`, step.title);
  const doTitles = tList(
    `lesson.${key}.do.title`,
    content.does.map((action) => action.title),
  );
  const doDetails = tList(
    `lesson.${key}.do.detail`,
    content.does.map((action) => action.detail),
  );

  return (
    <div className="space-y-5 px-5 pb-1 pt-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-tight text-primary">
          {t("ui.lesson", "Lesson")} {index + 1} {t("ui.of", "of")} {total} ·{" "}
          {t(`lesson.group.${content.group}`, content.group)}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LessonIcon className="size-[18px]" aria-hidden />
            </span>
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {/* Read-aloud sits with the lesson it reads, because the lesson
                screen has no training nav to put it in. */}
            <LanguageToggle />
            <ListenAll
              clips={lessonClips(step, content, translate)}
              label={t("ui.listenToLesson", "Listen to this lesson")}
            />
            <VoiceSettings />
            {entry ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                  entry.status === "DONE"
                    ? "border-success/35 bg-success/12 text-success"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {entry.status === "DONE" ? (
                  <>
                    <IconCircleCheck className="size-3.5" aria-hidden />
                    Done
                  </>
                ) : (
                  "Skipped"
                )}
              </span>
            ) : null}
            {step.href ? (
              <Button asChild variant="outline">
                <Link href={step.href}>
                  <IconExternalLink className="size-4" aria-hidden />
                  Open the screen
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <p className="max-w-[66ch] text-sm text-muted-foreground">
          {t(`lesson.${key}.intro`, content.intro ?? step.summary ?? "")}
        </p>
      </div>

      {content.does.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <p className="flex items-center gap-1.5 border-b border-border bg-background px-4 py-2.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
            <IconArrowRight className="size-3.5" aria-hidden />
            {t("ui.doThisInOrder", "Do this, in this order")}
          </p>
          <ol className="px-4 py-4">
            {content.does.map((action, actionIndex) => {
              const ActionIcon: Icon = action.icon;
              const last = actionIndex === content.does.length - 1;
              return (
                <li
                  key={action.title}
                  className={cn("relative flex gap-3.5", last ? null : "pb-5")}
                >
                  {!last ? (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-[15px] top-[34px] w-0.5 bg-border"
                    />
                  ) : null}
                  <span className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <ActionIcon className="size-4" aria-hidden />
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-primary bg-card text-[10px] font-bold text-primary">
                      {actionIndex + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block text-sm font-semibold text-foreground">
                      {doTitles[actionIndex] ?? action.title}
                    </span>
                    <span className="block max-w-[80ch] text-sm text-muted-foreground">
                      {doDetails[actionIndex] ?? action.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-background px-4 py-3">
          <IconListCheck
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            Open the screen, try it once, then come back and mark this lesson
            done.
          </p>
        </div>
      )}

      <LessonReference content={content} stepKey={key} />

      {entry?.completedBy === "SYSTEM" ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconCircleCheck className="size-3.5 text-success" aria-hidden />
          The ERP saw that you have already done this, so it was ticked for you.
        </p>
      ) : null}
    </div>
  );
}

function LessonShell({ progress }: { progress: TrackProgress }) {
  const me = useTrainingMe().data;
  const entries = useMemo(
    () => (me ? progressMap(me) : new Map<string, TrainingProgressEntry>()),
    [me],
  );
  const saveProgress = useStepProgress();

  const lessons = useMemo(
    () =>
      progress.steps.map((step) => ({
        step,
        content:
          LESSON_CONTENT[step.key] ?? fallbackContent(progress.track.title),
      })),
    [progress.steps, progress.track.title],
  );

  const firstOpenIndex = Math.max(
    0,
    progress.steps.findIndex((step) => !entries.has(step.key)),
  );
  const [index, setIndex] = useState(firstOpenIndex);
  const bounded = Math.min(index, Math.max(0, lessons.length - 1));
  const lesson = lessons[bounded];

  if (!lesson) return null;

  const TrackIcon: Icon = TRACK_ICONS[progress.track.key];
  const entry = entries.get(lesson.step.key);
  const busy =
    saveProgress.isPending &&
    saveProgress.variables?.stepKey === lesson.step.key;
  const last = bounded === lessons.length - 1;

  const items: LessonListItem[] = lessons.map(({ step, content }) => {
    const stepEntry = entries.get(step.key);
    return {
      key: step.key,
      title: step.title,
      group: content.group,
      icon: content.icon,
      done: stepEntry?.status === "DONE",
      skipped: stepEntry?.status === "SKIPPED",
    };
  });

  const markDoneAndMove = () => {
    if (!entry)
      saveProgress.mutate({ stepKey: lesson.step.key, status: "DONE" });
    if (!last) setIndex(bounded + 1);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-primary/5 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrackIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              {progress.track.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {progress.finished} of {progress.total} lessons done ·{" "}
              {progress.track.description}
            </p>
          </div>
        </div>
        <ProgressRing
          percent={progress.percent}
          label={`${progress.track.title} progress`}
        />
      </div>

      <div className="grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <LessonList
          items={items}
          currentIndex={bounded}
          finished={progress.finished}
          total={progress.total}
          percent={progress.percent}
          onPick={setIndex}
        />

        <div>
          <LessonStepper
            items={items.map((item) => ({
              key: item.key,
              title: item.title,
              done: item.done,
            }))}
            currentIndex={bounded}
            onPick={setIndex}
          />

          <LessonBody
            step={lesson.step}
            content={lesson.content}
            index={bounded}
            total={lessons.length}
            entry={entry}
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-background px-5 py-3">
            <Button
              variant="outline"
              disabled={bounded === 0}
              onClick={() => setIndex(bounded - 1)}
            >
              <IconArrowLeft className="size-4" aria-hidden />
              Previous
            </Button>

            <span className="text-xs text-muted-foreground">
              Lesson {bounded + 1} of {lessons.length}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {entry ? (
                <>
                  {entry.completedBy === "SELF" ? (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        saveProgress.mutate({
                          stepKey: lesson.step.key,
                          status: null,
                        })
                      }
                    >
                      Undo
                    </Button>
                  ) : null}
                  <Button
                    variant={last ? "outline" : "default"}
                    disabled={last}
                    onClick={() => setIndex(bounded + 1)}
                  >
                    Next lesson
                    <IconArrowRight className="size-4" aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      saveProgress.mutate({
                        stepKey: lesson.step.key,
                        status: "SKIPPED",
                      })
                    }
                  >
                    Skip
                  </Button>
                  <Button disabled={busy} onClick={markDoneAndMove}>
                    <IconCheck className="size-4" aria-hidden />
                    {last ? "Mark done & finish" : "Mark done & next"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A4 — one role track, as lessons: the list beside one lesson at a time. */
export function TrackPage({ trackKey }: { trackKey: string }) {
  const { data: me, isLoading, isError, error } = useTrainingMe();
  const { setLabel } = useBreadcrumbLabels();
  const catalogTrack = TRACK_BY_KEY.get(trackKey);

  useEffect(() => {
    const href = `/training/${trackKey}`;
    setLabel(href, catalogTrack?.title ?? null);
    return () => setLabel(href, null);
  }, [trackKey, catalogTrack?.title, setLabel]);

  const view = me ? findTrackView(me, trackKey) : undefined;
  useVerifyTrack(trackKey, view !== undefined);
  const progress = me && view ? trackProgress(view, progressMap(me)) : null;

  return (
    <div className="w-full space-y-5">
      <Link
        href="/training"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <IconArrowLeft className="size-4" aria-hidden />
        Back to My role &amp; training
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[28rem] w-full" />
        </div>
      ) : null}

      {isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load this training: {error.message}
        </p>
      ) : null}

      {me && !progress ? (
        <div className="rounded-lg border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            This training isn&apos;t part of your role
          </p>
          <p className="text-sm text-muted-foreground">
            Go back to My role &amp; training to see the ones meant for you.
          </p>
        </div>
      ) : null}

      {progress ? (
        <>
          {progress.current === undefined ? (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border border-success/30 px-4 py-3",
                "bg-success/5",
              )}
            >
              <IconCircleCheck
                className="mt-0.5 size-5 shrink-0 text-success"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  You have finished this training
                </p>
                <p className="text-sm text-muted-foreground">
                  Well done. Come back to any lesson whenever you need a
                  reminder.
                </p>
              </div>
            </div>
          ) : null}

          <LessonShell progress={progress} />

          <QuizPanel
            trackKey={progress.track.key}
            primary={progress.current === undefined}
          />
        </>
      ) : null}
    </div>
  );
}
