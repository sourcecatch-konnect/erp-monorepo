import { z } from "zod";
import {
  LEGACY_FEEDBACK_DETAIL_FIELDS,
  feedbackBulkStatusSchema,
  feedbackCategorySchema,
  feedbackCommentKindSchema,
  feedbackCommentSchema,
  feedbackCommentSideSchema,
  feedbackConfirmSchema,
  feedbackElementSchema,
  feedbackFileCompleteSchema,
  feedbackFileRequestSchema,
  feedbackContextSchema,
  feedbackFormSchema,
  feedbackImpactSchema,
  feedbackPageSchema,
  feedbackStatusSchema,
  feedbackSubmitSchema,
  feedbackTriageSchema,
  feedbackVoiceNoteRequestSchema,
  type FEEDBACK_FILE_KINDS,
} from "@skerp/validators";

/**
 * In-app feedback — testing phase only (Jira label `remove-before-prod`).
 */

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type FeedbackImpact = z.infer<typeof feedbackImpactSchema>;

export type FeedbackFormInput = z.input<typeof feedbackFormSchema>;
export type FeedbackPage = z.infer<typeof feedbackPageSchema>;
export type FeedbackContext = z.infer<typeof feedbackContextSchema>;
export type FeedbackSubmitBody = z.input<typeof feedbackSubmitSchema>;

// z.input: the triage form uses a `raw: true` resolver and the server parse
// turns "" into null — the server is the only transform boundary.
export type FeedbackTriageInput = z.input<typeof feedbackTriageSchema>;
export type FeedbackBulkStatusBody = z.infer<typeof feedbackBulkStatusSchema>;

/** Answers from the v1 five-tab form, keyed as in LEGACY_FEEDBACK_DETAIL_FIELDS. Empty for v2 items. */
export type FeedbackDetails = Record<string, string>;

export type FeedbackListItem = {
  id: string;
  number: number;
  category: FeedbackCategory;
  impact: FeedbackImpact;
  title: string;
  section: string | null;
  status: FeedbackStatus;
  pagePath: string;
  pageTitle: string;
  moduleLabel: string;
  reporterName: string;
  reporterRole: string;
  reporterBranch: string | null;
  reporterConfirmedAt: string | null;
  /** Length of the voice note, when one arrived. */
  voiceSeconds: number | null;
  imageCount: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackFileKind = (typeof FEEDBACK_FILE_KINDS)[number];

export type FeedbackFile = {
  id: string;
  kind: FeedbackFileKind;
  name: string;
  mime: string;
  sizeBytes: number;
  /** Short-lived presigned download URL. */
  url: string;
};

export type FeedbackVoiceNote = {
  id: string;
  /** Short-lived presigned download URL. */
  url: string;
  mime: string;
};

export type FeedbackDetail = FeedbackListItem & {
  description: string | null;
  points: string[];
  details: FeedbackDetails;
  entityId: string | null;
  context: FeedbackContext;
  reporterId: string;
  assignee: string | null;
  devNotes: string | null;
  externalRef: string | null;
  resolvedAt: string | null;
  /** Images and documents, presigned for download. */
  files: FeedbackFile[];
  voiceNotes: FeedbackVoiceNote[];
};

export type MyFeedbackItem = Pick<
  FeedbackListItem,
  | "id"
  | "number"
  | "category"
  | "impact"
  | "title"
  | "section"
  | "status"
  | "pagePath"
  | "pageTitle"
  | "moduleLabel"
  | "reporterConfirmedAt"
  | "voiceSeconds"
  | "imageCount"
  | "documentCount"
  | "createdAt"
  | "updatedAt"
>;

export type FeedbackElement = z.infer<typeof feedbackElementSchema>;
export type FeedbackFileRequest = z.infer<typeof feedbackFileRequestSchema>;
export type FeedbackFileComplete = z.infer<typeof feedbackFileCompleteSchema>;
export type FeedbackVoiceNoteRequest = z.infer<
  typeof feedbackVoiceNoteRequestSchema
>;
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

/** POST /feedback/:id/files */
export type FeedbackFileUpload = { attachmentId: string; uploadUrl: string };

/** POST /feedback/:id/voice-notes — same presign shape as a file. */
export type FeedbackVoiceNoteUpload = {
  attachmentId: string;
  uploadUrl: string;
};

/**
 * GET /feedback/status. Both flags are false when file storage isn't set up:
 * `uploads` covers images and documents, `voiceNotes` the recorder.
 */
export type FeedbackStatusInfo = {
  enabled: boolean;
  uploads: boolean;
  voiceNotes: boolean;
};

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

/** 102 → "1:42" */
export const formatVoiceDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Which part of the item a stored attachment is: picture, document or voice note. */
export const feedbackFileKind = (mime: string): FeedbackFileKind =>
  mime.startsWith("audio/") ? "voice" : mime.startsWith("image/") ? "image" : "document";

/** Answers as [label, readable value] pairs, in the order the questions ask them. */
export const legacyDetailRows = (details: unknown): [string, string][] => {
  if (!details || typeof details !== "object") return [];
  const answers = details as Record<string, unknown>;
  const rows: [string, string][] = [];
  for (const field of LEGACY_FEEDBACK_DETAIL_FIELDS) {
    const raw = answers[field.key];
    if (typeof raw !== "string" || raw === "") continue;
    rows.push([field.label, field.choices?.[raw] ?? raw]);
  }
  return rows;
};

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
