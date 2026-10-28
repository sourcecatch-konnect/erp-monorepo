"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FEEDBACK_MAX_VOICE_BYTES,
  FEEDBACK_MAX_VOICE_SECONDS,
  type FeedbackVoiceMime,
} from "@skerp/validators";
import type { VoiceNote } from "./files";

/**
 * One voice note, recorded in the browser with MediaRecorder.
 *
 * - The microphone is asked for only when Record is pressed.
 * - The finished Blob gets the base type ("audio/webm", not
 *   "audio/webm;codecs=opus"): the presigned upload URL is signed for it.
 * - Length comes from our own timer — Chrome's WebM files carry no duration.
 * - Recording stops at the 3-minute limit, when the tab is hidden (iOS cuts
 *   the mic anyway) and on unmount; what was recorded is kept.
 * - The MediaStream tracks are always stopped, so the browser's microphone
 *   indicator turns off.
 */

export type VoiceSupport = { ok: true } | { ok: false; reason: string };

export function voiceSupport(): VoiceSupport {
  if (typeof window === "undefined") return { ok: false, reason: "" };
  if (!window.isSecureContext) {
    return { ok: false, reason: "Voice recording only works on a secure (https) address." };
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return { ok: false, reason: "This browser can't record voice. Try Chrome, Edge or Safari." };
  }
  return { ok: true };
}

const CANDIDATES: [string, FeedbackVoiceMime][] = [
  ["audio/webm;codecs=opus", "audio/webm"],
  ["audio/webm", "audio/webm"],
  ["audio/mp4", "audio/mp4"],
  ["audio/ogg;codecs=opus", "audio/ogg"],
];

function pickVoiceMime(): { recorderType: string; base: FeedbackVoiceMime } | null {
  for (const [recorderType, base] of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(recorderType)) return { recorderType, base };
  }
  return null;
}

const microphoneError = (error: unknown): string => {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Your microphone is blocked. Allow it from the icon next to the address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "We couldn't find a microphone on this device.";
  }
  if (name === "NotReadableError") {
    return "Another app is using your microphone. Close it and try again.";
  }
  return "We couldn't start the recording. Please try again.";
};

export type RecorderState =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "recording"; seconds: number; level: number }
  | { phase: "error"; message: string };

export function useVoiceRecorder(onRecorded: (note: VoiceNote) => void) {
  const [state, setState] = useState<RecorderState>({ phase: "idle" });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mounted = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    const support = voiceSupport();
    if (!support.ok) {
      setState({ phase: "error", message: support.reason });
      return;
    }
    const type = pickVoiceMime();
    if (!type) {
      setState({ phase: "error", message: "This browser can't record voice. Try Chrome, Edge or Safari." });
      return;
    }

    setState({ phase: "requesting" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setState({ phase: "error", message: microphoneError(error) });
      return;
    }
    // The panel closed while the browser was asking for the microphone.
    if (!mounted.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: type.recorderType,
      audioBitsPerSecond: 64_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    // Live level so people can see the microphone hears them. Optional.
    let audio: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      audio = new AudioContext();
      analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(stream).connect(analyser);
    } catch {
      audio = null;
      analyser = null;
    }
    const samples = analyser ? new Uint8Array(analyser.fftSize) : null;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      let level = 0;
      if (analyser && samples) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
      }
      setState({ phase: "recording", seconds, level });
      if (seconds >= FEEDBACK_MAX_VOICE_SECONDS) stop();
    }, 100);

    recorder.onstop = () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      void audio?.close().catch(() => undefined);
      recorderRef.current = null;

      const blob = new Blob(chunks, { type: type.base });
      const durationSec = Math.min(
        FEEDBACK_MAX_VOICE_SECONDS,
        Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      );
      if (blob.size === 0) {
        setState({ phase: "error", message: "Nothing was recorded. Please try again." });
        return;
      }
      if (blob.size > FEEDBACK_MAX_VOICE_BYTES) {
        setState({ phase: "error", message: "The recording is too large. Please record a shorter one." });
        return;
      }
      setState({ phase: "idle" });
      onRecordedRef.current({
        id: crypto.randomUUID(),
        blob,
        url: URL.createObjectURL(blob),
        mime: type.base,
        durationSec,
      });
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    setState({ phase: "recording", seconds: 0, level: 0 });
  }, [stop]);

  // iOS stops the microphone in the background; stop cleanly and keep what we have.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stop]);

  // Closing the panel mid-recording keeps the recording (onRecorded still fires).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, [stop]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, start, stop, reset };
}
