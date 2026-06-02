export type NotificationChannel = "IN_APP" | "EMAIL" | "WHATSAPP";
export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";

export type ListMeta = {
  page: number;
  size: number;
  total: number;
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  meta?: ListMeta;
};

export type NotificationList<T> = {
  data: T[];
  meta: ListMeta;
};

export type InAppNotification = {
  id: string;
  deliveryId: string;
  userId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  linkUrl: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type MetaTemplateStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DISABLED";

export type NotificationTemplate = {
  id: string;
  code: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  meta?: unknown;
  createdAt: string;
  updatedAt: string;
  // Meta WhatsApp lifecycle (present only on WHATSAPP-channel rows).
  metaName: string | null;
  metaLanguage: string | null;
  metaCategory: string | null;
  metaStatus: MetaTemplateStatus | null;
  metaTemplateId: string | null;
  metaRejectedReason: string | null;
  metaParamOrder: string[];
  metaFooter: string | null;
  metaSubmittedAt: string | null;
  metaSyncedAt: string | null;
};

export type WhatsAppConfig = {
  configured: boolean;
  apiBaseUrlConfigured: boolean;
  wabaIdConfigured: boolean;
  tokenConfigured: boolean;
  defaultLanguage: string;
};

export type NotificationRule = {
  id: string;
  eventType: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: NotificationSeverity;
  critical: boolean;
  recipientResolverKey: string;
  channels: NotificationChannel[];
  templateId: string | null;
  sourceModule: string | null;
  branchId: string | null;
  template?: NotificationTemplate | null;
};

export type NotificationPreferences = {
  user: {
    mobile: string | null;
    emailOptIn: boolean;
    whatsappOptIn: boolean;
    notificationQuietHoursStart: string | null;
    notificationQuietHoursEnd: string | null;
  } | null;
  subscriptions: {
    userId: string;
    eventType: string;
    channel: NotificationChannel;
    subscribed: boolean;
  }[];
};

export type NotificationMetadata = {
  channels: NotificationChannel[];
  severities: NotificationSeverity[];
  recipientResolvers: { key: string; label: string }[];
  eventTypes: { eventType: string; critical: boolean }[];
  templateVariables: Record<string, string[]>;
};

export type NotificationSetupStatus = {
  redis: { configured: boolean; host: string; port: number };
  ses: { configured: boolean; region: string | null; mailFromConfigured: boolean };
  metaWhatsApp: {
    configured: boolean;
    apiBaseUrl: string | null;
    phoneNumberIdConfigured: boolean;
    businessAccountIdConfigured: boolean;
    defaultLanguage: string;
    defaultTemplateName: string | null;
    webhookVerifyTokenConfigured: boolean;
    appSecretConfigured: boolean;
  };
};

export type UserOption = {
  id: string;
  label: string;
  email?: string;
};
