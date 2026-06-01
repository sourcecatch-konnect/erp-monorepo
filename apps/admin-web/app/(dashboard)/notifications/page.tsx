"use client";

import { NotificationInboxPage } from "@skerp/notifications-web";
import { notificationApi } from "@/features/notifications/notification.client";

export default function NotificationsPage() {
  return <NotificationInboxPage api={notificationApi} />;
}
