import { Router } from "express";
import {
  NotificationChannel,
  Prisma,
} from "../../../generated/prisma/index.js";
import { PERMS } from "@skerp/types";
import { z } from "zod";
import { db } from "../../../prisma/prisma.js";
import { getRedisConnectionOptions } from "./redis.js";
import { can } from "../../auth/can.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import {
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  publishNotificationEvent,
} from "./notification.service.js";
import { enqueueNotificationDelivery } from "./queue.js";
import {
  receiveWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from "./whatsapp.webhook.js";
import {
  buildPositionalBody,
  createMetaTemplate,
  deleteMetaTemplate,
  editMetaTemplate,
  isMetaConfigured,
  listMetaTemplates,
  normaliseMetaStatus,
} from "./whatsapp.templates.js";

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

const whatsappDraftSchema = z.object({
  metaName: z
    .string()
    .regex(
      /^[a-z0-9_]+$/,
      "Use lowercase letters, numbers and underscores only",
    )
    .max(512)
    .optional(),
  metaLanguage: z.string().min(2).max(10).optional(),
  metaFooter: z.string().max(60).nullable().optional(),
  body: z.string().min(1),
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
      }),
    )
    .optional(),
});

const testSendSchema = z.object({
  recipientUserId: z.string().min(1),
  channels: z.array(z.nativeEnum(NotificationChannel)).min(1),
  // Quick-test fields (used when eventType is omitted / "notification.test").
  title: z.string().default("SKERP test notification"),
  message: z.string().default("This is a test notification from SKERP."),
  // Event-test fields: send through a real event's templates with sample values.
  eventType: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

router.get("/whatsapp/webhook", verifyWhatsAppWebhook);
router.post("/whatsapp/webhook", receiveWhatsAppWebhook);

router.use(authMiddleware);

const notificationMetadata = {
  channels: ["IN_APP", "EMAIL", "WHATSAPP"],
  severities: ["INFO", "SUCCESS", "WARNING", "CRITICAL"],
  recipientResolvers: [
    { key: "actor", label: "Actor" },
    { key: "order.creator", label: "Order creator" },
    { key: "lr.creator", label: "LR creator" },
    { key: "fromBranch.users", label: "From branch users" },
    { key: "toBranch.users", label: "To branch users" },
    { key: "subscribers", label: "Branch subscribers" },
    { key: "role:Branch Manager@branch", label: "Branch managers" },
  ],
  templateVariables: {
    notification_test: ["title", "message"],
    "order.confirmed": ["orderNumber"],
    "order.rejected": ["orderNumber"],
    "lr.finalised": ["lrNumber"],
    "lr.delivered": ["lrNumber"],
    "lr.pod_uploaded": ["lrNumber"],
    "trip.created": ["tripNumber"],
    "trip.closed": ["tripNumber"],
    "trip.close_blocked": ["tripNumber", "reason"],
    "driver.dl.expiring": ["driverName", "expiryDate"],
    "vehicle.document.expiring": [
      "documentType",
      "vehicleNumber",
      "expiryDate",
    ],
    "ewaybill.expiring": ["ewaybillNo", "expiryDate"],
    "sla.breached": ["entityType", "entityNumber"],
  },
};

router.get("/metadata", async (_req, res) => {
  const eventTypes = await db.notificationRule.findMany({
    distinct: ["eventType"],
    select: { eventType: true, critical: true },
    orderBy: { eventType: "asc" },
  });

  return sendOk(res, {
    ...notificationMetadata,
    eventTypes,
  });
});

router.get(
  "/setup/status",
  can(PERMS.NOTIFICATIONS.MANAGE_RULES),
  async (_req, res) => {
    const redis = getRedisConnectionOptions();
    return sendOk(res, {
      redis: {
        configured: Boolean(process.env.REDIS_URL),
        host: redis.host,
        port: redis.port,
      },
      ses: {
        configured: Boolean(process.env.AWS_REGION && process.env.MAIL_FROM),
        region: process.env.AWS_REGION || null,
        mailFromConfigured: Boolean(process.env.MAIL_FROM),
      },
      metaWhatsApp: {
        configured: Boolean(
          process.env.META_WHATSAPP_API_BASE_URL &&
          process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
          process.env.META_WHATSAPP_ACCESS_TOKEN &&
          process.env.META_WHATSAPP_DEFAULT_TEMPLATE_NAME,
        ),
        apiBaseUrl: process.env.META_WHATSAPP_API_BASE_URL || null,
        phoneNumberIdConfigured: Boolean(
          process.env.META_WHATSAPP_PHONE_NUMBER_ID,
        ),
        businessAccountIdConfigured: Boolean(
          process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
        ),
        defaultLanguage: process.env.META_WHATSAPP_DEFAULT_LANGUAGE || "en_US",
        defaultTemplateName:
          process.env.META_WHATSAPP_DEFAULT_TEMPLATE_NAME || null,
        webhookVerifyTokenConfigured: Boolean(
          process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        ),
        appSecretConfigured: Boolean(process.env.META_WHATSAPP_APP_SECRET),
      },
    });
  },
);

router.get("/inbox/unread-count", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const count = await db.inAppNotification.count({
    where: { userId, readAt: null, archivedAt: null },
  });

  return sendOk(res, { count });
});

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

  const result = await markInAppNotificationRead(
    userId,
    req.params.id as string,
  );
  if (result.count === 0) throw new NotFoundError("Notification not found");

  return sendOk(res, { success: true });
});

