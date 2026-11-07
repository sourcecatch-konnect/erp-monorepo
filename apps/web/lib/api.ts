import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { permissionLabel } from "@skerp/types";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
 * Called on every 403. The browser's copy of `permissions` comes from
 * /auth/me at app load, so an admin editing a role leaves it stale — the UI
 * keeps offering an action the server now refuses. Re-reading the session on a
 * 403 lets the UI self-correct instead of staying wrong until a hard refresh.
 * Registered by AuthBootstrap, for the same reason as `onAuthFailure`.
 */
let onForbidden: (() => void) | null = null;
export const setForbiddenHandler = (fn: () => void) => {
  onForbidden = fn;
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
  ok?: boolean;
  code?: string;
  message?: string;
  details?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export type ApiRequestError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
  /** On a 403: the permission key(s) that would have allowed the request. */
  requiredPermissions?: string[];
};

const formatDetails = (details: unknown): string | null => {
  if (!details) return null;

  if (typeof details === "string") return details;

  if (Array.isArray(details)) {
    return details.map(String).join("\n");
  }

  if (typeof details === "object") {
    const messages = Object.entries(details)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) {
          return value.map((msg) => `${field}: ${msg}`);
        }

        if (typeof value === "string") {
          return [`${field}: ${value}`];
        }

        return [];
      })
      .filter(Boolean);

    return messages.length > 0 ? messages.join("\n") : null;
  }

  return String(details);
};

/** Reads `details.required` off a 403 body; tolerates a string or an array. */
const requiredPermissionsOf = (details: unknown): string[] => {
  if (!details || typeof details !== "object") return [];
  const required = (details as { required?: unknown }).required;
  if (typeof required === "string") return [required];
  if (Array.isArray(required))
    return required.filter((k): k is string => typeof k === "string");
  return [];
};

/**
 * The server answers a denied request with the bare word "Forbidden", which
 * tells the reader nothing. Turn the permission key it reports into the same
 * wording the role editor uses, so people can ask for the right thing.
 */
const forbiddenMessage = (keys: string[]): string => {
  if (!keys.length)
    return "You don't have permission to do this. Ask an admin to update your role.";
  const names = keys.map((key) => `"${permissionLabel(key)}"`);
  const needs = names.length === 1 ? names[0] : names.join(" or ");
  return `You don't have permission to do this — it needs ${needs}. Ask an admin to add it to your role.`;
};

const toError = (error: AxiosError): ApiRequestError => {
  const data = error.response?.data as ApiErrorResponse | undefined;
  const apiError = data?.error;
  const status = error.response?.status;

  const details = apiError?.details ?? data?.details;
  const code = apiError?.code ?? data?.code;

  // A 403's details carry permission keys, not field errors, so formatDetails
  // would render them as "required: order.create".
  const required = status === 403 ? requiredPermissionsOf(details) : [];
  const detailsMessage = status === 403 ? null : formatDetails(details);

  const normalized = new Error(
    status === 403
      ? forbiddenMessage(required)
      : detailsMessage ||
          apiError?.message ||
          data?.message ||
          error.message ||
          "Something went wrong",
  ) as ApiRequestError;

  normalized.status = status;
  normalized.code = code;
  normalized.details = details;
  if (required.length) normalized.requiredPermissions = required;

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
    const skipRefresh =
      isRefresh ||
      isLogin ||
      url.includes("/auth/logout") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password");

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

    // The server refused an action the UI offered, so our permission list is
    // out of date. Re-read it; the UI corrects itself on the next render.
    if (status === 403) {
      onForbidden?.();
    }

    return Promise.reject(toError(error));
  },
);
