"use client";

import { useState } from "react";
import {
  IconMicrophone,
  IconPlayerStopFilled,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { FEEDBACK_MAX_VOICE_SECONDS } from "@skerp/validators";
import { formatVoiceDuration } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import type { VoiceNote } from "../lib/files";
import { useVoiceRecorder, voiceSupport } from "../lib/voice";
import { VoicePlayer } from "./VoicePlayer";

/** "Voice feedback" card: record → listen → re-record or delete. One note per item. */
export function VoiceRecorder({
  note,
  onChange,
}: {
  note: VoiceNote | null;
  /** The sheet owns the note (it survives closing the panel) and frees replaced ones. */
  onChange: (note: VoiceNote | null) => void;
}) {
  const [support] = useState(voiceSupport);
  const { state, start, stop, reset } = useVoiceRecorder(onChange);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Voice feedback</h3>
        <p className="text-xs text-muted-foreground">
          Speak in any language. Up to {FEEDBACK_MAX_VOICE_SECONDS / 60} minutes.
        </p>
      </div>

      {!support.ok ? (
        <p className="text-sm text-muted-foreground">{support.reason}</p>
      ) : note ? (
        <div className="space-y-3">
          <VoicePlayer url={note.url} durationSec={note.durationSec} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="max-sm:h-11"
              onClick={() => {
                onChange(null);
                void start();
              }}
            >
              <IconRefresh className="size-4" aria-hidden />
              Re-record
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="max-sm:h-11"
              onClick={() => onChange(null)}
            >
              <IconTrash className="size-4" aria-hidden />
              Delete
            </Button>
          </div>
        </div>
      ) : state.phase === "recording" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <span className="size-2.5 shrink-0 rounded-full bg-destructive" aria-hidden />
            <span className="text-sm font-medium tabular-nums text-foreground">
              Recording {formatVoiceDuration(state.seconds)} /{" "}
              {formatVoiceDuration(FEEDBACK_MAX_VOICE_SECONDS)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm bg-muted" aria-hidden>
            <div
              className="h-full bg-primary transition-[width] duration-100"
              style={{ width: `${Math.round(state.level * 100)}%` }}
            />
          </div>
          <Button type="button" variant="outline" className="max-sm:h-11" onClick={stop}>
            <IconPlayerStopFilled className="size-4 text-destructive" aria-hidden />
            Stop
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="max-sm:h-11"
            disabled={state.phase === "requesting"}
            onClick={() => {
              reset();
              void start();
            }}
          >
            <IconMicrophone className="size-4" aria-hidden />
            {state.phase === "requesting" ? "Waiting for the microphone…" : "Record voice"}
          </Button>
          {state.phase === "error" ? (
            <p className="text-xs text-destructive" role="alert">
              {state.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
