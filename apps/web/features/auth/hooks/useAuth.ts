"use client";

import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/config/routes";
import { login, logout } from "../store/authSlice";
import type { LoginPayload } from "../types";

/**
 * Thin wrapper over the auth slice for components.
 * Reads session state from Redux and dispatches the login/logout thunks.
 */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, status, error } = useAppSelector((state) => state.auth);

  const signIn = async (credentials: LoginPayload) => {
    const result = await dispatch(login(credentials));
    if (login.fulfilled.match(result)) {
      router.replace(ROUTES.dashboard);
      return;
    }
    // Surface the rejected payload so the form can display it.
    throw new Error((result.payload as string) || "Login failed");
  };

  const signOut = async () => {
    await dispatch(logout());
    router.replace(ROUTES.login);
  };

  return {
    user,
    status,
    error,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login: signIn,
    logout: signOut,
  };
};
