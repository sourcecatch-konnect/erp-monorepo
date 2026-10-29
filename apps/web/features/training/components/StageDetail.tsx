"use client";

import Link from "next/link";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsSplit,
  IconBook2,
  IconBulb,
  IconCircleCheck,
  IconExternalLink,
  IconEye,
  IconFlag,
  IconListCheck,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react";
import type { TrainingMe, TrainingStageKey } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@skerp/ui/lib/util";
import type { MapSection } from "../content/process-map";
import {
  STAGE_CONTENT,
  STAGE_OUTPUT,
  STAGE_STEPS,
  STAGE_TERMS,
} from "../content/stages";
import { GLOSSARY } from "../content/glossary";
import { PlayText } from "../audio/PlayText";
import { ListenAll } from "../audio/ListenAll";
import { useTranslate } from "../i18n";
import { STAGE_BY_KEY, previousStages } from "../lib/catalog-lookup";
import { TONE_BADGE, sectionTone } from "./SectionRail";
import { Term } from "./Term";

const GLOSSARY_BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

function Block({
  icon: BlockIcon,
  title,
  children,
}: {
  icon: typeof IconFlag;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BlockIcon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Who can act here, and whether that includes you. */
function AccessPill({ owned, canOpen }: { owned: boolean; canOpen: boolean }) {
  if (owned)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
        <IconCircleCheck className="size-3.5" aria-hidden />
        You can do this step
      </span>
    );
  if (canOpen)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        <IconEye className="size-3.5" aria-hidden />
        You can look, not change
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      Another team does this
    </span>
  );
}

