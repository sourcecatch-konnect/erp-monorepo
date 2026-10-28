import {
  FEEDBACK_DOCUMENT_EXTENSIONS,
  FEEDBACK_DOCUMENT_MIMES,
  FEEDBACK_MAX_FILE_BYTES,
  type FeedbackDocumentMime,
  type FeedbackVoiceMime,
} from "@skerp/validators";
import type { FeedbackElement } from "@skerp/types";
import { releaseScreenshot, type Screenshot } from "./images";

/**
 * Files and the voice note waiting to be sent, kept in memory per page by the
 * feedback sheet (blobs are too big for localStorage, so a reload loses them).
 */

export type PendingDocument = {
  file: File;
  name: string;
  mime: FeedbackDocumentMime;
};

export type PendingFile =
  | { kind: "image"; id: string; shot: Screenshot }
  | { kind: "document"; id: string; doc: PendingDocument };

export type VoiceNote = {
  id: string;
  blob: Blob;
  /** Object URL for playback; revoke with releaseVoiceNote. */
  url: string;
  mime: FeedbackVoiceMime;
  durationSec: number;
};

export type PageAttachments = {
  files: PendingFile[];
  voice: VoiceNote | null;
  /** The part of the screen picked with "Point at it on screen". */
  element: FeedbackElement | null;
};

export const NO_ATTACHMENTS: PageAttachments = { files: [], voice: null, element: null };

export const releaseVoiceNote = (note: VoiceNote) => URL.revokeObjectURL(note.url);

export const releaseFile = (file: PendingFile) => {
  if (file.kind === "image") releaseScreenshot(file.shot);
};

export const releaseAttachments = (attachments: PageAttachments) => {
  attachments.files.forEach(releaseFile);
  if (attachments.voice) releaseVoiceNote(attachments.voice);
};

/** What the file input accepts: any picture, plus the document types the server allows. */
export const FILE_ACCEPT = [
  "image/*",
  ...Object.values(FEEDBACK_DOCUMENT_EXTENSIONS).map((extension) => `.${extension}`),
].join(",");

const MIME_BY_EXTENSION = Object.fromEntries(
  Object.entries(FEEDBACK_DOCUMENT_EXTENSIONS).map(([mime, extension]) => [extension, mime]),
) as Record<string, FeedbackDocumentMime>;

const isDocumentMime = (mime: string): mime is FeedbackDocumentMime =>
  (FEEDBACK_DOCUMENT_MIMES as readonly string[]).includes(mime);

export type ClassifiedFile =
  | { kind: "image" }
  | { kind: "document"; mime: FeedbackDocumentMime }
  | { kind: "refused"; reason: string };

/**
 * Picture, accepted document, or refused (with the message to show). The type
 * comes from `file.type`, or from the extension when the browser leaves it
 * empty (Windows sometimes does for .docx / .xlsx).
 */
export function classifyFile(file: File): ClassifiedFile {
  // Pictures are re-encoded (and shrunk) before upload, so only documents are size-checked here.
  if (file.type.startsWith("image/")) return { kind: "image" };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = isDocumentMime(file.type) ? file.type : MIME_BY_EXTENSION[extension];
  if (!mime) {
    return {
      kind: "refused",
      reason: `"${file.name}" can't be attached. Use PDF, .docx, .xlsx or a picture.`,
    };
  }
  if (file.size > FEEDBACK_MAX_FILE_BYTES) {
    return { kind: "refused", reason: `"${file.name}" is larger than 12 MB.` };
  }
  return { kind: "document", mime };
}

/** 1536000 → "1.5 MB" */
export const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
