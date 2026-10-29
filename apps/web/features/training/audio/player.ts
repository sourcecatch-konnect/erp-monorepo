"use client";

import { useSyncExternalStore } from "react";
import type { TrainingLanguage } from "../i18n";

/**
 * One player for the whole app's read-aloud.
 *
 * Three things are being guarded here. First, only one thing may ever speak at
 * once — two overlapping voices are unusable, and a page can hold forty play
 * buttons. Second, playback has two possible sources and the caller should
 * not have to care which:
 *
 *   1. A pre-generated file at /audio/<lang>/<id>.mp3, written by
 *      scripts/generate-training-audio.mjs. Consistent for everyone.
 *   2. The browser's own speechSynthesis, used when that file does not exist
 *      yet. Quality depends on the device, but it means new content is never
 *      silent.
 *
 * Third — and this is why a clip is a list of lines rather than one string —
 * a passage plays line after line without the reader pressing anything again.
 * Pressing once per paragraph is not listening to an explanation, it is
 * operating a machine. One line at a time also means the player can show the
 * line being spoken, which is what makes it usable on a device whose voice is
 * poor, and what keeps the content readable on a device that cannot speak at
 * all.
 *
 * No API key and no backend: the files are static, and speechSynthesis is
 * built into the browser.
 */

/**
 * One passage: a title for the player, and the lines to speak in order.
 *
 * A line should be a whole sentence. Lines are the unit of pausing, skipping
 * and captioning, so splitting mid-sentence makes all three awkward.
 */
export type Clip = {
  /** Content id, e.g. `glossary.lr.meaning`. Names the audio file too. */
  id: string;
  /** Shown in the player while this clip plays. */
  title: string;
  lines: string[];
};

export type PlayerState = {
  /**
   * The current clip's key, as `<lang>:<id>`, or null. The language is part of
   * this key so that switching language while something plays does not leave
   * a button looking active for the other language's audio. It is NOT part of
   * the file path — see `playKey` and `lineSource`.
   */
  playing: string | null;
  status: "idle" | "playing" | "paused";
  /** The clip being spoken, for the player's title and captions. */
  clip: Clip | null;
  /** Which line of `clip` is current. */
  index: number;
  /** How many clips are waiting behind this one. */
  queued: number;
  /**
   * `captions` means nothing is actually being spoken — no voice for this
   * language, or no speech support at all — and the lines are advancing on a
   * timer so the passage can still be read through.
   */
  mode: "voice" | "captions";
  /** Set when the last attempt could not speak. The lines still advance. */
  error: string | null;
};

/** The key a button compares against `playing`. */
export const playKey = (id: string, lang: TrainingLanguage) => `${lang}:${id}`;

/** A one-line clip, for a single sentence or short paragraph. */
export const oneLine = (id: string, title: string, text: string): Clip => ({
  id,
  title,
  lines: [text],
});

/**
 * Splits a passage into speakable lines on sentence ends.
 *
 * Devanagari uses "।" rather than a full stop, so both end a line. Anything
 * without punctuation comes back as a single line rather than being cut at a
 * guessed length — a wrong split is heard, and sounds like a stammer.
 */
export const toLines = (text: string): string[] => {
  const parts = text
    .split(/(?<=[.!?।])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
};

const IDLE: PlayerState = {
  playing: null,
  status: "idle",
  clip: null,
  index: 0,
  queued: 0,
  mode: "voice",
  error: null,
};

let state: PlayerState = IDLE;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const set = (next: Partial<PlayerState>) => {
  state = { ...state, ...next };
  emit();
};

let audio: HTMLAudioElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Clips waiting behind the current one, and the settings they play under. */
let queue: Clip[] = [];
let currentLang: TrainingLanguage = "en";
let currentRate = 1;

/*
 * Which request is current. Starting, stopping or stepping bumps it, and every
 * step that resumes after an `await` checks it before touching the engine.
 *
 * This is needed because the fallback path is asynchronous: `voicesReady()`
 * can wait up to 1200ms for the voice list, and a reader who presses the
 * button again in that window expects silence. Without this check `speak()`
 * resumes afterwards and starts talking over a button that reads "play" —
 * `stopPlayback()` cannot help, because at that point nothing is queued yet
 * for it to cancel.
 */
let generation = 0;

/** Silences the engine without touching what the player is showing. */
const silence = () => {
  generation += 1;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Not every environment has it; nothing to stop then.
  }
};

/**
 * Stops whatever is speaking and clears the player.
 *
 * `error` deliberately survives: the reason a passage was shown rather than
 * spoken still has to be readable once the passage has finished and the
 * player has gone. Starting anything new clears it.
 */
