import type { InboxParams } from "./api";

const all = ["notifications"] as const;
export const notificationKeys = {
  all,
  inbox: (params: InboxParams) => [...all, "inbox", params] as const,
  unreadCount: [...all, "unread-count"] as const,
  preferences: [...all, "preferences"] as const,
  metadata: [...all, "metadata"] as const,
  setupStatus: [...all, "setup-status"] as const,
  rules: [...all, "rules"] as const,
  templates: [...all, "templates"] as const,
  whatsappConfig: [...all, "whatsapp-config"] as const,
};
