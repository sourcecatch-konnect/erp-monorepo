import type { ApiEnvelope, SessionUser } from "@skerp/types";

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | undefined;
}

export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");

    const token = getToken?.();
    if (token) headers.set("authorization", `Bearer ${token}`);

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    health: () => request<ApiEnvelope<{ status: "ok" }>>("/health"),
    profile: () => request<ApiEnvelope<SessionUser>>("/auth/profile"),
  };
}