/** The row of steps in the chosen part, with the open one ringed. */
function StepStrip({
  stages,
  current,
  me,
  tone,
  onPick,
}: {
  stages: TrainingStageKey[];
  current: TrainingStageKey;
  me: TrainingMe;
  tone: 1 | 2 | 3 | 4 | 5 | 6;
  onPick: (key: TrainingStageKey) => void;
}) {
  return (
    /*
     * One scrolling row at every width, rather than equal columns that squeeze
     * nine cards into slivers on a laptop and a different shape on a phone.
     * Each card keeps a readable width and the row scrolls instead.
     */
    <ol className="flex items-stretch gap-1 overflow-x-auto border-b border-border px-4 pb-4">
      {stages.map((key, index) => {
        const stage = STAGE_BY_KEY.get(key);
        if (!stage) return null;
        const view = me.stages.find((item) => item.key === key);
        const on = key === current;

        return (
          <li key={key} className="flex shrink-0 items-center gap-1">
            {index > 0 ? (
              <IconArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              onClick={() => onPick(key)}
              aria-current={on ? "step" : undefined}
              className={cn(
                "flex h-full w-56 flex-col gap-2 rounded-lg border p-2.5 text-left transition-colors duration-150",
                on
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    TONE_BADGE[tone],
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight text-foreground">
                    {stage.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {stage.summary}
                  </span>
                </span>
              </span>
              {view?.owned ? (
                <span className="inline-flex items-center gap-1 self-start rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <IconCircleCheck className="size-3" aria-hidden />
                  You do this
                </span>
              ) : view?.canOpen ? (
                <span className="inline-flex items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <IconEye className="size-3" aria-hidden />
                  You can look
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Everything about one business step, docked under the map rather than in a
 * drawer over it: what you need first, what happens, and — in its own column —
 * who hands it to you and who you hand it to.
 */
export function StageDetail({
  stageKey,
  section,
  me,
  onOpenStage,
}: {
  stageKey: TrainingStageKey;
  section: MapSection;
  me: TrainingMe;
  onOpenStage: (key: TrainingStageKey) => void;
}) {
  // Before the early return: a hook must run on every render of this
  // component, including the one where the stage is not found.
  const { t, tList } = useTranslate();

  const stage = STAGE_BY_KEY.get(stageKey);
  const view = me.stages.find((item) => item.key === stageKey);
  const content = STAGE_CONTENT[stageKey];
  if (!stage || !view || !content) return null;

  const tone = sectionTone(section.key);
  /*
   * A section's paths are ALTERNATIVES, not one long chain: a load goes by
   * road or by rail, never both. Joining them into one strip would read as a
   * nine-step sequence and teach the flow wrong, so only the path this step
   * belongs to is shown, and the others sit behind tabs.
   */
  const pathIndex = Math.max(
    0,
    section.paths.findIndex((path) => path.stages.includes(stageKey)),
  );
  const path = section.paths[pathIndex];
  const flat = path?.stages ?? [];
  const index = flat.indexOf(stageKey);
  const prev = index > 0 ? flat[index - 1] : previousStages(stageKey)[0]?.key;
  const next =
    index >= 0 && index < flat.length - 1 ? flat[index + 1] : stage.next[0];
  const branched = section.paths.length > 1;

  /* "You" already has its own list above, so don't repeat the user's own role. */
  const others = view.owners.filter((owner) => owner !== me.role.name);
  const steps = STAGE_STEPS[stageKey];
  // Lists are translated whole, so a part-done translation never interleaves.
  const stepTitles = tList(
    `stage.${stageKey}.steps.title`,
    steps.map((item) => item.title),
  );
  const stepDetails = tList(
    `stage.${stageKey}.steps.detail`,
    steps.map((item) => item.detail),
  );
  const needs = tList(`stage.${stageKey}.needs`, content.needs);

  const terms = (STAGE_TERMS[stageKey] ?? [])
    .map((id) => GLOSSARY_BY_ID.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  const jump = (key: TrainingStageKey | undefined, label: string) =>
    key ? (
      <button
        type="button"
        onClick={() => onOpenStage(key)}
        className="text-left text-sm font-medium text-primary hover:underline"
      >
        {STAGE_BY_KEY.get(key)?.title ?? label}
      </button>
    ) : (
      <span className="text-sm text-muted-foreground">{label}</span>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-tight text-primary">
            {section.title}
            {branched && path?.label ? ` · ${path.label}` : ""} · step{" "}
            {index + 1} of {flat.length}
          </p>
          <h2 className="mt-1 flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                TONE_BADGE[tone],
              )}
            >
              <section.icon className="size-[18px]" aria-hidden />
            </span>
            {stage.title}
          </h2>
          <p className="mt-1 max-w-[66ch] text-sm text-muted-foreground">
            {stage.summary}
          </p>
        </div>
        <AccessPill owned={view.owned} canOpen={view.canOpen} />
      </header>

      {branched ? (
        <div className="border-b border-border px-4 pb-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {section.key === "transport"
              ? "A load travels one of these ways — not both. Pick the one you want to follow."
              : "This part does more than one thing. Pick the one you want to follow."}
          </p>
          <div
            role="tablist"
            aria-label={`${section.title} routes`}
            className="flex flex-wrap gap-1.5"
          >
            {section.paths.map((item, itemIndex) => {
              const TabIcon = item.icon;
              const on = itemIndex === pathIndex;
              const first = item.stages[0];
              return (
                <button
                  key={item.label ?? itemIndex}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => first && onOpenStage(first)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {TabIcon ? <TabIcon className="size-4" aria-hidden /> : null}
                  {item.label ?? `Route ${itemIndex + 1}`}
                  <span className="tabular-nums opacity-70">
                    ({item.stages.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <StepStrip
        stages={flat}
        current={stageKey}
        me={me}
        tone={tone}
        onPick={onOpenStage}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5 p-4">
          {/* The whole step in one press: what it is for, then each thing to
              do, in order. The per-block button stays for anyone who wants
              just that paragraph. */}
          <ListenAll
            clips={[
              {
                id: `stage.${stageKey}.explain`,
                title: stage.title,
                lines: [t(`stage.${stageKey}.explain`, content.explain)],
              },
              ...(steps ?? []).map((item, stepIndex) => ({
                id: `stage.${stageKey}.step.${stepIndex}`,
                title: stepTitles[stepIndex] ?? item.title,
                lines: [
                  `Step ${stepIndex + 1}. ${stepTitles[stepIndex] ?? item.title}.`,
                  stepDetails[stepIndex] ?? item.detail,
                ],
              })),
            ]}
            label={`Listen to this whole step`}
            className="w-fit"
          />
          {/* The explanation leads: someone who reads only one thing on this
              panel should read what the step is for, not its prerequisites. */}
          <Block icon={IconListCheck} title="What happens here">
            <div className="mt-2 flex items-start gap-2.5">
              <PlayText
                id={`stage.${stageKey}.explain`}
                text={t(`stage.${stageKey}.explain`, content.explain)}
                label={`Read what happens at ${stage.title} aloud`}
                className="mt-0.5"
              />
              <p className="max-w-[72ch] text-[15px] leading-relaxed text-foreground">
                {t(`stage.${stageKey}.explain`, content.explain)}
              </p>
            </div>
          </Block>

          {/* The explanation says what the step is for; this says what your
              hands do, in order. Without it the panel reads as a definition. */}
          <Block icon={IconArrowRight} title="Do this, in this order">
            <ol className="mt-2.5">
              {steps.map((item, stepIndex) => {
                const last = stepIndex === steps.length - 1;
                return (
                  <li
                    key={item.title}
                    className="relative flex gap-3.5 pb-4 last:pb-0"
                  >
                    {!last ? (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-border"
                      />
                    ) : null}
                    <span className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {stepIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="block text-sm font-semibold text-foreground">
                        {stepTitles[stepIndex] ?? item.title}
                      </span>
                      <span className="block max-w-[72ch] text-sm text-muted-foreground">
                        {stepDetails[stepIndex] ?? item.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Block>

          <Block icon={IconFlag} title="Before you start, you need">
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {needs.map((need) => (
                <li
                  key={need}
                  className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <IconCircleCheck className="size-3" aria-hidden />
                  </span>
                  <span className="text-sm text-foreground">{need}</span>
                </li>
              ))}
            </ul>
          </Block>

          {content.statusFlows && content.statusFlows.length > 0 ? (
            <Block icon={IconRefresh} title="How the status moves">
              <div className="mt-2 space-y-3">
                {content.statusFlows.map((flow) => (
                  <div key={flow.document}>
                    <p className="text-xs font-medium text-muted-foreground">
                      {flow.document}
                    </p>
                    <ol className="mt-1 flex flex-wrap items-center gap-1.5">
                      {flow.steps.map((status, statusIndex) => (
                        <li key={status} className="flex items-center gap-1.5">
                          {statusIndex > 0 ? (
                            <IconArrowRight
                              className="size-3.5 text-muted-foreground"
                              aria-hidden
                            />
                          ) : null}
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              statusIndex === flow.steps.length - 1
                                ? "border-success/35 bg-success/12 text-foreground"
                                : "border-border bg-background text-foreground",
                            )}
                          >
                            {status}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {flow.also ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {flow.also}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Block>
          ) : null}

          {content.tip ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              <IconBulb
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              {t(`stage.${stageKey}.tip`, content.tip)}
            </p>
          ) : null}
        </div>

        <div className="space-y-5 border-t border-border bg-muted/30 p-4 lg:border-l lg:border-t-0">
          {/*
            Drawn as a chain rather than a label/value table: the step above
            hands you something, you make something, you hand it on. That is
            the one thing people come to this panel to understand.
          */}
          <Block icon={IconArrowsSplit} title="Handover">
            <ol className="mt-2.5 space-y-1.5">
              <li className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Comes before</p>
                <div className="mt-0.5">
                  {jump(prev, "Nothing — this starts the chain")}
                </div>
              </li>
              <li
                aria-hidden
                className="flex justify-center text-muted-foreground"
              >
                <IconArrowDown className="size-4" />
              </li>
              <li className="rounded-lg border border-primary/35 bg-primary/5 px-3 py-2">
                <p className="text-xs font-medium text-primary">
                  This step produces
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {t(`stage.${stageKey}.output`, STAGE_OUTPUT[stageKey])}
                </p>
              </li>
              <li
                aria-hidden
                className="flex justify-center text-muted-foreground"
              >
                <IconArrowDown className="size-4" />
              </li>
              <li className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Comes next</p>
                <div className="mt-0.5">
                  {jump(next, "Nothing — the flow ends here")}
                </div>
              </li>
            </ol>
          </Block>

          <Block icon={IconUsers} title="Who does it">
            {view.abilities.length > 0 ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  Here, you can:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {view.abilities.map((ability) => (
                    <li key={ability} className="flex items-start gap-2">
                      <IconCircleCheck
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-sm text-foreground">{ability}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {view.canOpen
                  ? "You can open this screen, but another team does the work."
                  : "Another team does this step."}
              </p>
            )}

            {others.length > 0 ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  {view.owned ? "Also done by" : "Done by"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {others.map((owner) => (
                    <span
                      key={owner}
                      className="rounded-lg border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                    >
                      {owner}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </Block>

          {terms.length > 0 ? (
            <Block icon={IconBook2} title="Words used here">
              <dl className="mt-2 space-y-2">
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
            </Block>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 py-3">
        <Button
          variant="outline"
          disabled={!prev}
          onClick={() => prev && onOpenStage(prev)}
        >
          <IconArrowLeft className="size-4" aria-hidden />
          Previous step
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!next}
            onClick={() => next && onOpenStage(next)}
          >
            Next step
            <IconArrowRight className="size-4" aria-hidden />
          </Button>
          {view.canOpen ? (
            <Button asChild>
              <Link href={stage.href}>
                <IconExternalLink className="size-4" aria-hidden />
                Open the screen
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
