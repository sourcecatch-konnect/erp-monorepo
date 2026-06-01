import type { AxiosInstance } from "axios";
import type {
  ApiResponse,
  InAppNotification,
  NotificationChannel,
  NotificationList,
  NotificationMetadata,
  NotificationPreferences,
  NotificationRule,
  NotificationSetupStatus,
  NotificationSeverity,
  NotificationTemplate,
  WhatsAppConfig,
} from "./types";

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => {
  const body = response.data as ApiResponse<T>;
  return typeof body === "object" && body && "ok" in body ? body.data : (response.data as T);
};

const unwrapList = <T>(response: {
  data: ApiResponse<T[]>;
}): NotificationList<T> => ({
  data: response.data.data,
  meta: response.data.meta || { page: 0, size: response.data.data.length, total: response.data.data.length },
});

export type InboxParams = {
  page?: number;
  size?: number;
  unread?: boolean;
  severity?: NotificationSeverity | "ALL";
};

export const createNotificationApi = (api: AxiosInstance) => ({
  listInbox: async (params: InboxParams = {}) => {
    const response = await api.get<ApiResponse<InAppNotification[]>>("/notifications/inbox", {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 25,
        unread: params.unread ? "true" : undefined,
        severity: params.severity && params.severity !== "ALL" ? params.severity : undefined,
      },
    });
    return unwrapList(response);
  },
  unreadCount: async () =>
    unwrap<{ count: number }>(await api.get("/notifications/inbox/unread-count")),
  markRead: async (id: string) =>
    unwrap<{ success: boolean }>(await api.patch(`/notifications/inbox/${id}/read`)),
  markAllRead: async () =>
    unwrap<{ updatedCount: number }>(await api.post("/notifications/inbox/mark-all-read")),
  archive: async (id: string) =>
    unwrap<{ success: boolean }>(await api.patch(`/notifications/inbox/${id}/archive`)),
  preferences: async () =>
    unwrap<NotificationPreferences>(await api.get("/notifications/preferences")),
  updatePreferences: async (body: {
    mobile?: string | null;
    emailOptIn?: boolean;
    whatsappOptIn?: boolean;
    subscriptions?: { eventType: string; channel: NotificationChannel; subscribed: boolean }[];
  }) => unwrap<{ success: boolean }>(await api.patch("/notifications/preferences", body)),
  metadata: async () =>
    unwrap<NotificationMetadata>(await api.get("/notifications/metadata")),
  setupStatus: async () =>
    unwrap<NotificationSetupStatus>(await api.get("/notifications/setup/status")),
  rules: async () =>
    unwrap<NotificationRule[]>(await api.get("/notifications/rules")),
  updateRule: async ({
    id,
    body,
  }: {
    id: string;
    body: Partial<Pick<NotificationRule, "enabled" | "severity" | "critical" | "recipientResolverKey" | "channels" | "templateId">>;
  }) => unwrap<NotificationRule>(await api.patch(`/notifications/rules/${id}`, body)),
  templates: async () =>
    unwrap<NotificationTemplate[]>(await api.get("/notifications/templates")),
  updateTemplate: async ({
    id,
    body,
  }: {
    id: string;
    body: Partial<Pick<NotificationTemplate, "subject" | "body" | "meta">>;
  }) => unwrap<NotificationTemplate>(await api.patch(`/notifications/templates/${id}`, body)),
  whatsappConfig: async () =>
    unwrap<WhatsAppConfig>(await api.get("/notifications/setup/whatsapp-config")),
  saveWhatsappDraft: async ({
    id,
    body,
  }: {
    id: string;
    body: {
      body: string;
      metaName?: string;
      metaLanguage?: string;
      metaFooter?: string | null;
    };
  }) =>
    unwrap<NotificationTemplate>(
      await api.patch(`/notifications/templates/${id}/whatsapp`, body)
    ),
  submitWhatsappTemplate: async (id: string) =>
    unwrap<NotificationTemplate>(
      await api.post(`/notifications/templates/${id}/whatsapp/submit`)
    ),
  deleteWhatsappTemplate: async (id: string) =>
    unwrap<NotificationTemplate>(
      await api.delete(`/notifications/templates/${id}/whatsapp`)
    ),
  syncWhatsappTemplates: async () =>
    unwrap<NotificationTemplate[]>(
      await api.post("/notifications/templates/whatsapp/sync")
    ),
  testSend: async (body: {
    recipientUserId: string;
    channels: NotificationChannel[];
    title?: string;
    message?: string;
    eventType?: string;
    payload?: Record<string, unknown>;
  }) => unwrap<unknown>(await api.post("/notifications/test-send", body)),
});

export type NotificationApi = ReturnType<typeof createNotificationApi>;
