import crypto from "crypto";
import { Request, Response } from "express";
import { db } from "../../../prisma/prisma.js";

type RawBodyRequest = Request & { rawBody?: Buffer };

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: { title?: string; message?: string }[];
};

const verifySignature = (req: RawBodyRequest) => {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  const signature = req.headers["x-hub-signature-256"];

  if (!appSecret || !signature || Array.isArray(signature) || !req.rawBody) {
    return false;
  }

  const [, signatureHash] = signature.split("=");
  if (!signatureHash) return false;

  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(req.rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signatureHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
};

export const verifyWhatsAppWebhook = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode !== "subscribe" ||
    token !== process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    typeof challenge !== "string"
  ) {
    return res.sendStatus(403);
  }

  return res.status(200).send(challenge);
};

type TemplateStatusUpdate = {
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  event?: string;
  reason?: string;
};

const normaliseTemplateStatus = (event?: string) => {
  switch ((event || "").toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "DISABLED":
    case "PAUSED":
      return "DISABLED";
    case "PENDING":
    case "IN_APPEAL":
      return "PENDING";
    default:
      return undefined;
  }
};

const updateTemplateStatus = async (update: TemplateStatusUpdate) => {
  const nextStatus = normaliseTemplateStatus(update.event);
  if (!nextStatus || !update.message_template_name) return;

  await db.notificationTemplate.updateMany({
    where: {
      channel: "WHATSAPP",
      metaName: update.message_template_name,
    },
    data: {
      metaStatus: nextStatus,
      metaRejectedReason: nextStatus === "REJECTED" ? update.reason || null : null,
      metaSyncedAt: new Date(),
    },
  });
};

const updateStatus = async (status: WhatsAppStatus) => {
  if (!status.id) return;

  const errorText =
    status.errors?.[0]?.message || status.errors?.[0]?.title || undefined;
  console.log(
    `[notifications][whatsapp] ← status "${status.status}" for message ${status.id}` +
      (status.recipient_id ? ` (to ${status.recipient_id})` : "") +
      (errorText ? ` — ${errorText}` : "")
  );

  const nextStatus =
    status.status === "delivered"
      ? "DELIVERED"
      : status.status === "failed"
        ? "FAILED"
        : undefined;

  if (!nextStatus) return;

  await db.notificationDelivery.updateMany({
    where: {
      channel: "WHATSAPP",
      providerMessageId: status.id,
    },
    data: {
      status: nextStatus,
      deliveredAt: nextStatus === "DELIVERED" ? new Date() : undefined,
      failedAt: nextStatus === "FAILED" ? new Date() : undefined,
      lastError:
        nextStatus === "FAILED"
          ? status.errors?.[0]?.message || status.errors?.[0]?.title
          : undefined,
    },
  });
};

export const receiveWhatsAppWebhook = async (
  req: RawBodyRequest,
  res: Response
) => {
  if (process.env.META_WHATSAPP_APP_SECRET && !verifySignature(req)) {
    return res.sendStatus(403);
  }

  if (req.body?.object === "whatsapp_business_account") {
    for (const entry of req.body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === "message_template_status_update") {
          await updateTemplateStatus(change.value || {});
          continue;
        }
        const statuses = change.value?.statuses || [];
        for (const status of statuses) {
          await updateStatus(status);
        }
      }
    }
  }

  return res.status(200).send("EVENT_RECEIVED");
};
