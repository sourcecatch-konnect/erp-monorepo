import { Router, type Request } from "express";
import { buffer } from "node:stream/consumers";
import {
  FEEDBACK_MAX_SCREENSHOTS,
  FEEDBACK_MAX_VOICE_NOTES,
  feedbackBulkStatusSchema,
  feedbackCommentSchema,
  feedbackConfirmSchema,
  feedbackScreenshotRequestSchema,
  feedbackSubmitSchema,
  feedbackTriageSchema,
  feedbackVoiceNoteRequestSchema,
} from "@skerp/validators";

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
  describeFilters,
  findScreenshots,
  findVoiceNotes,
  getFeedbackSummary,
  isResolved,
  listSelect,
  pickDetails,
  reporterSnapshot,
  statusChangeText,
  takeSubmitSlot,
} from "./feedback.service.js";

/**
 * In-app feedback — TESTING PHASE ONLY (Jira label `remove-before-prod`).
 *
 * Mounted in index.ts only when FEEDBACK_ENABLED=true; with the flag off every
 * /feedback/* path 404s and the web widget hides itself. Bespoke router (not
 * createCrudRouter): submitting is open to every signed-in user, triage is
 * gated by feedback.view / feedback.manage.
 *
 * Screenshots reuse attachment.service (entityType "Feedback") — a one-way
 * dependency: S3 keys land under attachments/Feedback/, attachments is unchanged.
 */
export const isFeedbackEnabled = (): boolean =>
  process.env.FEEDBACK_ENABLED === "true";

const MAX_CONTEXT_CHARS = 32_000;
const MAX_EXPORT_ROWS = 5_000;
const MAX_DOCX_ROWS = 300;
const MAX_DOCX_IMAGE_BYTES = 40 * 1024 * 1024;

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
      title: feedback.title,
      description: feedback.description || null,
      details: pickDetails(feedback),
      severity: feedback.category === "BUG" ? feedback.severity : null,
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
      title: true,
      status: true,
      pagePath: true,
      pageTitle: true,
      moduleLabel: true,
      reporterConfirmedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return sendOk(res, items);
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
  return sendOk(res, items, { page: query.page, size: query.size, total });
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

/** B7 — Word report for developers, screenshots embedded. */
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

  const images = new Map<string, DocxImage[]>();
  let usedBytes = 0;
  let skippedImages = 0;
  if (rows.length > 0 && isS3Configured()) {
    const attachments = await findScreenshots(rows.map((row) => row.id));
    for (const attachment of attachments) {
      if (usedBytes + attachment.sizeBytes > MAX_DOCX_IMAGE_BYTES) {
        skippedImages += 1;
        continue;
      }
      try {
        const data = await buffer(await getObjectStream(attachment.s3Key));
        const size = imageSize(data);
        if (!size) {
          skippedImages += 1;
          continue;
        }
        usedBytes += data.length;
        images.set(attachment.entityId, [
          ...(images.get(attachment.entityId) ?? []),
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
  const screenshots = isS3Configured()
    ? await Promise.all(
        (await findScreenshots([item.id])).map(async (shot) => ({
          id: shot.id,
          url: await getDownloadUrl(shot.id),
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
/* B6 — screenshots (reporter uploads after the item is created)       */
/* ------------------------------------------------------------------ */

router.post("/:id/screenshots", async (req, res) => {
  if (!isS3Configured()) {
    throw new ConflictError("Picture storage is not set up on this server");
  }
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();

  const parsed = feedbackScreenshotRequestSchema.safeParse(req.body);
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

  const { mime, sizeBytes, width, height } = parsed.data;
  const extension = mime === "image/png" ? "png" : "jpg";
  const { attachment, uploadUrl } = await createAttachment(
    {
      entityType: ATTACHMENT_ENTITY,
      entityId: item.id,
      originalName: `screenshot-${width}x${height}.${extension}`,
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

router.post("/:id/screenshots/:attachmentId/complete", async (req, res) => {
  const { item, isReporter } = await loadForCaller(req, () => false);
  if (!isReporter) throw new ForbiddenError();
  const attachment = await getAttachment(String(req.params.attachmentId));
  if (
    attachment.entityType !== ATTACHMENT_ENTITY ||
    attachment.entityId !== item.id
  ) {
    throw new NotFoundError("Picture not found");
  }
  await completeUpload(attachment.id);
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
