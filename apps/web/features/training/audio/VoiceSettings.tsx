"use client";

import { IconHeadphones, IconVolume } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { Switch } from "@skerp/ui/components/switch";
import { cn } from "@/lib/utils";
import { useTrainingLanguage } from "../i18n";
import { play, stopPlayback, useTrainingPlayer } from "./player";
import { setVoiceEnabled, useVoicePrefs } from "./prefs";

/**
 * A sample long enough to judge the voice by, in the reader's own language.
 * Spoken through the normal player, so whatever it sounds like here is
 * exactly what the glossary and the stage pages will sound like.
 */
const SAMPLE: Record<"en" | "hi", string> = {
  en: "This is how the training pages will read to you. If this sounds clear, read-aloud is working on this device.",
  hi: "ट्रेनिंग के पेज आपको इसी आवाज़ में पढ़कर सुनाए जाएँगे। अगर यह साफ़ सुनाई दे रहा है, तो इस डिवाइस पर आवाज़ ठीक चल रही है।",
};

/**
 * The one place read-aloud is turned on or off and its speed is set.
 *
 * It lives in the training nav rather than beside the text, because it is a
 * decision a reader makes once — the per-paragraph buttons stay single-purpose
 * (press to listen) instead of growing a speed menu each.
 */
export function VoiceSettings() {
  const lang = useTrainingLanguage();
  const { enabled, rate } = useVoicePrefs();
  const { playing, error } = useTrainingPlayer();
  const testing = playing === `${lang}:voice.sample`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Read-aloud settings"
          className="mb-1.5 gap-1.5"
        >
          <IconHeadphones className="size-4" aria-hidden />
          <span className="text-xs">Read aloud</span>
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              enabled ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Read text aloud</span>
          <Switch
            checked={enabled}
            onCheckedChange={(next) => {
              setVoiceEnabled(next);
              // Turning it off mid-sentence has to actually stop the voice.
              if (!next) stopPlayback();
            }}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Adds a small speaker button next to training text. Nothing ever plays
          on its own — you press it.
        </p>

        {enabled ? (
          <>
            {/* Speed lives in the player, not here: it is changed while
                listening, because the reason someone reaches for it is that
                the passage playing right now is too fast. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-1.5"
              onClick={() =>
                testing
                  ? stopPlayback()
                  : play(
                      "voice.sample",
                      SAMPLE[lang],
                      lang,
                      rate,
                      "Voice check",
                    )
              }
            >
              <IconVolume className="size-4" aria-hidden />
              {testing ? "Stop" : "Test the voice"}
            </Button>

            {/* The test is where a device problem should surface, so the
                reason is shown here rather than only on the page. */}
            {error ? (
              <p
                role="status"
                className="mt-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground"
              >
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
