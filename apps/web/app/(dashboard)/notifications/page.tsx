"use client";

import { NotificationInboxPage } from "@skerp/notifications-web";
import { notificationApi } from "@/features/notifications/notification.client";
import { ProtectedRoute } from "@/features/auth";
import { PERMS } from "@skerp/types";

export default function NotificationsPage() {
  return (
    <ProtectedRoute permission={PERMS.NOTIFICATIONS.VIEW}>
      <NotificationInboxPage api={notificationApi} />
    </ProtectedRoute>
  );
}
