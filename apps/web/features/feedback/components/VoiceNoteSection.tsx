"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  IconMicrophone,
  IconPlayerStopFilled,
  IconTrash,
} from "@tabler/icons-react";
import {
  FEEDBACK_MAX_VOICE_NOTES,
  FEEDBACK_MAX_VOICE_SECONDS,
} from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import {
  canRecordVoice,
  formatDuration,
  releaseVoiceNote,
  startVoiceRecording,
  type VoiceNote,
  type VoiceRecording,
} from "../lib/voice-note";

/**
 * "Say it instead (optional)" — record the report rather than type it.
 *
 * This exists for reach: a driver or branch clerk who cannot write the
 * problem in English can say it in Hindi. The written fields stay required,
 * so the team still has a title to triage on and the voice note carries the
 * detail.
 */
export function VoiceNoteSection({
  notes,
  onNotesChange,
}: {
  notes: VoiceNote[];
  onNotesChange: (notes: VoiceNote[]) => void;
}) {
  const recording = useRef<VoiceRecording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const full = notes.length >= FEEDBACK_MAX_VOICE_NOTES;
  const active = recording.current !== null;

  /*
   * Closing the panel mid-recording must release the microphone, or the
   * browser keeps showing its "recording" indicator and the user reasonably
   * thinks the app is still listening.
   */
  useEffect(
    () => () => {
      recording.current?.cancel();
      recording.current = null;
    },
    [],
  );

  if (!canRecordVoice()) return null;

  const start = async () => {
    if (full || busy || active) return;
    setBusy(true);
    try {
      setSeconds(0);
      recording.current = await startVoiceRecording(setSeconds);
    } catch (error) {
      recording.current = null;
      toast.error(
        error instanceof Error ? error.message : "We couldn't start recording.",
      );
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    setBusy(true);
    try {
      const note = await current.stop();
      if (note) onNotesChange([...notes, note]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't save that recording.",
      );
    } finally {
      setSeconds(0);
      setBusy(false);
    }
  };

  const remove = (note: VoiceNote) => {
    releaseVoiceNote(note);
    onNotesChange(notes.filter((item) => item.id !== note.id));
  };

  const left = FEEDBACK_MAX_VOICE_SECONDS - seconds;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Say it instead (optional)
        </h3>
        <p className="text-xs text-muted-foreground">
          Record the problem in your own words — Hindi is fine. Up to{" "}
          {formatDuration(FEEDBACK_MAX_VOICE_SECONDS)} each.
        </p>
      </div>

      {active ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
          {/* The only pulsing dot in the form: it says "live", not "pretty". */}
          <span
            className="size-2 shrink-0 animate-pulse rounded-full bg-destructive"
            aria-hidden
          />
          <p className="text-sm text-foreground" role="status">
            Recording {formatDuration(seconds)}
            {left <= 15 ? (
              <span className="text-muted-foreground"> — {left}s left</span>
            ) : null}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => void stop()}
          >
            <IconPlayerStopFilled className="size-3.5" aria-hidden />
            Stop
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={full || busy}
          onClick={() => void start()}
        >
          <IconMicrophone className="size-4" aria-hidden />
          {busy ? "Starting…" : "Record a voice note"}
        </Button>
      )}

      {notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((note, index) => (
            <li
              key={note.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Voice note {index + 1} ·{" "}
                  {formatDuration(note.durationSeconds)}
                </p>
                {/* Local object URL — plain <audio> so the reporter can check
                    what they recorded before sending it. */}
                <audio src={note.url} controls className="h-8 w-full" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(note)}
              >
                <IconTrash className="size-3.5" aria-hidden />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
