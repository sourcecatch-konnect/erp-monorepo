#!/usr/bin/env node
/**
 * Generates the training audio files.
 *
 *   node scripts/generate-training-audio.mjs --lang en
 *   node scripts/generate-training-audio.mjs --lang hi
 *   node scripts/generate-training-audio.mjs --lang hi --force
 *
 * Writes public/audio/<lang>/<content-id>.mp3, one file per string. The app
 * looks those up by the same content id, so nothing has to be wired by hand:
 * drop a file in and the Read-aloud button plays it instead of the browser's
 * own voice.
 *
 * WHY PRE-GENERATED, NOT AN API CALL PER PLAY
 * The training text is fixed and finite. Generating once means no API key in
 * the app, no backend, no per-play cost and no latency. Only this script ever
 * touches a TTS engine, and it runs on a developer's machine.
 *
 * THE ENGINE: PIPER (no key, no account, runs locally)
 * https://github.com/rhasspy/piper — download the binary and a voice model,
 * then point this script at them:
 *
 *   PIPER_BIN=/path/to/piper
 *   PIPER_VOICE_EN=/path/to/en_... .onnx
 *   PIPER_VOICE_HI=/path/to/hi_... .onnx
 *
 * Piper writes WAV; ffmpeg converts to MP3. Both are free and local.
 * Check the voice list and listen to a sample before committing to one —
 * quality varies a lot between voices, especially for Hindi.
 *
 * SWAPPING TO A CLOUD VOICE LATER
 * Only `synthesise()` below knows about Piper. Replacing it with a cloud TTS
 * call changes nothing else: the ids, the paths and the app stay as they are,
 * and the key stays here, on your machine, never in the app.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");

const PIPER_BIN = process.env.PIPER_BIN ?? "piper";
const FFMPEG_BIN = process.env.FFMPEG_BIN ?? "ffmpeg";
const VOICE = {
  en: process.env.PIPER_VOICE_EN,
  hi: process.env.PIPER_VOICE_HI,
};

const args = process.argv.slice(2);
const lang = args[args.indexOf("--lang") + 1];
const force = args.includes("--force");

if (lang !== "en" && lang !== "hi") {
  console.error("Usage: generate-training-audio.mjs --lang <en|hi> [--force]");
  process.exit(1);
}

const outDir = join(WEB, "public", "audio", lang);
/** Lets a rerun skip text that has not changed since the last run. */
const stampPath = join(outDir, ".checksums.json");

/**
 * Every string the app can speak, as { id, text }.
 *
 * English comes from the content files; Hindi comes from the dictionary, so
 * only ids that are actually translated get Hindi audio. An untranslated id
 * is skipped rather than voiced in the wrong language.
 */
async function collect() {
  const items = [];

  if (lang === "hi") {
    // Read the dictionary's keys and values without importing TypeScript.
    const file = await readFile(
      join(WEB, "features/training/i18n/dictionary.hi.ts"),
      "utf8",
    );
    const body = file.slice(file.indexOf("export const HI"));
    const pattern = /"([a-zA-Z0-9._-]+)":\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
    for (const match of body.matchAll(pattern)) {
      const [, id, raw] = match;
      if (!id.includes(".")) continue;
      items.push({ id, text: JSON.parse(`"${raw}"`) });
    }
    return items;
  }

  // English: the glossary meanings, matching what is translated so far.
  const file = await readFile(
    join(WEB, "features/training/content/glossary.ts"),
    "utf8",
  );
  const entries = file.split(/\n {2}\{\n/).slice(1);
  for (const entry of entries) {
    const id = entry.match(/id: "([a-z0-9-]+)"/)?.[1];
    const meaning = entry.match(/meaning:\s*\n?\s*"((?:[^"\\]|\\.)*)"/)?.[1];
    if (id && meaning) {
      items.push({
        id: `glossary.${id}.meaning`,
        text: JSON.parse(`"${meaning}"`),
      });
    }
  }
  return items;
}

const exists = async (path) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Piper → WAV → ffmpeg → MP3. Replace this one function to change engine. */
async function synthesise(text, wavPath, mp3Path) {
  const model = VOICE[lang];
  if (!model) {
    throw new Error(
      `Set PIPER_VOICE_${lang.toUpperCase()} to a Piper .onnx voice model.`,
    );
  }
  await run(PIPER_BIN, ["--model", model, "--output_file", wavPath], {
    input: text,
  });
  await run(FFMPEG_BIN, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    wavPath,
    "-codec:a",
    "libmp3lame",
    "-qscale:a",
    "4",
    mp3Path,
  ]);
}

async function main() {
  const items = await collect();
  if (items.length === 0) {
    console.log(`Nothing to generate for "${lang}".`);
    return;
  }

  await mkdir(outDir, { recursive: true });

  const stamps = force
    ? {}
    : await readFile(stampPath, "utf8")
        .then(JSON.parse)
        .catch(() => ({}));

  let made = 0;
  let skipped = 0;

  for (const { id, text } of items) {
    const sum = createHash("sha1").update(text).digest("hex").slice(0, 12);
    const mp3Path = join(outDir, `${id}.mp3`);
    if (stamps[id] === sum && (await exists(mp3Path))) {
      skipped += 1;
      continue;
    }
    try {
      await synthesise(text, join(outDir, `${id}.wav`), mp3Path);
      stamps[id] = sum;
      made += 1;
      console.log(`  ${id}`);
    } catch (error) {
      console.error(`  FAILED ${id}: ${error.message}`);
    }
  }

  await writeFile(stampPath, JSON.stringify(stamps, null, 2));

  /*
   * public/audio/manifest.json — every generated file, as "<lang>/<name>.mp3".
   * The player reads it once and asks for a file only when it is listed, so a
   * line with no generated audio goes straight to the browser's voice instead
   * of 404ing first. Rebuilt from what is on disk across all languages, so
   * generating one language never drops another's entries.
   */
  const audioRoot = join(WEB, "public", "audio");
  const names = [];
  for (const dir of await readdir(audioRoot, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of await readdir(join(audioRoot, dir.name))) {
      if (file.endsWith(".mp3")) names.push(`${dir.name}/${file}`);
    }
  }
  names.sort();
  await writeFile(
    join(audioRoot, "manifest.json"),
    JSON.stringify(names, null, 2),
  );
  console.log(
    `\n${lang}: ${made} generated, ${skipped} unchanged, ${items.length} total.`,
  );
  console.log(`Files in public/audio/${lang}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
