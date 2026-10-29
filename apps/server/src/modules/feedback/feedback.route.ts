import { Router, type Request } from "express";
import { buffer } from "node:stream/consumers";
import {
  FEEDBACK_MAX_SCREENSHOTS,
  FEEDBACK_MAX_VOICE_NOTES,
  feedbackBulkStatusSchema,
  feedbackCommentSchema,
  feedbackConfirmSchema,
  feedbackFileCompleteSchema,
  feedbackFileRequestSchema,
  feedbackSubmitSchema,
  feedbackTriageSchema,
  feedbackVoiceNoteRequestSchema,
} from "@skerp/validators";
import { feedbackFileKind, type FeedbackFileRequest } from "@skerp/types";

import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { getObjectStream, isS3Configured } from "../../lib/s3.js";
import { sendOk } from "../_shared/response.js";
import { parseListQuery } from "../_shared/list.query.js";
import { getParamId } from "../_shared/param.js";
import {
  completeUpload,
  createAttachment,
  getAttachment,
  getDownloadUrl,
} from "../attachments/attachment.service.js";
import {
  buildFeedbackDocx,
  imageSize,
  type DocxImage,
} from "./feedback.docx.js";
import { buildFeedbackXlsx } from "./feedback.export.js";
import {
  ATTACHMENT_ENTITY,
  buildFeedbackOrderBy,
  buildFeedbackWhere,
  commentSelect,
  deriveTitle,
  describeFilters,
  findScreenshots,
  findVoiceNotes,
  getFeedbackSummary,
  isResolved,
  listSelect,
  reporterSnapshot,
  statusChangeText,
  takeSubmitSlot,
  withFileCounts,
} from "./feedback.service.js";

/**
 * In-app feedback — TESTING PHASE ONLY (Jira label `remove-before-prod`).
 *
 * Mounted in index.ts only when FEEDBACK_ENABLED=true; with the flag off every
 * /feedback/* path 404s and the web widget hides itself. Bespoke router (not
 * createCrudRouter): submitting is open to every signed-in user, triage is
 * gated by feedback.view / feedback.manage.
 *
 * Pictures, documents and the voice note reuse attachment.service
 * (entityType "Feedback") — a one-way dependency: S3 keys land under
 * attachments/Feedback/. Feedback passes its own size and type limits, so the
 * env-wide attachment limits for other modules don't change.
 */
export const isFeedbackEnabled = (): boolean =>
  process.env.FEEDBACK_ENABLED === "true";

const MAX_CONTEXT_CHARS = 32_000;
const MAX_EXPORT_ROWS = 5_000;
const MAX_DOCX_ROWS = 300;
const MAX_DOCX_IMAGE_BYTES = 40 * 1024 * 1024;
/** Unfinished uploads (retries after a failed PUT) allowed on top of the limit. */
const MAX_PENDING_FILES = 2 * FEEDBACK_MAX_FILES;

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { ctx?: { userId: string } }) => req.ctx!.userId;
const canView = (req: Request) => req.ctx!.permissions.has(PERMS.FEEDBACK.VIEW);
const canManage = (req: Request) =>
  req.ctx!.permissions.has(PERMS.FEEDBACK.MANAGE);

/** Load an item and check the caller is its reporter (or, if allowed, the team). */
const loadForCaller = async (
  req: Request,
  allowTeam: (req: Request) => boolean,
) => {
  const item = await db.feedback.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, reporterId: true, status: true },
  });
  if (!item) throw new NotFoundError("Feedback not found");
  const isReporter = item.reporterId === actorId(req);
  if (!isReporter && !allowTeam(req)) throw new ForbiddenError();
  return { item, isReporter };
};

/** File names for the export columns, grouped by item. */
const exportFiles = async (ids: string[]): Promise<Map<string, ExportFile[]>> => {
  const files = new Map<string, ExportFile[]>();
  for (const file of await findFeedbackFiles(ids)) {
    files.set(file.entityId, [
      ...(files.get(file.entityId) ?? []),
      { kind: feedbackFileKind(file.mime), name: file.originalName },
    ]);
  }
  return files;
};

