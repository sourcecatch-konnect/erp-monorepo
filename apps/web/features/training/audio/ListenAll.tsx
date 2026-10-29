"use client";

import { IconPlayerStopFilled, IconVolume } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTrainingLanguage } from "../i18n";
import {
  type Clip,
  playKey,
  playClips,
  stopPlayback,
  useTrainingPlayer,
} from "./player";
import { useVoicePrefs, voiceRate } from "./prefs";

/**
 * "Listen to all of this" — one press, then a list of passages plays through,
 * with the player showing which one it is on.
 *
 * This is the point of a queue. A reader working through a glossary or a
 * lesson should not have to find and press a button every six seconds; and
 * when they have filtered the list down to one area, "all" means that area,
 * not everything.
 */
export function ListenAll({
  clips,
  label = "Listen to all",
  className,
}: {
  /** In the order they should play. Pass the filtered list, not the full one. */
  clips: Clip[];
  label?: string;
  className?: string;
}) {
  const lang = useTrainingLanguage();
  const { enabled } = useVoicePrefs();
  const { playing } = useTrainingPlayer();
  const first = clips[0];

  // Nothing to read, or read-aloud is off: no control at all.
  if (!enabled || !first) return null;

  /*
   * Active while anything in this list is the current clip, not just the
   * first — otherwise the button reverts to "Listen" one line in, while the
   * voice is still working through the queue.
   */
  const active = clips.some((clip) => playing === playKey(clip.id, lang));

  return (
    <button
      type="button"
      onClick={() =>
        active ? stopPlayback() : playClips(clips, lang, voiceRate())
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
        className,
      )}
    >
      {active ? (
        <IconPlayerStopFilled className="size-3.5" aria-hidden />
      ) : (
        <IconVolume className="size-4" aria-hidden />
      )}
      {active ? "Stop" : label}
    </button>
  );
}
