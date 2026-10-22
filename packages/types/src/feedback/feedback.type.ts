import { z } from "zod";
import {
  feedbackBulkStatusSchema,
  feedbackCategorySchema,
  feedbackCommentKindSchema,
  feedbackCommentSchema,
  feedbackCommentSideSchema,
  feedbackConfirmSchema,
  feedbackElementSchema,
  feedbackScreenshotRequestSchema,
  feedbackContextSchema,
  feedbackFormSchema,
  feedbackPageSchema,
  feedbackSeveritySchema,
  feedbackStatusSchema,
  feedbackSubmitSchema,
  feedbackTriageSchema,
} from "@skerp/validators";

/**
 * In-app feedback — testing phase only (Jira label `remove-before-prod`).
 */

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type FeedbackSeverity = z.infer<typeof feedbackSeveritySchema>;

export type FeedbackFormInput = z.input<typeof feedbackFormSchema>;
export type FeedbackPage = z.infer<typeof feedbackPageSchema>;
export type FeedbackContext = z.infer<typeof feedbackContextSchema>;
export type FeedbackSubmitBody = z.input<typeof feedbackSubmitSchema>;

// z.input: the triage form uses a `raw: true` resolver and the server parse
// turns "" into null — the server is the only transform boundary.
export type FeedbackTriageInput = z.input<typeof feedbackTriageSchema>;
export type FeedbackBulkStatusBody = z.infer<typeof feedbackBulkStatusSchema>;

/** Category-specific answers, keyed as in FEEDBACK_DETAIL_FIELDS. */
export type FeedbackDetails = Record<string, string>;

export type FeedbackListItem = {
  id: string;
  number: number;
  category: FeedbackCategory;
  title: string;
  severity: FeedbackSeverity | null;
  status: FeedbackStatus;
  pagePath: string;
  pageTitle: string;
  moduleLabel: string;
  reporterName: string;
  reporterRole: string;
  reporterBranch: string | null;
  reporterConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackScreenshot = {
  id: string;
  /** Short-lived presigned download URL. */
  url: string;
};

export type FeedbackDetail = FeedbackListItem & {
  description: string | null;
  details: FeedbackDetails;
  entityId: string | null;
  context: FeedbackContext;
  reporterId: string;
  assignee: string | null;
  devNotes: string | null;
  externalRef: string | null;
  resolvedAt: string | null;
  screenshots: FeedbackScreenshot[];
};

export type MyFeedbackItem = Pick<
  FeedbackListItem,
  | "id"
  | "number"
  | "category"
  | "title"
  | "status"
  | "pagePath"
  | "pageTitle"
  | "moduleLabel"
  | "reporterConfirmedAt"
  | "createdAt"
  | "updatedAt"
>;

export type FeedbackElement = z.infer<typeof feedbackElementSchema>;
export type FeedbackScreenshotRequest = z.infer<typeof feedbackScreenshotRequestSchema>;
export type FeedbackCommentBody = z.infer<typeof feedbackCommentSchema>;
export type FeedbackConfirmBody = z.infer<typeof feedbackConfirmSchema>;
export type FeedbackCommentKind = z.infer<typeof feedbackCommentKindSchema>;
export type FeedbackCommentSide = z.infer<typeof feedbackCommentSideSchema>;

export type FeedbackComment = {
  id: string;
  authorName: string;
  side: FeedbackCommentSide;
  kind: FeedbackCommentKind;
  body: string;
  createdAt: string;
};

/** POST /feedback/:id/screenshots */
export type FeedbackScreenshotUpload = { attachmentId: string; uploadUrl: string };

/** GET /feedback/status */
export type FeedbackStatusInfo = { enabled: boolean; screenshots: boolean };

/** Grouped by page name (not URL) so every detail page of a screen counts together. */
export type FeedbackTopPage = {
  pageTitle: string;
  moduleLabel: string;
  open: number;
};

export type FeedbackSummary = {
  total: number;
  byStatus: Record<FeedbackStatus, number>;
  byCategory: Record<FeedbackCategory, number>;
  topPages: FeedbackTopPage[];
  modules: string[];
};

export type FeedbackCreated = { id: string; number: number };

export const formatFeedbackNumber = (n: number): string =>
  `FB-${String(n).padStart(4, "0")}`;

// Order matters: Edge's UA also contains "Chrome", Chrome's contains "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg\/(\d+)/, "Edge"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/Version\/(\d+).*Safari/, "Safari"],
];
const OPERATING_SYSTEMS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

/** "Chrome 129 on Windows" — good enough for triage, not a full UA parser. */
export const describeUserAgent = (ua: string | undefined): string => {
  if (!ua) return "Unknown browser";
  let browser = "Browser";
  for (const [pattern, name] of BROWSERS) {
    const match = ua.match(pattern);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const os =
    OPERATING_SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ??
    "unknown OS";
  return `${browser} on ${os}`;
};