/** Lets the web widget hide itself when the server flag is off (404). */
router.get("/status", (_req, res) =>
  // Both kinds of attachment need S3, so one flag answers for both.
  sendOk(res, {
    enabled: true,
    screenshots: isS3Configured(),
    voiceNotes: isS3Configured(),
  }),
);

router.post("/", async (req, res) => {
  const parsed = feedbackSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    );
  }
  const { feedback, page, context } = parsed.data;
  if (JSON.stringify(context).length > MAX_CONTEXT_CHARS) {
    throw new BadRequestError("Technical details are too large");
  }

  const userId = actorId(req);
  if (!takeSubmitSlot(userId)) {
    throw new AppError(
      "You have sent a lot of feedback in the last hour. Please try again a little later.",
      429,
      "RATE_LIMITED",
    );
  }

  const created = await db.feedback.create({
    data: {
      category: feedback.category,
      impact: feedback.impact,
      title: deriveTitle(feedback, page.title),
      description: feedback.description || null,
      points: feedback.points,
      section: feedback.section || null,
      pagePath: page.path,
      pageTitle: page.title,
      moduleLabel: page.module,
      entityId: page.entityId || null,
      context: context as Prisma.InputJsonValue,
      reporterId: userId,
      ...(await reporterSnapshot(userId)),
    },
    select: { id: true, number: true },
  });
  return sendOk(res, created, undefined, 201);
});

router.get("/mine", async (req, res) => {
  const items = await db.feedback.findMany({
    where: { reporterId: actorId(req) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      number: true,
      category: true,
      impact: true,
      title: true,
      section: true,
      status: true,
      pagePath: true,
      pageTitle: true,
      moduleLabel: true,
      reporterConfirmedAt: true,
      voiceSeconds: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return sendOk(res, await withFileCounts(items));
});

router.get("/summary", can(PERMS.FEEDBACK.VIEW), async (_req, res) =>
  sendOk(res, await getFeedbackSummary()),
);

router.get("/", can(PERMS.FEEDBACK.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const where = buildFeedbackWhere(query);
  const [total, items] = await Promise.all([
    db.feedback.count({ where }),
    db.feedback.findMany({
      where,
      orderBy: buildFeedbackOrderBy(query),
      skip: query.page * query.size,
      take: query.size,
      select: listSelect,
    }),
  ]);
  return sendOk(res, await withFileCounts(items), {
    page: query.page,
    size: query.size,
    total,
  });
});

router.get("/export/xlsx", can(PERMS.FEEDBACK.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const rows = await db.feedback.findMany({
    where: buildFeedbackWhere(query),
    orderBy: buildFeedbackOrderBy(query),
    take: MAX_EXPORT_ROWS,
  });
  const generatedAt = new Date();
  const xlsx = await buildFeedbackXlsx(rows, {
    generatedAt,
    webUrl: process.env.WEB_URL,
    files: await exportFiles(rows.map((row) => row.id)),
  });
  const stamp = generatedAt.toISOString().slice(0, 10);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="skerp-feedback-${stamp}.xlsx"`,
  );
  return res.send(xlsx);
});

/** B7 — Word report for developers, pictures embedded, other files listed. */
router.get("/export/docx", can(PERMS.FEEDBACK.VIEW), async (req, res) => {
  const query = parseListQuery(req);
  const rows = await db.feedback.findMany({
    where: buildFeedbackWhere(query),
    orderBy: buildFeedbackOrderBy(query),
    take: MAX_DOCX_ROWS,
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        select: { authorName: true, side: true, body: true, createdAt: true },
      },
    },
  });

  const ids = rows.map((row) => row.id);
  const images = new Map<string, DocxImage[]>();
  let usedBytes = 0;
  let skippedImages = 0;
  if (rows.length > 0 && isS3Configured()) {
    const pictures = (await findFeedbackFiles(ids)).filter(
      (file) => feedbackFileKind(file.mime) === "image",
    );
    for (const picture of pictures) {
      if (usedBytes + picture.sizeBytes > MAX_DOCX_IMAGE_BYTES) {
        skippedImages += 1;
        continue;
      }
      try {
        const data = await buffer(await getObjectStream(picture.s3Key));
        const size = imageSize(data);
        if (!size) {
          skippedImages += 1;
          continue;
        }
        usedBytes += data.length;
        images.set(picture.entityId, [
          ...(images.get(picture.entityId) ?? []),
          { data, ...size },
        ]);
      } catch (error) {
        skippedImages += 1;
        console.error(
          "[feedback] could not load screenshot for Word export:",
          error,
        );
      }
    }
  }

  const generatedAt = new Date();
  const docx = await buildFeedbackDocx(rows, images, {
    generatedAt,
    filters: describeFilters(query),
    webUrl: process.env.WEB_URL,
    skippedImages,
    files: await exportFiles(ids),
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="skerp-feedback-${generatedAt.toISOString().slice(0, 10)}.docx"`,
  );
  return res.send(docx);
});

router.patch("/bulk", can(PERMS.FEEDBACK.MANAGE), async (req, res) => {
  const parsed = feedbackBulkStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { ids, status } = parsed.data;
  const userId = actorId(req);
  const [before, actor] = await Promise.all([
    db.feedback.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    }),
    reporterSnapshot(userId),
  ]);
  const changed = before.filter((item) => item.status !== status);

  const [result] = await db.$transaction([
    db.feedback.updateMany({
      where: { id: { in: ids } },
      data: { status, resolvedAt: isResolved(status) ? new Date() : null },
    }),
    db.feedbackComment.createMany({
      data: changed.map((item) => ({
        feedbackId: item.id,
        authorId: userId,
        authorName: actor.reporterName,
        side: "TEAM" as const,
        kind: "STATUS_CHANGE" as const,
        body: statusChangeText(item.status, status),
      })),
    }),
  ]);
  return sendOk(res, { updated: result.count });
});

