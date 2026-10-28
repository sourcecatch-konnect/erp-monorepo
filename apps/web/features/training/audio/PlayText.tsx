"use client";

import { useEffect } from "react";
import { IconPlayerPauseFilled, IconVolume } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTrainingLanguage } from "../i18n";
import { playKey, stopPlayback, toggle, useTrainingPlayer } from "./player";

/**
 * "Read this aloud" beside a piece of training text.
 *
 * It plays whatever is on screen: the same `id` and the same already-resolved
 * `text` the reader can see, so the audio can never say something different
 * from the words beside it. The language comes from the training toggle.
 */
export function PlayText({
  id,
  text,
  label = "Read aloud",
  className,
}: {
  /** The content id, e.g. `glossary.lr.meaning`. Names the audio file too. */
  id: string;
  /** The text as rendered — already translated if the reader is in Hindi. */
  text: string;
  label?: string;
  className?: string;
}) {
  const lang = useTrainingLanguage();
  const { playing, error } = useTrainingPlayer();
  const active = playing === playKey(id, lang);

  // Leaving the screen should not leave a voice talking over the next one.
  useEffect(() => () => stopPlayback(), []);

  return (
    <button
      type="button"
      onClick={() => toggle(id, text, lang)}
      aria-label={active ? "Stop reading" : label}
      title={active ? "Stop reading" : label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
        className,
      )}
    >
      {active ? (
        <IconPlayerPauseFilled className="size-3.5" aria-hidden />
      ) : (
        <IconVolume className="size-4" aria-hidden />
      )}
      {/* The failure is announced once, where the reader pressed, rather than
          as a toast that could appear anywhere on the page. */}
      {active && error ? <span className="sr-only">{error}</span> : null}
    </button>
  );
}

/**
 * The one place a playback failure is shown in words — a device with no Hindi
 * voice, or a browser that cannot speak at all. Mount it once per screen,
 * near the language toggle.
 */
export function PlaybackNotice() {
  const { error } = useTrainingPlayer();
  if (!error) return null;

  return (
    <p
      role="status"
      className="rounded-lg border border-warning/35 bg-warning/8 px-3 py-2 text-sm text-foreground"
    >
      {error}
    </p>
  );
}
