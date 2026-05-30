import { NotificationChannel, NotificationSeverity } from "@prisma/client";
import { db } from "../../../prisma/prisma.js";
import type { RuleSeed } from "./types.js";

const templateBodies: Record<string, { subject: string; body: string }> = {
  "notification.test": {
    subject: "{{title}}",
    body: "{{message}}",
  },
  "order.confirmed": {
    subject: "Order confirmed",
    body: "Order {{orderNumber}} has been confirmed.",
  },
  "order.rejected": {
    subject: "Order rejected",
    body: "Order {{orderNumber}} has been rejected.",
  },
  "lr.finalised": {
    subject: "LR finalised",
    body: "LR {{lrNumber}} has been finalised.",
  },
  "lr.delivered": {
    subject: "LR delivered",
    body: "LR {{lrNumber}} has been delivered.",
  },
  "lr.pod_uploaded": {
    subject: "POD uploaded",
    body: "POD has been uploaded for LR {{lrNumber}}.",
  },
  "trip.created": {
    subject: "Trip created",
    body: "Trip {{tripNumber}} has been created.",
  },
  "trip.closed": {
    subject: "Trip closed",
    body: "Trip {{tripNumber}} has been closed.",
  },
  "trip.close_blocked": {
    subject: "Trip close blocked",
    body: "Trip {{tripNumber}} cannot close: {{reason}}.",
  },
  "driver.dl.expiring": {
    subject: "Driver DL expiring",
    body: "Driver {{driverName}} DL expires on {{expiryDate}}.",
  },
  "vehicle.document.expiring": {
    subject: "Vehicle document expiring",
    body: "{{documentType}} for vehicle {{vehicleNumber}} expires on {{expiryDate}}.",
  },
  "ewaybill.expiring": {
    subject: "E-way bill expiring",
    body: "E-way bill {{ewaybillNo}} expires on {{expiryDate}}.",
  },
  "sla.breached": {
    subject: "SLA breached",
    body: "{{entityType}} {{entityNumber}} has breached SLA.",
  },
};

const defaultChannels = [
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
] as const;

const rules: RuleSeed[] = [
  {
    eventType: "order.confirmed",
    name: "Order confirmed",
    severity: NotificationSeverity.SUCCESS,
    recipientResolverKey: "order.creator",
    channels: [...defaultChannels],
    templateCode: "order.confirmed",
  },
  {
    eventType: "order.rejected",
    name: "Order rejected",
    severity: NotificationSeverity.WARNING,
    recipientResolverKey: "order.creator",
    channels: [...defaultChannels],
    templateCode: "order.rejected",
  },
  {
    eventType: "lr.finalised",
    name: "LR finalised",
    severity: NotificationSeverity.INFO,
    recipientResolverKey: "toBranch.users",
    channels: [...defaultChannels],
    templateCode: "lr.finalised",
  },
  {
    eventType: "lr.delivered",
    name: "LR delivered",
    severity: NotificationSeverity.SUCCESS,
    recipientResolverKey: "lr.creator",
    channels: [...defaultChannels],
    templateCode: "lr.delivered",
  },
  {
    eventType: "lr.pod_uploaded",
    name: "LR POD uploaded",
    severity: NotificationSeverity.SUCCESS,
    recipientResolverKey: "lr.creator",
    channels: [...defaultChannels],
    templateCode: "lr.pod_uploaded",
  },
  {
    eventType: "trip.created",
    name: "Trip created",
    severity: NotificationSeverity.INFO,
    recipientResolverKey: "fromBranch.users",
    channels: [NotificationChannel.IN_APP],
    templateCode: "trip.created",
  },
  {
    eventType: "trip.closed",
    name: "Trip closed",
    severity: NotificationSeverity.SUCCESS,
    recipientResolverKey: "fromBranch.users",
    channels: [...defaultChannels],
    templateCode: "trip.closed",
  },
  {
    eventType: "trip.close_blocked",
    name: "Trip close blocked",
    severity: NotificationSeverity.WARNING,
    recipientResolverKey: "actor",
    channels: [NotificationChannel.IN_APP],
    templateCode: "trip.close_blocked",
  },
  {
    eventType: "driver.dl.expiring",
    name: "Driver DL expiring",
    severity: NotificationSeverity.CRITICAL,
    critical: true,
    recipientResolverKey: "role:Branch Manager@branch",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ],
    templateCode: "driver.dl.expiring",
  },
  {
    eventType: "vehicle.document.expiring",
    name: "Vehicle document expiring",
    severity: NotificationSeverity.CRITICAL,
    critical: true,
    recipientResolverKey: "role:Branch Manager@branch",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ],
    templateCode: "vehicle.document.expiring",
  },
  {
    eventType: "ewaybill.expiring",
    name: "E-way bill expiring",
    severity: NotificationSeverity.CRITICAL,
    critical: true,
    recipientResolverKey: "toBranch.users",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ],
    templateCode: "ewaybill.expiring",
  },
  {
    eventType: "sla.breached",
    name: "SLA breached",
    severity: NotificationSeverity.CRITICAL,
    critical: true,
    recipientResolverKey: "role:Branch Manager@branch",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ],
    templateCode: "sla.breached",
  },
];

export const seedNotificationDefaults = async () => {
  for (const [code, template] of Object.entries(templateBodies)) {
    for (const channel of Object.values(NotificationChannel)) {
      await db.notificationTemplate.upsert({
        where: { code_channel: { code, channel } },
        create: {
          code,
          channel,
          subject: template.subject,
          body: template.body,
        },
        update: {},
      });
    }
  }

  for (const rule of rules) {
    const template = await db.notificationTemplate.findUnique({
      where: { code_channel: { code: rule.templateCode, channel: NotificationChannel.IN_APP } },
      select: { id: true },
    });

    await db.notificationRule.upsert({
      where: { id: `seed:${rule.eventType}` },
      create: {
        id: `seed:${rule.eventType}`,
        eventType: rule.eventType,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        critical: rule.critical ?? false,
        recipientResolverKey: rule.recipientResolverKey,
        channels: rule.channels,
        templateId: template?.id,
      },
      update: {},
    });
  }
};