router.get("/:id", async (req, res) => {
  const item = await db.feedback.findUnique({ where: { id: getParamId(req) } });
  if (!item) throw new NotFoundError("Feedback not found");
  if (!canView(req) && item.reporterId !== actorId(req)) {
    throw new ForbiddenError();
  }
  const stored = await findFeedbackFiles([item.id]);
  const files = isS3Configured()
    ? await Promise.all(
      stored.map(async (file) => ({
        id: file.id,
        kind: feedbackFileKind(file.mime),
        name: file.originalName,
        mime: file.mime,
        sizeBytes: file.sizeBytes,
        url: await getDownloadUrl(file.id),
      })),
    )
    : [];
  const voiceNotes = isS3Configured()
    ? await Promise.all(
      (await findVoiceNotes([item.id])).map(async (note) => ({
        id: note.id,
        url: await getDownloadUrl(note.id),
        mime: note.mime,
      })),
    )
    : [];
  return sendOk(res, { ...item, screenshots, voiceNotes });
});

router.patch("/:id", can(PERMS.FEEDBACK.MANAGE), async (req, res) => {
  const parsed = feedbackTriageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const id = getParamId(req);
  const current = await db.feedback.findUnique({
    where: { id },
    select: { status: true, resolvedAt: true },
  });
  if (!current) throw new NotFoundError("Feedback not found");

  const next = parsed.data;
  const resolvedAt = !isResolved(next.status)
    ? null
    : isResolved(current.status)
      ? current.resolvedAt
      : new Date();

  const userId = actorId(req);
  const statusChanged = next.status !== current.status;
  const actor = statusChanged ? await reporterSnapshot(userId) : null;

  const [item] = await db.$transaction([
    db.feedback.update({
      where: { id },
      data: {
        ...next,
        resolvedAt,
        // A new FIXED round needs a fresh confirmation from the reporter.
        ...(statusChanged ? { reporterConfirmedAt: null } : {}),
      },
    }),
    db.feedbackComment.createMany({
      data: actor
        ? [
          {
            feedbackId: id,
            authorId: userId,
            authorName: actor.reporterName,
            side: "TEAM" as const,
            kind: "STATUS_CHANGE" as const,
            body: statusChangeText(current.status, next.status),
          },
        ]
        : [],
    }),
  ]);
  return sendOk(res, item);
});