router.patch("/inbox/:id/archive", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new BadRequestError("User context is missing");

  const result = await db.inAppNotification.updateMany({
    where: { id: req.params.id as string, userId },
    data: { archivedAt: new Date() },
  });
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
        }),
      ),
    );
  }

  await Promise.all(updates);
  return sendOk(res, { success: true });
});

router.get(
  "/rules",
  can(PERMS.NOTIFICATIONS.MANAGE_RULES),
  async (_req, res) => {
    const rules = await db.notificationRule.findMany({
      include: { template: true },
      orderBy: [{ eventType: "asc" }, { name: "asc" }],
    });
    return sendOk(res, rules);
  },
);

router.patch(
  "/rules/:id",
  can(PERMS.NOTIFICATIONS.MANAGE_RULES),
  async (req, res) => {
    const parsed = ruleUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const rule = await db.notificationRule.update({
      where: { id: req.params.id as string },
      data: parsed.data,
    });
    return sendOk(res, rule);
  },
);

router.get(
  "/templates",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (_req, res) => {
    const templates = await db.notificationTemplate.findMany({
      orderBy: [{ code: "asc" }, { channel: "asc" }],
    });
    return sendOk(res, templates);
  },
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
  },
);

const allowedVariablesFor = (code: string): string[] =>
  (notificationMetadata.templateVariables as Record<string, string[]>)[code] ||
  [];

const defaultMetaName = (code: string) =>
  code.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

router.get(
  "/setup/whatsapp-config",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (_req, res) => {
    return sendOk(res, {
      configured: isMetaConfigured(),
      apiBaseUrlConfigured: Boolean(process.env.META_WHATSAPP_API_BASE_URL),
      wabaIdConfigured: Boolean(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID),
      tokenConfigured: Boolean(
        process.env.META_WHATSAPP_MANAGEMENT_TOKEN ||
        process.env.META_WHATSAPP_ACCESS_TOKEN,
      ),
      defaultLanguage: process.env.META_WHATSAPP_DEFAULT_LANGUAGE || "en_US",
    });
  },
);

