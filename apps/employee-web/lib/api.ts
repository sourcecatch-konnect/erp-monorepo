import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Shared axios instance. Tokens live in httpOnly cookies, so every request
 * must send credentials — the browser attaches the cookies automatically.
 */
export const api = axios.create({
  baseURL,
  withCredentials: true,
});

/**
 * Called when the session is truly gone (refresh token invalid/expired).
 * Registered by AuthBootstrap so the interceptor can notify the Redux store
 * without importing it (avoids a circular dependency).
 */
let onAuthFailure: (() => void) | null = null;
export const setAuthFailureHandler = (fn: () => void) => {
  onAuthFailure = fn;
};

/**
 * A single in-flight refresh shared by all concurrent 401s, so N failing
 * requests trigger exactly one /auth/refresh call.
 */
let refreshPromise: Promise<void> | null = null;

const refreshSession = (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
};

export type ApiRequestError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

const toError = (error: AxiosError): ApiRequestError => {
  const data = error.response?.data as ApiErrorResponse | undefined;
  const apiError = data?.error;
  const normalized = new Error(
    apiError?.message || data?.message || error.message || "Something went wrong"
  ) as ApiRequestError;

  normalized.status = error.response?.status;
  normalized.code = apiError?.code;
  normalized.details = apiError?.details;

  return normalized;
};

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    // Endpoints where a 401 is expected and must NOT trigger a refresh.
    const isRefresh = url.includes("/auth/refresh");
    const isLogin = url.includes("/login");
    const skipRefresh = isRefresh || isLogin || url.includes("/auth/logout");

    if (status === 401 && original && !original._retry && !skipRefresh) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original); // retry once with the new access token
      } catch {
        onAuthFailure?.();
        return Promise.reject(toError(error));
      }
    }

    // The refresh call itself failed -> session is unrecoverable.
    if (status === 401 && isRefresh) {
      onAuthFailure?.();
    }

    return Promise.reject(toError(error));
  }
);