/* ------------------------------------------------------------------ */
/* Files + voice note (reporter uploads after the item is created)     */
/* ------------------------------------------------------------------ */

/** "C:\fakepath\Rate list (Oct).xlsx" → "Rate list (Oct).xlsx", extension forced to match the type. */
const documentName = (name: string, mime: FeedbackDocumentMime): string => {
  const base = name.split(/[\\/]/).pop() ?? "";
  const stem =
    base
      .replace(/\.[^.]*$/, "")
      .replace(/[^\w .()-]+/g, "_")
      .trim()
      .slice(0, 150) || "document";
  return `${stem}.${FEEDBACK_DOCUMENT_EXTENSIONS[mime]}`;
};

const storedName = (request: FeedbackFileRequest): string => {
  switch (request.kind) {
    case "image":
      return `picture-${request.width}x${request.height}.${request.mime === "image/png" ? "png" : "jpg"}`;
    case "document":
      return documentName(request.name, request.mime);
    case "voice":
      return `voice-note-${request.durationSec}s.${FEEDBACK_VOICE_EXTENSIONS[request.mime]}`;
  }
};

const limitsFor = (kind: FeedbackFileRequest["kind"]) =>
  kind === "voice"
    ? { maxBytes: FEEDBACK_MAX_VOICE_BYTES, mimes: FEEDBACK_VOICE_MIMES }
    : {
      maxBytes: FEEDBACK_MAX_FILE_BYTES,
      mimes: [...FEEDBACK_IMAGE_MIMES, ...FEEDBACK_DOCUMENT_MIMES],
    };

/** Finished uploads of this item: the voice note, and pictures + documents together. */
const uploadedCounts = async (feedbackId: string) => {
  const rows = await db.attachment.findMany({
    where: { entityType: ATTACHMENT_ENTITY, entityId: feedbackId, uploaded: true, deletedAt: null },
    select: { mime: true },
  });
  const voice = rows.filter((row) => feedbackFileKind(row.mime) === "voice").length;
  return { voice, files: rows.length - voice };
};

const assertRoomFor = async (feedbackId: string, kind: FeedbackFileRequest["kind"]) => {
  const counts = await uploadedCounts(feedbackId);
  if (kind === "voice" && counts.voice >= 1) {
    throw new BadRequestError("Only one voice note can be attached");
  }
  if (kind !== "voice" && counts.files >= FEEDBACK_MAX_FILES) {
    throw new BadRequestError(`You can attach up to ${FEEDBACK_MAX_FILES} files`);
  }
};

router.post("/:id/files", async (req, res) => {
  if (!isS3Configured()) {
    throw new ConflictError("File storage is not set up on this server");
  }
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();

  const parsed = feedbackFileRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const existing = await db.attachment.count({
    where: {
      entityType: ATTACHMENT_ENTITY,
      entityId: item.id,
      deletedAt: null,
    },
  });
  if (existing >= FEEDBACK_MAX_SCREENSHOTS) {
    throw new BadRequestError(
      `You can attach up to ${FEEDBACK_MAX_SCREENSHOTS} pictures`,
    );
  }

  const { attachment, uploadUrl } = await createAttachment(
    {
      entityType: ATTACHMENT_ENTITY,
      entityId: item.id,
      originalName: storedName(request),
      mime: request.mime,
      sizeBytes: request.sizeBytes,
    },
    actorId(req),
    limitsFor(request.kind),
  );
  return sendOk(
    res,
    { attachmentId: attachment.id, uploadUrl },
    undefined,
    201,
  );
});

router.post("/:id/files/:attachmentId/complete", async (req, res) => {
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();
  const parsed = feedbackFileCompleteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const attachment = await getAttachment(String(req.params.attachmentId));
  if (
    attachment.entityType !== ATTACHMENT_ENTITY ||
    attachment.entityId !== item.id
  ) {
    throw new NotFoundError("Picture not found");
  }
  const kind = feedbackFileKind(attachment.mime);
  // Checked again here: several requests can be in flight at once.
  if (!attachment.uploaded) await assertRoomFor(item.id, kind);

  await completeUpload(attachment.id);
  if (kind === "voice") {
    await db.feedback.update({
      where: { id: item.id },
      data: { voiceSeconds: parsed.data.durationSec ?? null },
    });
  }
  return sendOk(res, { id: attachment.id });
});

