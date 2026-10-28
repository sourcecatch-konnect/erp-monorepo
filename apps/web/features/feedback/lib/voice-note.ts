import {
  FEEDBACK_MAX_VOICE_BYTES,
  FEEDBACK_MAX_VOICE_SECONDS,
  FEEDBACK_VOICE_MIMES,
} from "@skerp/validators";

/**
 * Recording a spoken report in the browser.
 *
 * Nothing here talks to the network: a recording is held in memory like a
 * screenshot and uploaded only once the feedback row exists, so a failed
 * upload can never lose the written report.
 */

/** A recording waiting to be sent with the feedback. */
export type VoiceNote = {
  id: string;
  blob: Blob;
  /** Object URL for the preview player; revoke with releaseVoiceNote. */
  url: string;
  /** Whole seconds, as the server stores it in the file name. */
  durationSeconds: number;
  /** Bare type, no `;codecs=…` — the server's allowlist holds bare types. */
  mime: (typeof FEEDBACK_VOICE_MIMES)[number];
};

export const releaseVoiceNote = (note: VoiceNote) =>
  URL.revokeObjectURL(note.url);

/**
 * MediaRecorder reports `audio/webm;codecs=opus`, but the attachment
 * allowlist and the S3 content type are bare types, so the parameter is
 * dropped. An unrecognised type is reported rather than guessed, because a
 * wrong content type makes the stored file unplayable later.
 */
const bareMime = (raw: string): (typeof FEEDBACK_VOICE_MIMES)[number] => {
  const bare = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  const known = FEEDBACK_VOICE_MIMES.find((mime) => mime === bare);
  if (!known) {
    throw new Error(
      "This browser records audio in a format we can't store yet.",
    );
  }
  return known;
};

/** The first type this browser will actually record. Safari only does mp4. */
const pickMime = (): string | undefined => {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime));
};

export const canRecordVoice = (): boolean =>
  typeof MediaRecorder !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

export type VoiceRecording = {
  /** Resolves with the finished note, or null if it was discarded. */
  stop: () => Promise<VoiceNote | null>;
  /** Throw the recording away and release the microphone. */
  cancel: () => void;
};

/**
 * Starts recording and resolves once the microphone is live, so the UI only
 * shows "recording" when it really is.
 *
 * The caller must always reach `stop()` or `cancel()`: both release the
 * microphone, and a track left open keeps the browser's recording indicator
 * on, which users read as the app listening to them.
 */
export async function startVoiceRecording(
  onTick?: (seconds: number) => void,
): Promise<VoiceRecording> {
  if (!canRecordVoice()) {
    throw new Error("This browser can't record audio.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // Denied, dismissed, or no microphone — the user can't tell these apart
    // and the fix is the same either way.
    throw new Error(
      "We need permission to use your microphone. Allow it in your browser, then try again.",
    );
  }

  const release = () => stream.getTracks().forEach((track) => track.stop());

  const mimeType = pickMime();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    release();
    throw new Error("This browser can't record audio.");
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const startedAt = Date.now();
  const elapsed = () => Math.round((Date.now() - startedAt) / 1000);

  let settled = false;
  const timer = window.setInterval(() => {
    const seconds = elapsed();
    onTick?.(seconds);
    // Stop ourselves at the limit rather than let the user record a note the
    // server will reject.
    if (
      seconds >= FEEDBACK_MAX_VOICE_SECONDS &&
      recorder.state === "recording"
    ) {
      recorder.stop();
    }
  }, 250);

  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearInterval(timer);
    release();
  };

  const stop = () =>
    new Promise<VoiceNote | null>((resolve, reject) => {
      if (recorder.state === "inactive") {
        finish();
        resolve(null);
        return;
      }
      // Read the duration before `onstop`, which can fire a moment later.
      const durationSeconds = Math.max(1, elapsed());
      recorder.onstop = () => {
        finish();
        try {
          const mime = bareMime(recorder.mimeType || mimeType || "audio/webm");
          const blob = new Blob(chunks, { type: mime });
          if (blob.size === 0) {
            reject(
              new Error(
                "Nothing was recorded. Check your microphone and try again.",
              ),
            );
            return;
          }
          if (blob.size > FEEDBACK_MAX_VOICE_BYTES) {
            reject(
              new Error(
                "That recording is too long to send. Try a shorter one.",
              ),
            );
            return;
          }
          resolve({
            id: crypto.randomUUID(),
            blob,
            url: URL.createObjectURL(blob),
            durationSeconds: Math.min(
              durationSeconds,
              FEEDBACK_MAX_VOICE_SECONDS,
            ),
            mime,
          });
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("We couldn't save that recording."),
          );
        }
      };
      recorder.stop();
    });

  const cancel = () => {
    recorder.onstop = null;
    if (recorder.state !== "inactive") recorder.stop();
    chunks.length = 0;
    finish();
  };

  return { stop, cancel };
}

/** "0:07" / "1:42" — the only place this is formatted. */
export const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
