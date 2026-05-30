import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventStatus,
  Prisma,
} from "@prisma/client";
import { db } from "../../../prisma/prisma.js";
import { enqueueNotificationDelivery, enqueueNotificationEvent } from "./queue.js";
import { resolveRecipients } from "./recipients.js";
import { sendViaProvider } from "./providers.js";
import { renderTemplate } from "./template.js";
import type { NotificationPayload, PublishNotificationEventInput } from "./types.js";

const payloadObject = (payload: Prisma.JsonValue): NotificationPayload => {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as NotificationPayload)
    : {};
};

const payloadString = (payload: NotificationPayload, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
};

const deliveryLinkUrl = (payload: NotificationPayload) => {
  return payloadString(payload, "linkUrl") || null;
};

export const publishNotificationEvent = async (
  input: PublishNotificationEventInput
) => {
  const event = await db.notificationEvent.upsert({
    where: input.dedupeKey
      ? { dedupeKey: input.dedupeKey }
      : { id: "__never_matches__" },
    create: {
      eventType: input.eventType,
      sourceModule: input.sourceModule,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      branchId: input.branchId,
      actorId: input.actorId,
      payload: input.payload as Prisma.InputJsonValue,
      dedupeKey: input.dedupeKey,
    },
    update: {},
  });

  await enqueueNotificationEvent(event.id).catch((error) => {
    console.error("[notifications] Failed to enqueue event:", event.id, error);
  });

  return event;
};

const isSubscribed = async (
  userId: string,
  eventType: string,
  channel: NotificationChannel,
  critical: boolean
) => {
  if (critical) return true;

  const subscription = await db.userNotificationSubscription.findUnique({
    where: { userId_eventType_channel: { userId, eventType, channel } },
  });

  return subscription?.subscribed ?? true;
};

export const fanoutNotificationEvent = async (eventId: string) => {
  const event = await db.notificationEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  const payload = payloadObject(event.payload);
  const rules = await db.notificationRule.findMany({
    where: {
      eventType: event.eventType,
      enabled: true,
      OR: [
        { sourceModule: null },
        { sourceModule: event.sourceModule },
      ],
      AND: [
        {
          OR: [
            { branchId: null },
            ...(event.branchId ? [{ branchId: event.branchId }] : []),
          ],
        },
      ],
    },
  });

  for (const rule of rules) {
    const recipientIds = await resolveRecipients(rule.recipientResolverKey, {
      branchId: event.branchId,
      actorId: event.actorId,
      payload,
    });

    for (const recipientUserId of recipientIds) {
      for (const channel of rule.channels) {
        if (
          !(await isSubscribed(
            recipientUserId,
            event.eventType,
            channel,
            rule.critical
          ))
        ) {
          continue;
        }

        const delivery = await db.notificationDelivery.upsert({
          where: {
            eventId_channel_recipientUserId: {
              eventId: event.id,
              channel,
              recipientUserId,
            },
          },
          create: {
            eventId: event.id,
            channel,
            recipientUserId,
          },
          update: {},
        });

        await enqueueNotificationDelivery(delivery.id).catch((error) => {
          console.error(
            "[notifications] Failed to enqueue delivery:",
            delivery.id,
            error
          );
        });
      }
    }
  }

  await db.notificationEvent.update({
    where: { id: event.id },
    data: {
      status: NotificationEventStatus.FANOUT_COMPLETE,
      processedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
};

export const processNotificationDelivery = async (deliveryId: string) => {
  const delivery = await db.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      recipient: {
        select: {
          id: true,
          email: true,
          mobile: true,
          emailOptIn: true,
          whatsappOptIn: true,
        },
      },
      event: true,
    },
  });

  if (!delivery || delivery.status === NotificationDeliveryStatus.SENT) return;

  const payload = payloadObject(delivery.event.payload);
  const template = await db.notificationTemplate.findFirst({
    where: {
      code: delivery.event.eventType,
      channel: delivery.channel,
    },
    orderBy: { updatedAt: "desc" },
  });
  const rendered = renderTemplate(template, payload);
  const rule = await db.notificationRule.findFirst({
    where: {
      eventType: delivery.event.eventType,
      enabled: true,
      channels: { has: delivery.channel },
    },
    orderBy: { updatedAt: "desc" },
  });

  try {
    const result = await sendViaProvider(delivery.channel, {
      delivery,
      recipient: delivery.recipient,
      rendered,
      severity: rule?.severity || "INFO",
      linkUrl: deliveryLinkUrl(payload),
    });

    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: result.skipped
        ? {
            status: NotificationDeliveryStatus.SKIPPED,
            lastError: result.reason,
            attemptCount: { increment: 1 },
          }
        : {
            status: NotificationDeliveryStatus.SENT,
            providerMessageId: result.providerMessageId,
            sentAt: new Date(),
            attemptCount: { increment: 1 },
          },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery failed";
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        failedAt: new Date(),
        lastError: message,
        attemptCount: { increment: 1 },
      },
    });
    throw error;
  }
};

export const markInAppNotificationRead = async (
  userId: string,
  id: string
) => {
  return db.inAppNotification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
};

export const markAllInAppNotificationsRead = async (userId: string) => {
  return db.inAppNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
};
