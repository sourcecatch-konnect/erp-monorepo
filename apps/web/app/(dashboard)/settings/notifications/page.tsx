"use client";

import type { PermissionKey } from "@skerp/types";
import { NotificationAdminSetupPage } from "@skerp/notifications-web";
import { ProtectedRoute } from "@/features/auth";
import { Can } from "@/features/auth/components/Can";
import {
  loadNotificationUsers,
  notificationApi,
} from "@/features/notifications/notification.client";

const MANAGE_NOTIFICATION_RULES =
  "notifications.manage_rules" satisfies PermissionKey;

export default function NotificationSettingsPage() {
  return (
    <ProtectedRoute permission={MANAGE_NOTIFICATION_RULES}>
      <Can
        permission={MANAGE_NOTIFICATION_RULES}
        fallback={
          <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">
            You do not have access to notification setup.
          </div>
        }
      >
        <NotificationAdminSetupPage
          api={notificationApi}
          loadUsers={loadNotificationUsers}
        />
      </Can>
    </ProtectedRoute>
  );
}