export const stopPlayback = () => {
  silence();
  queue = [];
  if (state.status !== "idle") set({ ...IDLE, error: state.error });
};

/**
 * Voices load asynchronously in most browsers, so the first call can see an
 * empty list. Resolving on `voiceschanged` avoids reporting "no Hindi voice"
 * before the list has arrived.
 */
const voicesReady = (): Promise<SpeechSynthesisVoice[]> =>
  new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve([]);
    const have = synth.getVoices();
    if (have.length > 0) return resolve(have);
    const onChange = () => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onChange);
    // Some browsers never fire it; do not hang the button.
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    }, 1200);
  });

const BCP47: Record<TrainingLanguage, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

const NO_HINDI_VOICE =
  "This device has no Hindi voice installed yet, so the words are shown without being spoken. On Android: Settings → Text-to-speech → Google → install Hindi. On Windows: Settings → Time & language → Speech → add Hindi.";

const NO_SPEECH =
  "This browser cannot read text aloud, so the words are shown without being spoken.";

/** How long a line stays on screen when it is only being shown, not spoken. */
const captionMs = (line: string) =>
  Math.max(2200, (line.length * 70) / currentRate);

/**
 * Which generated files exist, from /audio/manifest.json.
 *
 * Without this the player requests an mp3 for every line and falls back when
 * it 404s. That works, but it fills the console with failed requests and
 * makes a normal session look broken. The manifest is fetched once: no file
 * means an empty set and no further requests, and the whole feature runs on
 * the browser's voice in silence.
 */
let manifest: Promise<Set<string>> | null = null;

const generatedFiles = (): Promise<Set<string>> => {
  manifest ??= fetch("/audio/manifest.json")
    .then((response) => (response.ok ? response.json() : []))
    .then(
      (names: unknown) =>
        new Set(
          Array.isArray(names)
            ? names.filter((n) => typeof n === "string")
            : [],
        ),
    )
    .catch(() => new Set<string>());
  return manifest;
};

/**
 * The name a line's audio file would have.
 *
 * A one-line clip keeps the plain `<id>.mp3` that
 * scripts/generate-training-audio.mjs writes, so existing generated audio
 * still plays. Longer clips are per line, `<id>.2.mp3`, because a single file
 * cannot tell the player which line it is on.
 */
const lineFile = (clip: Clip, index: number, lang: TrainingLanguage) =>
  `${lang}/${clip.lines.length === 1 ? clip.id : `${clip.id}.${index}`}.mp3`;

/** Plays one line through the device's voice, then moves on. */
const speakLine = async (
  clip: Clip,
  index: number,
  /** The request this call belongs to; stale ones must stay silent. */
  mine: number,
) => {
  const line = clip.lines[index]!;
  const synth = window.speechSynthesis;
  if (!synth) {
    captionLine(clip, index, mine, NO_SPEECH);
    return;
  }

  const wanted = BCP47[currentLang];
  const voices = await voicesReady();
  // Stopped, or something else was started, while the voice list loaded.
  if (generation !== mine) return;
  const prefix = wanted.split("-")[0];
  const voice =
    voices.find((v) => v.lang === wanted) ??
    voices.find((v) => v.lang.replace("_", "-").startsWith(`${prefix}-`)) ??
    null;

  /*
   * Hindi text read by an English voice is worse than silence — it sounds
   * like nonsense and teaches nothing. Show the line instead of speaking it,
   * and keep going, so the passage can still be read to the end.
   */
  if (!voice && currentLang === "hi") {
    captionLine(clip, index, mine, NO_HINDI_VOICE);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(line);
  utterance.lang = wanted;
  utterance.rate = currentRate;
  if (voice) utterance.voice = voice;

  /*
   * Some Android builds never fire `onend`, which would strand the passage on
   * one line forever. Whichever happens first wins, and only once.
   */
  let moved = false;
  const advance = () => {
    if (moved || generation !== mine) return;
    moved = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => playLine(clip, index + 1, mine), 220);
  };
  utterance.onend = advance;
  utterance.onerror = advance;
  if (timer) clearTimeout(timer);
  timer = setTimeout(advance, 1500 + captionMs(line));

  set({ mode: "voice", error: null });
  synth.cancel();
  synth.speak(utterance);
};

/** Shows a line for long enough to read, then moves on. */
const captionLine = (
  clip: Clip,
  index: number,
  mine: number,
  error: string,
) => {
  if (generation !== mine) return;
  set({ mode: "captions", error });
  if (timer) clearTimeout(timer);
  timer = setTimeout(
    () => playLine(clip, index + 1, mine),
    captionMs(clip.lines[index]!),
  );
};

