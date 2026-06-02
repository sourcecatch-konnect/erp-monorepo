// packages/validators/src/attachments/attachment.schema.ts

import { z } from "zod";

/**
 * Body for `POST /attachments` — the presign-upload request. The server
 * validates this, generates an S3 key + presigned PUT URL, and creates the
 * pending `Attachment` row. `entityType`/`entityId` point at the host record
 * (e.g. "User" + the user id for a profile photo).
 */
export const createAttachmentSchema = z.object({
  entityType: z.string().min(1, "entityType is required").max(64),
  entityId: z.string().min(1, "entityId is required"),
  originalName: z.string().min(1, "File name is required").max(255),
  mime: z.string().min(1, "mime is required").max(128),
  sizeBytes: z.coerce.number().int().positive("sizeBytes must be positive"),
});

/** Query for `GET /attachments` — list attachments for a host entity const listByEntity. */
export const listAttachmentsQuerySchema = z.object({
  entityType: z.string().min(1, "entityType is required"),
  entityId: z.string().min(1, "entityId is required"),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;
