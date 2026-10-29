"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Button } from "./button";

/**
 * Step-by-step spotlight tour over a real screen.
 *
 * Each step points at an element by CSS selector — use `data-tour="…"`
 * attributes, never styling classes, so restyling a page can't break a tour.
 * Steps whose element isn't on the page (hidden by permissions, a different
 * form mode…) are skipped. Esc closes; ← / → move between steps.
 */

export type TourStep = {
  /** e.g. '[data-tour="lr-lines"]' */
  target: string;
  title: string;
  content: React.ReactNode;
};

export type TourCloseReason = "finished" | "dismissed" | "unavailable";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const GAP = 12;
const CARD_WIDTH = 320;

const findTarget = (selector: string): HTMLElement | null => {
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Tour({
  steps,
  open,
  onClose,
  onStepChange,
  labels = {},
}: {
  steps: TourStep[];
  open: boolean;
  onClose: (reason: TourCloseReason) => void;
  /**
   * The step now showing, each time it changes, including the first. Steps
   * missing from the page are skipped before this fires, so `index` counts
   * the steps actually being shown rather than the ones passed in.
   *
   * Added for read-aloud: a tour is the one place where speaking without
   * being asked is right, because the reader opted into being walked through
   * the screen.
   */
  onStepChange?: (step: TourStep, index: number) => void;
  labels?: Partial<
    Record<"next" | "back" | "done" | "close" | "stepOf", string>
  >;
}) {
  const [available, setAvailable] = React.useState<TourStep[]>([]);
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = React.useState(180);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const nextRef = React.useRef<HTMLButtonElement | null>(null);
  const titleId = React.useId();

  // Work out which steps exist on this page when the tour opens.
  React.useEffect(() => {
    if (!open) return;
    const present = steps.filter((step) => findTarget(step.target));
    setIndex(0);
    setAvailable(present);
    if (present.length === 0) onClose("unavailable");
    // onClose is a callback prop; only re-run when the tour (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, steps]);

  const step = open ? available[index] : undefined;

  // Bring the target into view, then follow it (scrolling, resizing).
  React.useEffect(() => {
    if (!step) return;
    const target = findTarget(step.target);
    target?.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    let frame = 0;
    const track = () => {
      const el = findTarget(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      }
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    nextRef.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  React.useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step, rect]);

  /*
   * Keyed on the step, not on the callback: a caller passing an inline
   * function would otherwise make the tour re-announce the same step on
   * every render.
   */
  const announce = React.useRef(onStepChange);
  announce.current = onStepChange;
  React.useEffect(() => {
    if (step) announce.current?.(step, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const last = index >= available.length - 1;
  const goNext = React.useCallback(() => {
    if (last) onClose("finished");
    else setIndex((i) => i + 1);
  }, [last, onClose]);
  const goBack = React.useCallback(
    () => setIndex((i) => Math.max(0, i - 1)),
    [],
  );

  React.useEffect(() => {
    if (!step) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose("dismissed");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, goNext, goBack, onClose]);

  if (!step || !rect || typeof document === "undefined") return null;

  // Card below the target if it fits, otherwise above; kept on screen.
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const below = rect.top + rect.height + PAD + GAP;
  const top =
    below + cardHeight <= viewportH - 8
      ? below
      : Math.max(8, rect.top - PAD - GAP - cardHeight);
  const width = Math.min(CARD_WIDTH, viewportW - 16);
  const left = Math.min(Math.max(8, rect.left), viewportW - width - 8);

  return createPortal(
    <div data-slot="tour" className="fixed inset-0 z-[60]">
      {/* Blocks clicks on the page while the tour is open. */}
      <div className="absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-lg ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow:
            "0 0 0 9999px color-mix(in oklch, var(--foreground) 35%, transparent)",
        }}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed space-y-2 rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-md"
        style={{ top, left, width }}
      >
        <p className="text-xs font-medium text-muted-foreground">
          {(labels.stepOf ?? "Step {n} of {total}")
            .replace("{n}", String(index + 1))
            .replace("{total}", String(available.length))}
        </p>
        <p id={titleId} className="text-sm font-semibold text-foreground">
          {step.title}
        </p>
        <div className="text-sm text-muted-foreground">{step.content}</div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClose("dismissed")}
          >
            {labels.close ?? "Close tour"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={goBack}
            >
              {labels.back ?? "Back"}
            </Button>
            <Button ref={nextRef} size="sm" onClick={goNext}>
              {last ? (labels.done ?? "Done") : (labels.next ?? "Next")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { Tour };
