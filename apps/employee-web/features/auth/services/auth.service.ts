import { api } from "@/lib/api";
import type { AuthUser, LoginPayload } from "../types";

type ApiSuccess<T> = {
  success: boolean;
  data: T;
};

/** POST /auth/employee/login — sets httpOnly cookies, returns the user. */
export const employeeLogin = async (
  payload: LoginPayload
): Promise<AuthUser> => {
  const res = await api.post<ApiSuccess<AuthUser>>(
    "/auth/employee/login",
    payload
  );
  return res.data.data;
};

/** GET /auth/me — restores the session on app load (persistent login). */
export const getMe = async (): Promise<AuthUser> => {
  const res = await api.get<ApiSuccess<AuthUser>>("/auth/me");
  return res.data.data;
};

/** POST /auth/logout — clears the auth cookies on the server. */
export const employeeLogout = async (): Promise<void> => {
  await api.post("/auth/logout");
};
