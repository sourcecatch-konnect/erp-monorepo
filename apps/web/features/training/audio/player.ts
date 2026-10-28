"use client";

import { useSyncExternalStore } from "react";
import type { TrainingLanguage } from "../i18n";

/**
 * One player for the whole training section.
 *
 * Two things are being guarded here. First, only one thing may ever speak at
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
 * No API key and no backend: the files are static, and speechSynthesis is
 * built into the browser.
 */

export type PlayerState = {
  /**
   * What is playing, as `<lang>:<id>`, or null. The language is part of this
   * key so that switching language while something plays does not leave a
   * button looking active for the other language's audio. It is NOT part of
   * the file path — see `playKey` and `play`.
   */
  playing: string | null;
  /** Set when the last attempt could not speak at all. */
  error: string | null;
};

/** The key a button compares against `playing`. */
export const playKey = (id: string, lang: TrainingLanguage) => `${lang}:${id}`;

let state: PlayerState = { playing: null, error: null };
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const set = (next: Partial<PlayerState>) => {
  state = { ...state, ...next };
  emit();
};

let audio: HTMLAudioElement | null = null;

/*
 * Which request is current. Starting or stopping playback bumps it, and every
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

/** Stops whatever is speaking, from either source. */
export const stopPlayback = () => {
  generation += 1;
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
  if (state.playing !== null) set({ playing: null });
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

const speak = async (
  id: string,
  text: string,
  lang: TrainingLanguage,
  rate: number,
  /** The request this call belongs to; stale ones must stay silent. */
  mine: number,
) => {
  const synth = window.speechSynthesis;
  if (!synth) {
    set({ playing: null, error: "This browser cannot read text aloud." });
    return;
  }

  const wanted = BCP47[lang];
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
   * like nonsense and teaches nothing. Say so instead of playing it.
   */
  if (!voice && lang === "hi") {
    set({
      playing: null,
      error:
        "This device has no Hindi voice installed, so this cannot be read aloud yet.",
    });
    return;
  }

  const key = playKey(id, lang);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = wanted;
  utterance.rate = rate;
  if (voice) utterance.voice = voice;
  utterance.onend = () => {
    if (state.playing === key) set({ playing: null });
  };
  utterance.onerror = () => {
    if (state.playing === key) set({ playing: null, error: null });
  };

  synth.cancel();
  synth.speak(utterance);
  set({ playing: key, error: null });
};

/**
 * Play one piece of text. Tries the generated file first and falls back to the
 * browser's voice if it is missing, so an id with no audio yet still speaks.
 *
 * `id` is the bare content id (`glossary.lr.meaning`). The language is a
 * separate argument and appears in the folder, never in the file name, so the
 * path matches what scripts/generate-training-audio.mjs writes.
 */
export const play = (
  id: string,
  text: string,
  lang: TrainingLanguage,
  rate = 1,
) => {
  // Bumps `generation`, so claim the new one only after stopping.
  stopPlayback();
  const mine = generation;
  set({ error: null });

  const key = playKey(id, lang);
  const element = new Audio(`/audio/${lang}/${encodeURIComponent(id)}.mp3`);
  element.playbackRate = rate;
  audio = element;

  element.onended = () => {
    if (state.playing === key) set({ playing: null });
  };

  /*
   * A missing file can surface twice — as an error on the element and as a
   * rejected play() — and two fallbacks for one press means two voices, since
   * each one calls synth.speak(). Fall back at most once per request.
   */
  let fellBack = false;
  const fallBack = () => {
    if (fellBack || generation !== mine) return;
    fellBack = true;
    audio = null;
    void speak(id, text, lang, rate, mine);
  };

  element.onerror = fallBack;
  void element.play().catch(fallBack);

  set({ playing: key });
};

export const toggle = (
  id: string,
  text: string,
  lang: TrainingLanguage,
  rate = 1,
) => {
  if (state.playing === playKey(id, lang)) stopPlayback();
  else play(id, text, lang, rate);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;
const SERVER_STATE: PlayerState = { playing: null, error: null };
const getServerSnapshot = () => SERVER_STATE;

export const useTrainingPlayer = (): PlayerState =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
