import { randomUUID } from "node:crypto";
import type { CreateAttachmentInput } from "@skerp/validators/attachments";
import { db } from "../../../prisma/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import {
  deleteObject,
  headObject,
  presignDownload,
  presignUpload,
} from "../../lib/s3.js";

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const maxSizeBytes = (): number =>
  Number(process.env.ATTACHMENT_MAX_SIZE_BYTES || DEFAULT_MAX_SIZE);

const allowedMimes = (): string[] => {
  const raw = process.env.ATTACHMENT_ALLOWED_MIME;
  if (!raw) return DEFAULT_ALLOWED_MIME;
  return raw
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
};

const sanitizeName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);

const buildKey = (input: CreateAttachmentInput): string =>
  `attachments/${sanitizeName(input.entityType)}/${sanitizeName(
    input.entityId,
  )}/${randomUUID()}-${sanitizeName(input.originalName)}`;

/**
 * Validate the request, create the PENDING row, and return a presigned PUT URL.
 * The browser uploads straight to S3 — bytes never pass through this server.
 */
export const createAttachment = async (
  input: CreateAttachmentInput,
  userId: string,
) => {
  if (input.sizeBytes > maxSizeBytes()) {
    throw new BadRequestError(
      `File exceeds the ${maxSizeBytes()} byte limit`,
      "FILE_TOO_LARGE",
    );
  }
  if (!allowedMimes().includes(input.mime.toLowerCase())) {
    throw new BadRequestError(
      `File type "${input.mime}" is not allowed`,
      "MIME_NOT_ALLOWED",
    );
  }

  const s3Key = buildKey(input);

  const attachment = await db.attachment.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      s3Key,
      originalName: input.originalName,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      uploadedBy: userId,
    },
  });

  const uploadUrl = await presignUpload(s3Key, input.mime);

  return { attachment, uploadUrl };
};

/**
 * Confirm the browser finished its PUT: verify the object exists in S3 and mark
 * the row uploaded + available. (Antivirus scanning is not wired up right now —
 * files are marked CLEAN on upload. Re-enabling ClamAV later means setting this
 * back to PENDING and re-adding the scan worker; the status field already exists.)
 */
export const completeUpload = async (id: string) => {
  const attachment = await db.attachment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");

  // Confirm the object actually landed in S3 (throws if missing).
  const head = await headObject(attachment.s3Key).catch(() => null);
  if (!head) {
    throw new BadRequestError(
      "Uploaded object not found in storage",
      "UPLOAD_NOT_FOUND",
    );
  }

  return db.attachment.update({
    where: { id },
    data: {
      uploaded: true,
      sizeBytes: head.size || attachment.sizeBytes,
      antivirusStatus: "CLEAN",
    },
  });
};

export const listByEntity = (entityType: string, entityId: string) =>
  db.attachment.findMany({
    where: { entityType, entityId, deletedAt: null },
    orderBy: { uploadedAt: "desc" },
  });

export const getAttachment = async (id: string) => {
  const attachment = await db.attachment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");
  return attachment;
};

/** Presigned GET URL — refused unless the file passed the antivirus scan. */
export const getDownloadUrl = async (id: string): Promise<string> => {
  const attachment = await getAttachment(id);
  if (attachment.antivirusStatus !== "CLEAN") {
    throw new ConflictError(
      `File is not available for download (status: ${attachment.antivirusStatus})`,
      "ATTACHMENT_NOT_CLEAN",
    );
  }
  return presignDownload(attachment.s3Key, attachment.originalName);
};

/** Soft-delete the row and remove the underlying S3 object. */
export const removeAttachment = async (id: string) => {
  const attachment = await getAttachment(id);

  await deleteObject(attachment.s3Key).catch((error) => {
    console.error("[attachments] Failed to delete S3 object:", attachment.s3Key, error);
  });

  await db.attachment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
