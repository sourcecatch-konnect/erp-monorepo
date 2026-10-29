"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  IconHeadphones,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  jumpLine,
  pausePlayback,
  resumePlayback,
  setPlaybackRate,
  stopPlayback,
  useTrainingPlayer,
} from "./player";
import { VOICE_RATES, setVoiceRate, useVoicePrefs } from "./prefs";

/**
 * The player, while something is being read aloud.
 *
 * It exists for three reasons the play button cannot cover. A reader who has
 * scrolled past the button they pressed has no way to stop the voice. A
 * passage being spoken line by line should show the line, because a poor
 * device voice is followable when the words are on screen and guesswork when
 * they are not — and when there is no voice for the language at all, those
 * same captions are the whole feature rather than a fallback. And speed is
 * something people change *while* listening, not before.
 *
 * Mounted once, in the dashboard layout. It renders nothing until a clip
 * plays, so it costs an idle subscription and no space.
 */
export function VoicePlayer() {
  const pathname = usePathname();
  const { enabled, rate } = useVoicePrefs();
  const { clip, index, status, queued, mode, error } = useTrainingPlayer();

  /*
   * Changing screen stops the voice. This lives here, once, rather than in
   * each play button: a button unmounts when a list is filtered or a panel
   * closes, and stopping then would cut off a passage mid-sentence.
   */
  useEffect(() => {
    stopPlayback();
  }, [pathname]);

  if (!enabled || !clip || status === "idle") return null;

  const line = clip.lines[index] ?? "";
  const total = clip.lines.length;

  return (
    <div
      role="region"
      aria-label="Reading aloud"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-border bg-card p-3 shadow-lg md:left-auto md:right-4 md:translate-x-0"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconHeadphones className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            Reading aloud · {index + 1}/{total}
            {queued > 0 ? ` · ${queued} more` : ""}
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {clip.title}
          </p>
        </div>
        <button
          type="button"
          onClick={stopPlayback}
          aria-label="Stop reading"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <IconX className="size-4" aria-hidden />
        </button>
      </div>

      {/* The line being spoken. `aria-live` is deliberately off: a screen
          reader is already reading the page, and announcing each line would
          talk over it. */}
      <p
        aria-live="off"
        className="mt-2 min-h-[2.75em] text-sm leading-relaxed text-foreground"
      >
        {line}
      </p>

      <div
        aria-hidden
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => jumpLine(-1)}
          disabled={index === 0}
          aria-label="Previous line"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
        >
          <IconPlayerSkipBackFilled className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={status === "playing" ? pausePlayback : resumePlayback}
          aria-label={status === "playing" ? "Pause" : "Play"}
          className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          {status === "playing" ? (
            <IconPlayerPauseFilled className="size-4" aria-hidden />
          ) : (
            <IconPlayerPlayFilled className="size-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => jumpLine(1)}
          disabled={index >= total - 1 && queued === 0}
          aria-label="Next line"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
        >
          <IconPlayerSkipForwardFilled className="size-4" aria-hidden />
        </button>

        <div
          role="group"
          aria-label="Reading speed"
          className="ms-auto inline-flex overflow-hidden rounded-lg border border-border"
        >
          {VOICE_RATES.map((option) => {
            const on = option.rate === rate;
            return (
              <button
                key={option.rate}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setVoiceRate(option.rate);
                  // Takes effect on the current line rather than the next
                  // passage — the reason someone reaches for it is that
                  // *this* one is too fast.
                  setPlaybackRate(option.rate);
                }}
                className={cn(
                  "border-s px-2 py-1 text-xs font-medium transition-colors duration-150 first:border-s-0",
                  on
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Why nothing is being spoken, where the reader is already looking. */}
      {mode === "captions" && error ? (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
