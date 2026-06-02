import type {
  NotificationChannel,
  NotificationSeverity,
} from "@prisma/client";

export type NotificationPayload = Record<string, unknown>;

export type PublishNotificationEventInput = {
  eventType: string;
  sourceModule: string;
  aggregateType: string;
  aggregateId: string;
  branchId?: string | null;
  actorId?: string | null;
  payload: NotificationPayload;
  dedupeKey?: string | null;
};

export type RenderedNotification = {
  subject?: string;
  body: string;
  // WhatsApp-specific: resolved positional params + the Meta template to send.
  whatsapp?: {
    metaName: string | null;
    metaLanguage: string;
    metaStatus: string | null;
    params: string[];
  };
};

export type DeliveryJob = {
  deliveryId: string;
};

export type EventFanoutJob = {
  eventId: string;
};

export type RuleSeed = {
  eventType: string;
  name: string;
  severity: NotificationSeverity;
  critical?: boolean;
  recipientResolverKey: string;
  channels: NotificationChannel[];
  templateCode: string;
  description?: string;
};
