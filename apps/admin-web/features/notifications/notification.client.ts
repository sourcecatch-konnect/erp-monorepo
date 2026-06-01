"use client";

import { createNotificationApi, type UserOption } from "@skerp/notifications-web";
import { api } from "@/lib/api";

export const notificationApi = createNotificationApi(api);

export const notificationSocketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type EmployeeRow = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string;
};

export const loadNotificationUsers = async (): Promise<UserOption[]> => {
  const response = await api.get<{ data: EmployeeRow[] }>("/employees");
  return response.data.data.map((user) => ({
    id: user.id,
    label: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
  }));
};
