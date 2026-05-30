import {
  SendEmailCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import type {
  NotificationChannel,
  NotificationDelivery,
  User,
} from "@prisma/client";
import { db } from "../../../prisma/prisma.js";
import { emitInAppNotification } from "./realtime.js";
import type { RenderedNotification } from "./types.js";

type ProviderResult = {
  providerMessageId?: string;
  skipped?: boolean;
  reason?: string;
};

type ProviderArgs = {
  delivery: NotificationDelivery;
  recipient: Pick<User, "id" | "email" | "mobile" | "emailOptIn" | "whatsappOptIn">;
  rendered: RenderedNotification;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  linkUrl?: string | null;
};

type NotificationProvider = {
  send(args: ProviderArgs): Promise<ProviderResult>;
};

const buildSesClient = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new SESv2Client({
    region: process.env.AWS_REGION,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
};

const inAppProvider: NotificationProvider = {
  async send({ delivery, rendered, severity, linkUrl }) {
    const notification = await db.inAppNotification.create({
      data: {
        deliveryId: delivery.id,
        userId: delivery.recipientUserId,
        title: rendered.subject || "SKERP notification",
        body: rendered.body,
        severity,
        linkUrl,
      },
    });
    emitInAppNotification(delivery.recipientUserId, notification);
    return { providerMessageId: notification.id };
  },
};

const emailProvider: NotificationProvider = {
  async send({ recipient, rendered }) {
    if (!recipient.emailOptIn) {
      return { skipped: true, reason: "Recipient has email notifications disabled" };
    }
    if (!process.env.AWS_REGION || !process.env.MAIL_FROM) {
      return { skipped: true, reason: "SES is not configured" };
    }

    await buildSesClient().send(
      new SendEmailCommand({
        FromEmailAddress: process.env.MAIL_FROM,
        Destination: { ToAddresses: [recipient.email] },
        Content: {
          Simple: {
            Subject: {
              Data: rendered.subject || "SKERP notification",
              Charset: "UTF-8",
            },
            Body: { Text: { Data: rendered.body, Charset: "UTF-8" } },
          },
        },
      })
    );

    return {};
  },
};

const whatsappProvider: NotificationProvider = {
  async send({ recipient, rendered }) {
    if (!recipient.whatsappOptIn) {
      return { skipped: true, reason: "Recipient has WhatsApp notifications disabled" };
    }
    if (!recipient.mobile) {
      return { skipped: true, reason: "Recipient mobile number is missing" };
    }

    const baseUrl = process.env.META_WHATSAPP_API_BASE_URL;
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const templateName = process.env.META_WHATSAPP_DEFAULT_TEMPLATE_NAME;
    if (!baseUrl || !phoneNumberId || !token) {
      return { skipped: true, reason: "Meta WhatsApp API is not configured" };
    }
    if (!templateName) {
      return { skipped: true, reason: "Meta WhatsApp template name is not configured" };
    }

    const response = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient.mobile,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: process.env.META_WHATSAPP_DEFAULT_LANGUAGE || "en_US",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: rendered.subject || "SKERP notification",
                },
                {
                  type: "text",
                  text: rendered.body,
                },
              ],
            },
          ],
        },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(body.error?.message || "WhatsApp API request failed");
    }

    return { providerMessageId: body.messages?.[0]?.id };
  },
};

const providers: Record<NotificationChannel, NotificationProvider> = {
  IN_APP: inAppProvider,
  EMAIL: emailProvider,
  WHATSAPP: whatsappProvider,
};

export const sendViaProvider = (
  channel: NotificationChannel,
  args: ProviderArgs
) => providers[channel].send(args);
