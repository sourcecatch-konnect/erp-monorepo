import { Router } from "express";
import {
  feedbackBulkStatusSchema,
  feedbackSubmitSchema,
  feedbackTriageSchema,
} from "@skerp/validators";

import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { parseListQuery } from "../_shared/list.query.js";
import { getParamId } from "../_shared/param.js";
import { buildFeedbackXlsx } from "./feedback.export.js";
import {
  buildFeedbackOrderBy,
  buildFeedbackWhere,
  getFeedbackSummary,
  isResolved,
  listSelect,
  pickDetails,
  reporterSnapshot,
  takeSubmitSlot,
} from "./feedback.service.js";

/**
 * In-app feedback — TESTING PHASE ONLY (Jira label `remove-before-prod`).
 *
 * Mounted in index.ts only when FEEDBACK_ENABLED=true; with the flag off every
 * /feedback/* path 404s and the web widget hides itself. Bespoke router (not
 * createCrudRouter): submitting is open to every signed-in user, triage is
 * gated by feedback.view / feedback.manage.
 */
export const isFeedbackEnabled = (): boolean =>
  process.env.FEEDBACK_ENABLED === "true";

const MAX_CONTEXT_CHARS = 32_000;
const MAX_EXPORT_ROWS = 5_000;

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { ctx?: { userId: string } }) => req.ctx!.userId;

/** Lets the web widget hide itself when the server flag is off (404). */
router.get("/status", (_req, res) => sendOk(res, { enabled: true }));

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
      pageTitle: true,
      moduleLabel: true,
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

router.patch("/bulk", can(PERMS.FEEDBACK.MANAGE), async (req, res) => {
  const parsed = feedbackBulkStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const { ids, status } = parsed.data;
  const result = await db.feedback.updateMany({
    where: { id: { in: ids } },
    data: { status, resolvedAt: isResolved(status) ? new Date() : null },
  });
  return sendOk(res, { updated: result.count });
});

router.get("/:id", async (req, res) => {
  const item = await db.feedback.findUnique({ where: { id: getParamId(req) } });
  if (!item) throw new NotFoundError("Feedback not found");
  const canViewAll = req.ctx!.permissions.has(PERMS.FEEDBACK.VIEW);
  if (!canViewAll && item.reporterId !== actorId(req)) {
    throw new ForbiddenError();
  }
  return sendOk(res, item);
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

  const item = await db.feedback.update({
    where: { id },
    data: { ...next, resolvedAt },
  });
  return sendOk(res, item);
});

export default router;