// Save a WhatsApp template draft locally (does not submit to Meta).
router.patch(
  "/templates/:id/whatsapp",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (req, res) => {
    const parsed = whatsappDraftSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const template = await db.notificationTemplate.findUnique({
      where: { id: req.params.id as string },
    });
    if (!template) throw new NotFoundError("Template not found");
    if (template.channel !== NotificationChannel.WHATSAPP) {
      throw new BadRequestError("Not a WhatsApp template");
    }

    // Validate variables (throws on unknown) and capture their order.
    const { paramOrder } = buildPositionalBody(
      parsed.data.body,
      allowedVariablesFor(template.code),
    );

    const updated = await db.notificationTemplate.update({
      where: { id: template.id },
      data: {
        body: parsed.data.body,
        metaName:
          parsed.data.metaName ||
          template.metaName ||
          defaultMetaName(template.code),
        metaLanguage:
          parsed.data.metaLanguage ||
          template.metaLanguage ||
          process.env.META_WHATSAPP_DEFAULT_LANGUAGE ||
          "en_US",
        metaCategory: template.metaCategory || "UTILITY",
        metaFooter: parsed.data.metaFooter ?? template.metaFooter,
        metaParamOrder: paramOrder,
        metaStatus: "DRAFT",
      },
    });
    return sendOk(res, updated);
  },
);

// Create-or-edit the template on Meta and mark it PENDING.
router.post(
  "/templates/:id/whatsapp/submit",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (req, res) => {
    const template = await db.notificationTemplate.findUnique({
      where: { id: req.params.id as string },
    });
    if (!template) throw new NotFoundError("Template not found");
    if (template.channel !== NotificationChannel.WHATSAPP) {
      throw new BadRequestError("Not a WhatsApp template");
    }

    const metaName = template.metaName || defaultMetaName(template.code);
    const metaLanguage =
      template.metaLanguage ||
      process.env.META_WHATSAPP_DEFAULT_LANGUAGE ||
      "en_US";
    const metaCategory = template.metaCategory || "UTILITY";

    const { positionalBody, paramOrder } = buildPositionalBody(
      template.body,
      allowedVariablesFor(template.code),
    );

    if (template.metaTemplateId) {
      await editMetaTemplate(template.metaTemplateId, {
        category: metaCategory,
        positionalBody,
        paramOrder,
        footer: template.metaFooter,
      });
    } else {
      const created = await createMetaTemplate({
        name: metaName,
        language: metaLanguage,
        category: metaCategory,
        positionalBody,
        paramOrder,
        footer: template.metaFooter,
      });
      if (created.id) template.metaTemplateId = created.id;
    }

    const updated = await db.notificationTemplate.update({
      where: { id: template.id },
      data: {
        metaName,
        metaLanguage,
        metaCategory,
        metaParamOrder: paramOrder,
        metaTemplateId: template.metaTemplateId,
        metaStatus: "PENDING",
        metaRejectedReason: null,
        metaSubmittedAt: new Date(),
      },
    });
    return sendOk(res, updated);
  },
);

// Delete the template on Meta and clear local Meta state (keeps the row).
router.delete(
  "/templates/:id/whatsapp",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (req, res) => {
    const template = await db.notificationTemplate.findUnique({
      where: { id: req.params.id as string },
    });
    if (!template) throw new NotFoundError("Template not found");
    if (template.channel !== NotificationChannel.WHATSAPP) {
      throw new BadRequestError("Not a WhatsApp template");
    }

    if (template.metaName && (template.metaTemplateId || template.metaStatus)) {
      await deleteMetaTemplate(template.metaName, template.metaTemplateId);
    }

    const updated = await db.notificationTemplate.update({
      where: { id: template.id },
      data: {
        metaTemplateId: null,
        metaStatus: "DRAFT",
        metaRejectedReason: null,
        metaSubmittedAt: null,
        metaSyncedAt: null,
      },
    });
    return sendOk(res, updated);
  },
);