/* ------------------------------------------------------------------ */
/* B9 — voice notes (a spoken report, recorded in the browser)         */
/* ------------------------------------------------------------------ */

router.post("/:id/voice-notes", async (req, res) => {
  if (!isS3Configured()) {
    throw new ConflictError("Voice note storage is not set up on this server");
  }
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();

  const parsed = feedbackVoiceNoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  // Counted against voice notes only — pictures have their own limit.
  const existing = await db.attachment.count({
    where: {
      entityType: ATTACHMENT_ENTITY,
      entityId: item.id,
      mime: { startsWith: "audio/" },
      deletedAt: null,
    },
  });
  if (existing >= FEEDBACK_MAX_VOICE_NOTES) {
    throw new BadRequestError(
      `You can attach up to ${FEEDBACK_MAX_VOICE_NOTES} voice notes`,
    );
  }

  const { mime, sizeBytes, durationSeconds } = parsed.data;
  const extension = mime.slice("audio/".length);
  const { attachment, uploadUrl } = await createAttachment(
    {
      entityType: ATTACHMENT_ENTITY,
      entityId: item.id,
      // The duration is in the name so the team sees it without playing.
      originalName: `voice-note-${durationSeconds}s.${extension}`,
      mime,
      sizeBytes,
    },
    actorId(req),
  );
  return sendOk(
    res,
    { attachmentId: attachment.id, uploadUrl },
    undefined,
    201,
  );
});

router.post("/:id/voice-notes/:attachmentId/complete", async (req, res) => {
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();
  const attachment = await getAttachment(String(req.params.attachmentId));
  if (
    attachment.entityType !== ATTACHMENT_ENTITY ||
    attachment.entityId !== item.id
  ) {
    throw new NotFoundError("Voice note not found");
  }
  await completeUpload(attachment.id);
  return sendOk(res, { id: attachment.id });
});

/* ------------------------------------------------------------------ */
/* B8 — conversation + reporter confirmation                           */
/* ------------------------------------------------------------------ */

router.get("/:id/comments", async (req, res) => {
  const { item } = await loadForCaller(req, canView);
  const comments = await db.feedbackComment.findMany({
    where: { feedbackId: item.id },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });
  return sendOk(res, comments);
});

router.post("/:id/comments", async (req, res) => {
  const { item, isReporter } = await loadForCaller(req, canManage);
  const parsed = feedbackCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const userId = actorId(req);
  const author = await reporterSnapshot(userId);
  const [comment] = await db.$transaction([
    db.feedbackComment.create({
      data: {
        feedbackId: item.id,
        authorId: userId,
        authorName: author.reporterName,
        side: isReporter ? "REPORTER" : "TEAM",
        body: parsed.data.body,
      },
      select: commentSelect,
    }),
    // Bump updatedAt so the other side sees "new activity".
    db.feedback.update({
      where: { id: item.id },
      data: { updatedAt: new Date() },
    }),
  ]);
  return sendOk(res, comment, undefined, 201);
});

router.post("/:id/confirm", async (req, res) => {
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();
  if (item.status !== "FIXED") {
    throw new ConflictError("Only items marked Fixed can be confirmed");
  }
  const parsed = feedbackConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { outcome, comment } = parsed.data;
  const userId = actorId(req);
  const author = await reporterSnapshot(userId);
  const stillBroken = outcome === "STILL_BROKEN";

  await db.$transaction([
    db.feedback.update({
      where: { id: item.id },
      data: stillBroken
        ? { status: "TRIAGED", resolvedAt: null, reporterConfirmedAt: null }
        : { reporterConfirmedAt: new Date() },
    }),
    db.feedbackComment.create({
      data: {
        feedbackId: item.id,
        authorId: userId,
        authorName: author.reporterName,
        side: "REPORTER",
        kind: outcome,
        body:
          comment ||
          (stillBroken
            ? "It is still not working."
            : "I checked it and it works now."),
      },
    }),
  ]);
  return sendOk(res, { id: item.id, outcome });
});

export default router;
