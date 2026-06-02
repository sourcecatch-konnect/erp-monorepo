"use client";

import { NotificationBell } from "@skerp/notifications-web";
import { notificationApi, notificationSocketUrl } from "./notification.client";

export function NotificationBellButton() {
  return (
    <NotificationBell
      api={notificationApi}
      socketUrl={notificationSocketUrl}
      inboxHref="/notifications"
      preferencesHref="/notifications/preferences"
    />
  );
}