// Pull live statuses from Meta and reconcile all WhatsApp template rows.
router.post(
  "/templates/whatsapp/sync",
  can(PERMS.NOTIFICATIONS.MANAGE_TEMPLATES),
  async (_req, res) => {
    const remote = await listMetaTemplates();
    const byName = new Map(remote.map((item) => [item.name, item]));

    const rows = await db.notificationTemplate.findMany({
      where: { channel: NotificationChannel.WHATSAPP, metaName: { not: null } },
    });

    const now = new Date();
    await Promise.all(
      rows.map((row) => {
        const match = row.metaName ? byName.get(row.metaName) : undefined;
        if (!match) {
          // Submitted rows with no remote match are left as-is; drafts stay drafts.
          return db.notificationTemplate.update({
            where: { id: row.id },
            data: { metaSyncedAt: now },
          });
        }
        return db.notificationTemplate.update({
          where: { id: row.id },
          data: {
            metaStatus: normaliseMetaStatus(match.status),
            metaTemplateId: match.id || row.metaTemplateId,
            metaCategory: match.category || row.metaCategory,
            metaLanguage: match.language || row.metaLanguage,
            metaRejectedReason: match.rejected_reason || null,
            metaSyncedAt: now,
          },
        });
      }),
    );

    const templates = await db.notificationTemplate.findMany({
      orderBy: [{ code: "asc" }, { channel: "asc" }],
    });
    return sendOk(res, templates);
  },
);

router.post(
  "/test-send",
  can(PERMS.NOTIFICATIONS.TEST_SEND),
  async (req, res) => {
    const parsed = testSendSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.flatten());

    const { recipientUserId, channels } = parsed.data;
    const isEventTest =
      Boolean(parsed.data.eventType) &&
      parsed.data.eventType !== "notification_test";

    // Event test: deliver a real event's templates to the chosen recipient over the
    // chosen channels, WITHOUT triggering real rules (which would notify real users).
    // We create the event + deliveries directly and enqueue them, bypassing fanout.
    if (isEventTest) {
      const eventType = parsed.data.eventType as string;
      const event = await db.notificationEvent.create({
        data: {
          eventType,
          sourceModule: "notifications.test",
          aggregateType: "User",
          aggregateId: recipientUserId,
          actorId: req.user?.userId,
          payload: {
            ...(parsed.data.payload || {}),
            createdById: recipientUserId,
          } as Prisma.InputJsonValue,
          status: "FANOUT_COMPLETE",
          processedAt: new Date(),
        },
      });

      const deliveries = await Promise.all(
        channels.map((channel) =>
          db.notificationDelivery.upsert({
            where: {
              eventId_channel_recipientUserId: {
                eventId: event.id,
                channel,
                recipientUserId,
              },
            },
            create: { eventId: event.id, channel, recipientUserId },
            update: {},
          }),
        ),
      );

      await Promise.all(
        deliveries.map((delivery) =>
          enqueueNotificationDelivery(delivery.id).catch((error) => {
            console.error(
              "[notifications] Failed to enqueue test delivery:",
              delivery.id,
              error,
            );
          }),
        ),
      );

      return sendOk(res, { event, deliveries }, undefined, 201);
    }

    // Quick test: ad-hoc title/message through the dedicated notification.test template.
    const template = await db.notificationTemplate.findFirst({
      where: { code: "notification_test", channel: "IN_APP" },
    });

    const rule = await db.notificationRule.upsert({
      where: { id: "__notification_test_rule__" },
      create: {
        id: "__notification_test_rule__",
        eventType: "notification_test",
        name: "Notification test send",
        severity: "INFO",
        recipientResolverKey: "order.creator",
        channels,
        templateId: template?.id,
      },
      update: { channels, enabled: true },
    });

    const event = await publishNotificationEvent({
      eventType: "notification_test",
      sourceModule: "notifications",
      aggregateType: "User",
      aggregateId: recipientUserId,
      actorId: req.user?.userId,
      payload: {
        title: parsed.data.title,
        message: parsed.data.message,
        createdById: recipientUserId,
      },
      dedupeKey: `notification_test:${recipientUserId}:${Date.now()}`,
    });

    return sendOk(res, { event, rule }, undefined, 201);
  },
);

export default router;
