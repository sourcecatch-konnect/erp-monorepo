import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createAttachmentSchema,
  listAttachmentsQuerySchema,
} from "@skerp/validators";
import { can } from "../../auth/can.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { BadRequestError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import {
  completeUpload,
  createAttachment,
  getDownloadUrl,
  listByEntity,
  removeAttachment,
} from "./attachment.service.js";

const router = Router();

router.use(authMiddleware);

router.post("/", can(PERMS.ATTACHMENTS.CREATE), async (req, res) => {
  const parsed = createAttachmentSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const { attachment, uploadUrl } = await createAttachment(parsed.data, userId);

  return sendOk(
    res,
    { attachmentId: attachment.id, s3Key: attachment.s3Key, uploadUrl },
    undefined,
    201,
  );
});

// Confirm the browser finished its PUT → verify in S3 + enqueue the scan.
router.post(
  "/:id/complete",
  can(PERMS.ATTACHMENTS.CREATE),
  async (req, res) => {
    const attachment = await completeUpload(req.params.id as string);
    return sendOk(res, attachment);
  },
);

// List attachments for a host entity.
router.get("/", can(PERMS.ATTACHMENTS.VIEW), async (req, res) => {
  const parsed = listAttachmentsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const data = await listByEntity(parsed.data.entityType, parsed.data.entityId);
  return sendOk(res, data);
});

// Presigned download URL — refused unless the file is CLEAN (409).
router.get(
  "/:id/download",
  can(PERMS.ATTACHMENTS.DOWNLOAD),
  async (req, res) => {
    const downloadUrl = await getDownloadUrl(req.params.id as string);
    return sendOk(res, { downloadUrl });
  },
);

// Soft-delete + remove the S3 object.
router.delete("/:id", can(PERMS.ATTACHMENTS.DELETE), async (req, res) => {
  await removeAttachment(req.params.id as string);
  return sendOk(res, { success: true });
});

export default router;
