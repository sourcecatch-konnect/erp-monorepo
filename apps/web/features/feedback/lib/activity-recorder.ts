import axios, {
  type AxiosAdapter,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { FeedbackContext } from "@skerp/types";
import { api } from "@/lib/api";

/**
 * Keeps the last few API calls and browser errors so a bug report can say
 * what actually failed. Observe-only: the wrapped adapter returns the same
 * response / re-throws the same error, and `lib/api.ts` is not modified.
 *
 * Never records request/response bodies, headers or cookies — only method,
 * path (query string dropped), status, duration and the server's error text.
 */

type ApiCall = NonNullable<FeedbackContext["recentApi"]>[number];
type ClientError = NonNullable<FeedbackContext["recentErrors"]>[number];

const MAX_API_CALLS = 10;
const MAX_CLIENT_ERRORS = 5;
const WRAPPED = Symbol("feedback-activity-recorder");

const apiCalls: ApiCall[] = [];
const clientErrors: ClientError[] = [];

const push = <T>(list: T[], item: T, max: number) => {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
};

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const serverMessage = (error: unknown): string | undefined => {
  const axiosError = error as AxiosError<{
    error?: { message?: string };
    message?: string;
  }>;
  const message =
    axiosError.response?.data?.error?.message ??
    axiosError.response?.data?.message ??
    axiosError.message;
  return message ? clip(String(message), 300) : undefined;
};

type MarkedAdapter = AxiosAdapter & { [WRAPPED]?: true };

const observe = (
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig => {
  // Don't fill the trail with the feedback calls themselves.
  if ((config.url ?? "").startsWith("/feedback")) return config;
  // A 401-retry re-enters the interceptors with an already wrapped adapter.
  if (typeof config.adapter === "function" && (config.adapter as MarkedAdapter)[WRAPPED]) {
    return config;
  }

  const base = axios.getAdapter(config.adapter ?? axios.defaults.adapter);
  const wrapped: MarkedAdapter = async (cfg) => {
    const startedAt = performance.now();
    const record = (status: number | null, message?: string) =>
      push(
        apiCalls,
        {
          method: (cfg.method ?? "get").toUpperCase(),
          url: clip((cfg.url ?? "").split("?")[0] ?? "", 300),
          status,
          durationMs: Math.round(performance.now() - startedAt),
          ...(message ? { message } : {}),
          at: new Date().toISOString(),
        },
        MAX_API_CALLS,
      );
    try {
      const response = await base(cfg);
      record(response.status);
      return response;
    } catch (error) {
      record((error as AxiosError).response?.status ?? null, serverMessage(error));
      throw error;
    }
  };
  wrapped[WRAPPED] = true;
  config.adapter = wrapped;
  return config;
};

const onWindowError = (event: ErrorEvent) =>
  push(
    clientErrors,
    {
      message: clip(event.message || "Script error", 500),
      at: new Date().toISOString(),
    },
    MAX_CLIENT_ERRORS,
  );

const onUnhandledRejection = (event: PromiseRejectionEvent) => {
  const reason: unknown = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unhandled promise rejection";
  push(
    clientErrors,
    { message: clip(message, 500), at: new Date().toISOString() },
    MAX_CLIENT_ERRORS,
  );
};

let installs = 0;
let interceptorId: number | null = null;

/** Ref-counted (StrictMode mounts twice). Returns the uninstall function. */
export function installActivityRecorder(): () => void {
  installs += 1;
  if (installs === 1) {
    interceptorId = api.interceptors.request.use(observe);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
  }
  return () => {
    installs -= 1;
    if (installs === 0 && interceptorId !== null) {
      api.interceptors.request.eject(interceptorId);
      interceptorId = null;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    }
  };
}

export const snapshotActivity = (): Pick<
  FeedbackContext,
  "recentApi" | "recentErrors"
> => ({
  recentApi: [...apiCalls],
  recentErrors: [...clientErrors],
});
