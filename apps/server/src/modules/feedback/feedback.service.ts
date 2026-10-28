import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_IMPACTS,
  FEEDBACK_IMPACT_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  type feedbackFormSchema,
} from "@skerp/validators";
import {
  feedbackFileKind,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSummary,
} from "@skerp/types";
import type { z } from "zod";

import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import type { ListQuery } from "../_shared/list.query.js";

/**
 * In-app feedback — testing phase only (Jira label `remove-before-prod`).
 * Nothing outside this folder imports from it except the mount in index.ts.
 */

type FeedbackForm = z.output<typeof feedbackFormSchema>;

export const OPEN_STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS"] as const;
const RESOLVED_STATUSES: readonly FeedbackStatus[] = [
  "FIXED",
  "WONT_FIX",
  "DUPLICATE",
];

export const isResolved = (status: FeedbackStatus): boolean =>
  RESOLVED_STATUSES.includes(status);

const isOneOf = <T extends string>(
  values: readonly T[],
  value: string | undefined,
): value is T =>
  value !== undefined && (values as readonly string[]).includes(value);

export const listSelect = {
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
  reporterName: true,
  reporterRole: true,
  reporterBranch: true,
  reporterConfirmedAt: true,
  voiceSeconds: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FeedbackSelect;

export const commentSelect = {
  id: true,
  authorName: true,
  side: true,
  kind: true,
  body: true,
  createdAt: true,
} satisfies Prisma.FeedbackCommentSelect;

/* ------------------------------------------------------------------ */
/* Attached files (pictures, documents, voice note)                    */
/* ------------------------------------------------------------------ */

/** Attachment entityType for feedback files (S3 prefix attachments/Feedback/). */
export const ATTACHMENT_ENTITY = "Feedback";

const cleanFiles = (feedbackIds: string[]) =>
  ({
    entityType: ATTACHMENT_ENTITY,
    entityId: { in: feedbackIds },
    uploaded: true,
    deletedAt: null,
    antivirusStatus: "CLEAN",
  }) satisfies Prisma.AttachmentWhereInput;

/** Clean, uploaded files for these items, oldest first. */
export const findFeedbackFiles = (feedbackIds: string[]) =>
  db.attachment.findMany({
    where: cleanFiles(feedbackIds),
    orderBy: { uploadedAt: "asc" },
    select: {
      id: true,
      entityId: true,
      s3Key: true,
      sizeBytes: true,
      originalName: true,
      mime: true,
    },
  });

export type FeedbackFileCounts = { imageCount: number; documentCount: number };

/** Picture and document counts per item, for the list views. */
export const countFeedbackFiles = async (
  feedbackIds: string[],
): Promise<Map<string, FeedbackFileCounts>> => {
  const counts = new Map<string, FeedbackFileCounts>();
  if (feedbackIds.length === 0) return counts;
  const rows = await db.attachment.groupBy({
    by: ["entityId", "mime"],
    where: cleanFiles(feedbackIds),
    _count: { _all: true },
  });
  for (const row of rows) {
    const current = counts.get(row.entityId) ?? { imageCount: 0, documentCount: 0 };
    const kind = feedbackFileKind(row.mime);
    if (kind === "image") current.imageCount += row._count._all;
    if (kind === "document") current.documentCount += row._count._all;
    counts.set(row.entityId, current);
  }
  return counts;
};

export const withFileCounts = async <T extends { id: string }>(
  items: T[],
): Promise<(T & FeedbackFileCounts)[]> => {
  const counts = await countFeedbackFiles(items.map((item) => item.id));
  return items.map((item) => ({
    ...item,
    ...(counts.get(item.id) ?? { imageCount: 0, documentCount: 0 }),
  }));
};

const startOfDay = (iso: string): Date | null => {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Filters (all optional): `filter[status]` (a status or "OPEN"),
 * `filter[category]`, `filter[impact]`, `filter[module]`,
 * `filter[pageTitle]`, `filter[role]`, `filter[from]`, `filter[to]`
 * (YYYY-MM-DD). `search` matches title, text, page, reporter or the FB number.
 */
export const buildFeedbackWhere = (
  query: ListQuery,
): Prisma.FeedbackWhereInput => {
  const { filter, search } = query;
  const and: Prisma.FeedbackWhereInput[] = [];

  if (filter.status === "OPEN") {
    and.push({ status: { in: [...OPEN_STATUSES] } });
  } else if (isOneOf(FEEDBACK_STATUSES, filter.status)) {
    and.push({ status: filter.status });
  }
  if (isOneOf(FEEDBACK_CATEGORIES, filter.category)) {
    and.push({ category: filter.category });
  }
  if (isOneOf(FEEDBACK_IMPACTS, filter.impact)) {
    and.push({ impact: filter.impact });
  }
  if (filter.module) and.push({ moduleLabel: filter.module });
  if (filter.pageTitle) and.push({ pageTitle: filter.pageTitle });
  if (filter.role) and.push({ reporterRole: filter.role });

  const from = filter.from ? startOfDay(filter.from) : null;
  const to = filter.to ? startOfDay(filter.to) : null;
  if (from) and.push({ createdAt: { gte: from } });
  if (to) {
    const nextDay = new Date(to);
    nextDay.setDate(nextDay.getDate() + 1);
    and.push({ createdAt: { lt: nextDay } });
  }

  if (search) {
    const number = Number(search.replace(/^fb-?/i, ""));
    const contains = { contains: search, mode: "insensitive" as const };
    and.push({
      OR: [
        { title: contains },
        { description: contains },
        { section: contains },
        { pageTitle: contains },
        { moduleLabel: contains },
        { reporterName: contains },
        ...(Number.isInteger(number) && number > 0 ? [{ number }] : []),
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
};

const SORTABLE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "number",
  "status",
  "category",
  "impact",
  "moduleLabel",
]);

export const buildFeedbackOrderBy = (
  query: ListQuery,
): Prisma.FeedbackOrderByWithRelationInput =>
  query.sort && SORTABLE_FIELDS.has(query.sort.field)
    ? { [query.sort.field]: query.sort.direction }
    : { createdAt: "desc" };

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

const MAX_TITLE_CHARS = 120;

/** Cut at a word boundary when there is one in the second half, then add "…". */
const clipAtWord = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

/**
 * The reporter doesn't type a title: use the first line of the text, else the
 * first point, else "<Type> on <Page>" (a voice note or pictures only).
 */
export const deriveTitle = (
  form: Pick<FeedbackForm, "category" | "description" | "points">,
  pageTitle: string,
): string => {
  const firstLine = form.description
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const text =
    firstLine ??
    form.points[0] ??
    `${FEEDBACK_CATEGORY_LABELS[form.category]} on ${pageTitle}`;
  return clipAtWord(text.replace(/\s+/g, " "), MAX_TITLE_CHARS);
};

/* ------------------------------------------------------------------ */
/* People + wording                                                    */
/* ------------------------------------------------------------------ */

/** Snapshot taken at submit time — no FK to User, so the table drops cleanly. */
export const reporterSnapshot = async (userId: string) => {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      role: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  return {
    reporterName: `${user.firstName} ${user.lastName}`.trim(),
    reporterRole: user.role.name,
    reporterBranch: user.branch?.name ?? null,
  };
};

/** Readable status-change line for the conversation thread. */
export const statusChangeText = (from: FeedbackStatus, to: FeedbackStatus) =>
  `Status changed from ${FEEDBACK_STATUS_LABELS[from]} to ${FEEDBACK_STATUS_LABELS[to]}.`;

/** Human-readable summary of the export filters, printed on the Word cover. */
export const describeFilters = (query: ListQuery): string => {
  const { filter, search } = query;
  const parts = [
    filter.status === "OPEN"
      ? "Status: Open"
      : isOneOf(FEEDBACK_STATUSES, filter.status)
        ? `Status: ${FEEDBACK_STATUS_LABELS[filter.status]}`
        : null,
    isOneOf(FEEDBACK_CATEGORIES, filter.category)
      ? `Type: ${FEEDBACK_CATEGORY_LABELS[filter.category]}`
      : null,
    isOneOf(FEEDBACK_IMPACTS, filter.impact)
      ? `Impact: ${FEEDBACK_IMPACT_LABELS[filter.impact]}`
      : null,
    filter.module ? `Module: ${filter.module}` : null,
    filter.pageTitle ? `Page: ${filter.pageTitle}` : null,
    search ? `Search: "${search}"` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "All feedback";
};

/* ------------------------------------------------------------------ */
/* Submit rate limit (in-memory, per server instance)                  */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const submitsByUser = new Map<string, number[]>();

/** Returns false once a user has sent MAX_PER_WINDOW items in the last hour. */
export const takeSubmitSlot = (userId: string): boolean => {
  const now = Date.now();
  const recent = (submitsByUser.get(userId) ?? []).filter(
    (at) => now - at < WINDOW_MS,
  );
  if (recent.length >= MAX_PER_WINDOW) {
    submitsByUser.set(userId, recent);
    return false;
  }
  recent.push(now);
  submitsByUser.set(userId, recent);
  return true;
};

/* ------------------------------------------------------------------ */
/* Summary for the admin inbox                                         */
/* ------------------------------------------------------------------ */

const zeroCounts = <T extends string>(keys: readonly T[]): Record<T, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;

export const getFeedbackSummary = async (): Promise<FeedbackSummary> => {
  const [byStatusRows, byCategoryRows, topPageRows, moduleRows] =
    await Promise.all([
      db.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
      db.feedback.groupBy({ by: ["category"], _count: { _all: true } }),
      db.feedback.groupBy({
        by: ["moduleLabel", "pageTitle"],
        where: { status: { in: [...OPEN_STATUSES] } },
        _count: { _all: true },
        orderBy: { _count: { pageTitle: "desc" } },
        take: 5,
      }),
      db.feedback.findMany({
        distinct: ["moduleLabel"],
        select: { moduleLabel: true },
        orderBy: { moduleLabel: "asc" },
      }),
    ]);

  const byStatus = zeroCounts<FeedbackStatus>(FEEDBACK_STATUSES);
  for (const row of byStatusRows) byStatus[row.status] = row._count._all;

  const byCategory = zeroCounts<FeedbackCategory>(FEEDBACK_CATEGORIES);
  for (const row of byCategoryRows) byCategory[row.category] = row._count._all;

  return {
    total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
    byStatus,
    byCategory,
    topPages: topPageRows.map((row) => ({
      moduleLabel: row.moduleLabel,
      pageTitle: row.pageTitle,
      open: row._count._all,
    })),
    modules: moduleRows.map((row) => row.moduleLabel),
  };
};
