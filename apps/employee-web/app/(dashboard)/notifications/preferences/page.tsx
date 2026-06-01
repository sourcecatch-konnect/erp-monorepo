"use client";

import { NotificationPreferencesPanel } from "@skerp/notifications-web";
import { notificationApi } from "@/features/notifications/notification.client";

export default function NotificationPreferencesPage() {
  return <NotificationPreferencesPanel api={notificationApi} />;
}
