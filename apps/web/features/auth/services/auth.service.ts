import { api } from "@/lib/api";
import type { AuthUser, LoginPayload } from "../types";

type ApiSuccess<T> = {
  success: boolean;
  data: T;
};

/** POST /auth/login - sets httpOnly cookies, returns the user. */
export const webLogin = async (payload: LoginPayload): Promise<AuthUser> => {
  const res = await api.post<ApiSuccess<AuthUser>>("/auth/login", payload);
  return res.data.data;
};

/** GET /auth/me — restores the session on app load (persistent login). */
export const getMe = async (): Promise<AuthUser> => {
  const res = await api.get<ApiSuccess<AuthUser>>("/auth/me");
  return res.data.data;
};

/** POST /auth/logout - clears the auth cookies on the server. */
export const webLogout = async (): Promise<void> => {
  await api.post("/auth/logout");
};

/**
 * POST /auth/forgot-password - emails a reset link if the address is known.
 * Always resolves (the server never reveals whether the account exists).
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  await api.post("/auth/forgot-password", { email });
};

/** POST /auth/reset-password - sets a new password from an emailed token. */
export const resetPassword = async (
  token: string,
  password: string,
): Promise<void> => {
  await api.post("/auth/reset-password", { token, password });
};
