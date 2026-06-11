"use client";

import { NotificationPreferencesPanel } from "@skerp/notifications-web";
import { notificationApi } from "@/features/notifications/notification.client";
import { ProtectedRoute } from "@/features/auth";
import { PERMS } from "@skerp/types";

export default function NotificationPreferencesPage() {
  return (
    <ProtectedRoute permission={PERMS.NOTIFICATIONS.VIEW}>
      <NotificationPreferencesPanel api={notificationApi} />
    </ProtectedRoute>
  );
}
