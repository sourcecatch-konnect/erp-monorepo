import { Router } from "express";
import { NotificationChannel, Prisma } from "@prisma/client";
import { PERMS } from "@skerp/types";
import { z } from "zod";
import { db } from "../../../prisma/prisma.js";
import { can } from "../../auth/can.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { BadRequestError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import {
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  publishNotificationEvent,
} from "./notification.service.js";
import {
  receiveWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from "./whatsapp.webhook.js";

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(25),
  unread: z.enum(["true", "false"]).optional(),
  severity: z.enum(["INFO", "SUCCESS", "WARNING", "CRITICAL"]).optional(),
});

const ruleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  severity: z.enum(["INFO", "SUCCESS", "WARNING", "CRITICAL"]).optional(),
  critical: z.boolean().optional(),
  recipientResolverKey: z.string().min(1).optional(),
  channels: z.array(z.nativeEnum(NotificationChannel)).min(1).optional(),
  templateId: z.string().nullable().optional(),
});

const templateUpdateSchema = z.object({
  subject: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  meta: z.unknown().optional(),
});

const preferencesSchema = z.object({
  emailOptIn: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  mobile: z.string().nullable().optional(),
  subscriptions: z
    .array(
      z.object({
        eventType: z.string().min(1),
        channel: z.nativeEnum(NotificationChannel),
        subscribed: z.boolean(),
      })
    )
    .optional(),
});

const testSendSchema = z.object({
  recipientUserId: z.string().min(1),
  channels: z.array(z.nativeEnum(NotificationChannel)).min(1),
  title: z.string().default("SKERP test notification"),
  message: z.string().default("This is a test notification from SKERP."),
});

router.get("/whatsapp/webhook", verifyWhatsAppWebhook);
router.post("/whatsapp/webhook", receiveWhatsAppWebhook);

router.use(authMiddleware);

router.get("/inbox", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const where = {
    userId,
    archivedAt: null,
    ...(parsed.data.unread === "true" ? { readAt: null } : {}),
    ...(parsed.data.severity ? { severity: parsed.data.severity } : {}),
  };

  const [data, total] = await Promise.all([
    db.inAppNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: parsed.data.page * parsed.data.size,
      take: parsed.data.size,
    }),
    db.inAppNotification.count({ where }),
  ]);

  return sendOk(res, data, {
    page: parsed.data.page,
    size: parsed.data.size,
    total,
  });
});

router.patch("/inbox/:id/read", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const result = await markInAppNotificationRead(userId, req.params.id as string);
  if (result.count === 0) throw new NotFoundError("Notification not found");

  return sendOk(res, { success: true });
});

router.post("/inbox/mark-all-read", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const result = await markAllInAppNotificationsRead(userId);
  return sendOk(res, { updatedCount: result.count });
});

router.get("/preferences", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const [user, subscriptions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        mobile: true,
        emailOptIn: true,
        whatsappOptIn: true,
        notificationQuietHoursStart: true,
        notificationQuietHoursEnd: true,
      },
    }),
    db.userNotificationSubscription.findMany({
      where: { userId },
      orderBy: [{ eventType: "asc" }, { channel: "asc" }],
    }),
  ]);

  return sendOk(res, { user, subscriptions });
});

router.patch("/preferences", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const { subscriptions, ...userData } = parsed.data;
  const updates = [];

  if (Object.keys(userData).length) {
    updates.push(db.user.update({ where: { id: userId }, data: userData }));
  }

  if (subscriptions?.length) {
    updates.push(
      ...subscriptions.map((subscription) =>
        db.userNotificationSubscription.upsert({
          where: {
            userId_eventType_channel: {
              userId,
              eventType: subscription.eventType,
              channel: subscription.channel,
            },
          },
          create: { userId, ...subscription },
          update: { subscribed: subscription.subscribed },
        })
      )
    );
  }

  await Promise.all(updates);
  return sendOk(res, { success: true });
});

router.get("/rules", can(PERMS.NOTIFICATIONS.MANAGE_RULES), async (_req, res) => {
  const rules = await db.notificationRule.findMany({
    include: { template: true },
    orderBy: [{ eventType: "asc" }, { name: "asc" }],
  });
  return sendOk(res, rules);
});

router.patch("/rules/:id", can(PERMS.NOTIFICATIONS.MANAGE_RULES), async (req, res) => {
  const parsed = ruleUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const rule = await db.notificationRule.update({
    where: { id: req.params.id as string },
    data: parsed.data,
  });
  return sendOk(res, rule);
});

router.get(
  "/templates",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (_req, res) => {
    const templates = await db.notificationTemplate.findMany({
      orderBy: [{ code: "asc" }, { channel: "asc" }],
    });
    return sendOk(res, templates);
  }
);

router.patch(
  "/templates/:id",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (req, res) => {
    const parsed = templateUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const template = await db.notificationTemplate.update({
      where: { id: req.params.id as string },
      data: {
        ...parsed.data,
        meta:
          parsed.data.meta === undefined
            ? undefined
            : (parsed.data.meta as Prisma.InputJsonValue),
      },
    });
    return sendOk(res, template);
  }
);

router.post("/test-send", can(PERMS.NOTIFICATIONS.TEST_SEND), async (req, res) => {
  const parsed = testSendSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const template = await db.notificationTemplate.findFirst({
    where: { code: "notification.test", channel: "IN_APP" },
  });

  const rule = await db.notificationRule.upsert({
    where: { id: "__notification_test_rule__" },
    create: {
      id: "__notification_test_rule__",
      eventType: "notification.test",
      name: "Notification test send",
      severity: "INFO",
      recipientResolverKey: "order.creator",
      channels: parsed.data.channels,
      templateId: template?.id,
    },
    update: { channels: parsed.data.channels, enabled: true },
  });

  const event = await publishNotificationEvent({
    eventType: "notification.test",
    sourceModule: "notifications",
    aggregateType: "User",
    aggregateId: parsed.data.recipientUserId,
    actorId: req.user?.userId,
    payload: {
      title: parsed.data.title,
      message: parsed.data.message,
      createdById: parsed.data.recipientUserId,
    },
    dedupeKey: `notification.test:${parsed.data.recipientUserId}:${Date.now()}`,
  });

  return sendOk(res, { event, rule }, undefined, 201);
});

export default router;
