import {
  FEEDBACK_MAX_SCREENSHOT_BYTES,
} from "@skerp/validators";

/** A picture waiting to be sent with the feedback (kept in memory until submit). */
export type Screenshot = {
  id: string;
  blob: Blob;
  /** Object URL for previews; revoke with releaseScreenshot. */
  url: string;
  width: number;
  height: number;
  source: "page" | "element" | "upload";
};

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

const toBlob = (canvas: HTMLCanvasElement, quality = JPEG_QUALITY) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the picture"))),
      "image/jpeg",
      quality,
    ),
  );

/** Downscale to at most 1600px wide and encode as JPEG under the size limit. */
export async function canvasToScreenshot(
  source: HTMLCanvasElement,
  kind: Screenshot["source"],
): Promise<Screenshot> {
  const scale = Math.min(1, MAX_WIDTH / source.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't make pictures here");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  let blob = await toBlob(canvas);
  if (blob.size > FEEDBACK_MAX_SCREENSHOT_BYTES) blob = await toBlob(canvas, 0.6);
  if (blob.size > FEEDBACK_MAX_SCREENSHOT_BYTES) {
    throw new Error("This picture is too large. Try a smaller part of the screen.");
  }
  return {
    id: crypto.randomUUID(),
    blob,
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    source: kind,
  };
}

/** A file the user picked or pasted (PNG, JPEG, …) → JPEG screenshot. */
export async function fileToScreenshot(file: File): Promise<Screenshot> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a picture (PNG or JPEG)");
  }
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToScreenshot(canvas, "upload");
}

export const releaseScreenshot = (shot: Screenshot) => URL.revokeObjectURL(shot.url);

/** Resolve a design token (e.g. "--primary") for drawing on a canvas. */
export const tokenColor = (token: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
