import fs from "node:fs";
import path from "node:path";

// apps/server/src/templates/pdf/utils/image-to-base64.ts



export const imageToBase64Src = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();

  const mimeType =
    ext === ".svg"
      ? "image/svg+xml"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "application/octet-stream";

  const imageBuffer = fs.readFileSync(filePath);

  return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
};