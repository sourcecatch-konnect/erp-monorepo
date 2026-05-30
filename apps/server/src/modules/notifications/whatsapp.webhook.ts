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

const updateStatus = async (status: WhatsAppStatus) => {
  if (!status.id) return;

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
        const statuses = change.value?.statuses || [];
        for (const status of statuses) {
          await updateStatus(status);
        }
      }
    }
  }

  return res.status(200).send("EVENT_RECEIVED");
};
