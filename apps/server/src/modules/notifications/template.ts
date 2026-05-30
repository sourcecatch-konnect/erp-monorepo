import type { NotificationTemplate } from "@prisma/client";
import type { NotificationPayload, RenderedNotification } from "./types.js";

const readPath = (payload: NotificationPayload, path: string): string => {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, payload);

  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const renderText = (text: string, payload: NotificationPayload): string => {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) =>
    readPath(payload, path)
  );
};

export const renderTemplate = (
  template: Pick<NotificationTemplate, "subject" | "body"> | null,
  payload: NotificationPayload
): RenderedNotification => {
  if (!template) {
    return {
      subject: payload.title ? String(payload.title) : "SKERP notification",
      body: payload.message ? String(payload.message) : "A new ERP notification was generated.",
    };
  }

  return {
    subject: template.subject
      ? renderText(template.subject, payload)
      : undefined,
    body: renderText(template.body, payload),
  };
};
