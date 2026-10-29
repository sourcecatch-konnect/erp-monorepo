"use client";

import { useEffect, useRef, useState } from "react";
import { IconDownload, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { formatVoiceDuration } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";

const SPEEDS = [1, 1.5, 2] as const;

/**
 * Play / pause with our own length label. Chrome's WebM recordings carry no
 * duration, so the native <audio> controls would show 0:00 — the length we
 * stored when recording is used instead.
 */
export function VoicePlayer({
  url,
  durationSec,
  showSpeed = false,
  downloadName,
}: {
  url: string;
  durationSec: number | null;
  /** 1× / 1.5× / 2× buttons (for the team, who listen to many notes). */
  showSpeed?: boolean;
  /** Shows a Download link (also the fallback when a browser can't play the format). */
  downloadName?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rate, setRate] = useState<(typeof SPEEDS)[number]>(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const total = durationSec ?? 0;
  const fraction = total > 0 ? Math.min(1, current / total) : 0;

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      audio.playbackRate = rate;
      await audio.play();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="shrink-0 max-sm:size-11"
          onClick={toggle}
          aria-label={playing ? "Pause voice note" : "Play voice note"}
        >
          {playing ? (
            <IconPlayerPause className="size-4" aria-hidden />
          ) : (
            <IconPlayerPlay className="size-4" aria-hidden />
          )}
        </Button>
        <div className="flex min-w-32 flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${fraction * 100}%` }} />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {formatVoiceDuration(current)}
            {total > 0 ? ` / ${formatVoiceDuration(total)}` : ""}
          </span>
        </div>
        {showSpeed ? (
          <div className="flex gap-1" role="group" aria-label="Playback speed">
            {SPEEDS.map((speed) => (
              <Button
                key={speed}
                type="button"
                size="sm"
                variant={rate === speed ? "secondary" : "ghost"}
                aria-pressed={rate === speed}
                onClick={() => setRate(speed)}
              >
                {speed}×
              </Button>
            ))}
          </div>
        ) : null}
        {downloadName ? (
          <Button asChild type="button" size="sm" variant="ghost">
            <a href={url} download={downloadName}>
              <IconDownload className="size-3.5" aria-hidden />
              Download
            </a>
          </Button>
        ) : null}
      </div>
      {failed ? (
        <p className="text-xs text-muted-foreground">
          This browser can&apos;t play this recording.
          {downloadName ? " Download it to listen." : ""}
        </p>
      ) : null}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onError={() => setFailed(true)}
        className="hidden"
      />
    </div>
  );
}
