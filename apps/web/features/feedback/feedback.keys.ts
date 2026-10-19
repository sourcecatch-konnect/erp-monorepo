import type { FeedbackListParams } from "./feedback.service";

export const feedbackKeys = {
  all: ["feedback"] as const,
  status: ["feedback", "status"] as const,
  mine: ["feedback", "mine"] as const,
  summary: ["feedback", "summary"] as const,
  list: (params: FeedbackListParams) => ["feedback", "list", params] as const,
  detail: (id: string) => ["feedback", "detail", id] as const,
};
