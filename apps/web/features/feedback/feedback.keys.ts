import type { FeedbackListParams } from "./feedback.service";

export const feedbackKeys = {
  all: ["feedback"] as const,
  status: ["feedback", "status"] as const,
  mine: ["feedback", "mine"] as const,
  /** Unread count, per last-looked time — a new `seenAt` is a different question. */
  myUpdates: (seenAt: number) => ["feedback", "mine", "updates", seenAt] as const,
  summary: ["feedback", "summary"] as const,
  list: (params: FeedbackListParams) => ["feedback", "list", params] as const,
  detail: (id: string) => ["feedback", "detail", id] as const,
  comments: (id: string) => ["feedback", "comments", id] as const,
};
