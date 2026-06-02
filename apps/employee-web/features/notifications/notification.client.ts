"use client";

import { createNotificationApi } from "@skerp/notifications-web";
import { api } from "@/lib/api";

export const notificationApi = createNotificationApi(api);

export const notificationSocketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";