/**
 * Plays one line: generated file first, the device's voice if that file is
 * missing. Past the last line, moves to the next clip or finishes.
 */
const playLine = (clip: Clip, index: number, mine: number) => {
  if (generation !== mine) return;
  if (index >= clip.lines.length) {
    const [next, ...rest] = queue;
    if (next) {
      queue = rest;
      set({
        playing: playKey(next.id, currentLang),
        clip: next,
        index: 0,
        queued: rest.length,
      });
      playLine(next, 0, mine);
      return;
    }
    stopPlayback();
    return;
  }

  set({ index, status: "playing" });

  const file = lineFile(clip, index, currentLang);
  void generatedFiles().then((files) => {
    if (generation !== mine) return;
    // Nothing generated for this line: straight to the device's voice,
    // without a request that would only 404.
    if (!files.has(file)) {
      void speakLine(clip, index, mine);
      return;
    }
    startFile(clip, index, mine, `/audio/${file}`);
  });
};

/** Plays a generated file, falling back to the device's voice if it fails. */
const startFile = (clip: Clip, index: number, mine: number, src: string) => {
  const element = new Audio(src);
  element.playbackRate = currentRate;
  audio = element;

  element.onended = () => {
    if (generation === mine) playLine(clip, index + 1, mine);
  };

  /*
   * A failure can surface twice — as an error on the element and as a
   * rejected play() — and two fallbacks for one line means two voices, since
   * each one calls synth.speak(). Fall back at most once per line.
   */
  let fellBack = false;
  const fallBack = () => {
    if (fellBack || generation !== mine) return;
    fellBack = true;
    audio = null;
    void speakLine(clip, index, mine);
  };

  element.onerror = fallBack;
  void element.play().catch(fallBack);
};

/**
 * Play a clip, or several back to back. Replaces whatever is playing.
 *
 * Several clips is how "Play all" works: the reader presses once and the
 * player walks the whole list, showing which one it is on.
 */
export const playClips = (
  clips: Clip | Clip[],
  lang: TrainingLanguage,
  rate = 1,
) => {
  const list = (Array.isArray(clips) ? clips : [clips]).filter(
    (clip) => clip.lines.length > 0,
  );
  if (list.length === 0) return;

  // Bumps `generation`, so claim the new one only after silencing.
  silence();
  const mine = generation;
  const [first, ...rest] = list;
  queue = rest;
  set({
    playing: playKey(first!.id, lang),
    status: "playing",
    clip: first!,
    index: 0,
    queued: rest.length,
    mode: "voice",
    error: null,
  });
  currentLang = lang;
  currentRate = rate;
  playLine(first!, 0, mine);
};

/** Play one piece of text, split into lines on sentence ends. */
export const play = (
  id: string,
  text: string,
  lang: TrainingLanguage,
  rate = 1,
  title = "",
) => playClips({ id, title: title || text, lines: toLines(text) }, lang, rate);

export const toggle = (
  id: string,
  text: string,
  lang: TrainingLanguage,
  rate = 1,
  title = "",
) => {
  if (state.playing === playKey(id, lang)) stopPlayback();
  else play(id, text, lang, rate, title);
};

/** Stop/start the same clip without losing where it is. */
export const toggleClips = (
  clips: Clip | Clip[],
  lang: TrainingLanguage,
  rate = 1,
) => {
  const first = Array.isArray(clips) ? clips[0] : clips;
  if (first && state.playing === playKey(first.id, lang)) stopPlayback();
  else playClips(clips, lang, rate);
};

export const pausePlayback = () => {
  if (state.status !== "playing") return;
  // Rather than speechSynthesis.pause(), which several browsers implement
  // unreliably: silence it and remember the line to restart from.
  silence();
  set({ status: "paused" });
};

export const resumePlayback = () => {
  const { clip, index, status } = state;
  if (!clip || status !== "paused") return;
  silence();
  set({ status: "playing" });
  playLine(clip, index, generation);
};

/** Move by whole lines — the only step size that lands on a sentence. */
export const jumpLine = (delta: number) => {
  const { clip, index } = state;
  if (!clip) return;
  silence();
  const next = Math.max(0, Math.min(clip.lines.length - 1, index + delta));
  set({ status: "playing" });
  playLine(clip, next, generation);
};

/** Reapply the speed to whatever is playing, from the current line. */
export const setPlaybackRate = (rate: number) => {
  currentRate = rate;
  const { clip, index, status } = state;
  if (!clip || status !== "playing") return;
  silence();
  playLine(clip, index, generation);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;
const getServerSnapshot = () => IDLE;

export const useTrainingPlayer = (): PlayerState =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
