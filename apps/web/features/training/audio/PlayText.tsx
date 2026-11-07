"use client";

import { IconPlayerPauseFilled, IconVolume } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTrainingLanguage } from "../i18n";
import { playKey, toggle, useTrainingPlayer } from "./player";
import { useVoicePrefs, voiceRate } from "./prefs";

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
  title,
  className,
}: {
  /** The content id, e.g. `glossary.lr.meaning`. Names the audio file too. */
  id: string;
  /** The text as rendered — already translated if the reader is in Hindi. */
  text: string;
  label?: string;
  /** Shown in the player while this plays. Defaults to the label. */
  title?: string;
  className?: string;
}) {
  const lang = useTrainingLanguage();
  const { enabled } = useVoicePrefs();
  const { playing, error } = useTrainingPlayer();
  const active = playing === playKey(id, lang);

  /*
   * Deliberately no stop-on-unmount here. These buttons unmount whenever a
   * list is filtered or a panel closes, and one of them stopping playback
   * would cut off a passage the reader is still listening to. Stopping when
   * the screen changes is the player's job — see VoicePlayer.
   */

  /*
   * Read-aloud off means the button is gone, not disabled. A page can carry
   * forty of these, and forty dead buttons are more in the way than none.
   * Switching it back on is one control, in the training nav.
   */
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => toggle(id, text, lang, voiceRate(), title ?? label)}
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
  const { enabled } = useVoicePrefs();
  const { error } = useTrainingPlayer();
  if (!enabled || !error) return null;

  return (
    <p
      role="status"
      className="rounded-lg border border-warning/35 bg-warning/8 px-3 py-2 text-sm text-foreground"
    >
      {error}
    </p>
  );
}
