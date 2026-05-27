/**
 * Thin client for the WhiteBooks E-Way Bill API (sandbox).
 *
 * The full GSP integration involves AES/RSA payload encryption + a session
 * key (SEK) handshake. For the showcase demo we keep this simple: hit the
 * REST endpoints with the documented headers and return whatever the proxy
 * gives us. Calls that fail are surfaced to the caller, not retried.
 *
 * When promoting to production wire the encryption layer here and the
 * upstream callers stay unchanged.
 */

type WbConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  gstin: string;
  email: string;
};

const cfg = (): WbConfig | null => {
  const baseUrl = process.env.WB_EWAY_BASE_URL;
  const clientId = process.env.WB_EWAY_CLIENT_ID;
  const clientSecret = process.env.WB_EWAY_CLIENT_SECRET;
  const username = process.env.WB_EWAY_USERNAME;
  const password = process.env.WB_EWAY_PASSWORD;
  const gstin = process.env.WB_EWAY_GSTIN;
  const email = process.env.WB_EWAY_EMAIL;

  if (
    !baseUrl ||
    !clientId ||
    !clientSecret ||
    !username ||
    !password ||
    !gstin ||
    !email
  ) {
    return null;
  }

  return {
    baseUrl,
    clientId,
    clientSecret,
    username,
    password,
    gstin,
    email,
  };
};

const baseHeaders = (c: WbConfig): Record<string, string> => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  ip_address: "127.0.0.1",
  client_id: c.clientId,
  client_secret: c.clientSecret,
  gstin: c.gstin,
});

export type WbResponse<T = unknown> = {
  status_cd?: string;
  status_desc?: string;
  error?: { code?: string; desc?: string; message?: string };
  data?: T;
};

const wbGet = async <T = unknown>(
  path: string,
  query: Record<string, string> = {}
): Promise<WbResponse<T> | { __unconfigured: true }> => {
  const c = cfg();
  if (!c) return { __unconfigured: true };

  const url = new URL(`${c.baseUrl}${path}`);
  url.searchParams.set("email", c.email);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url, { headers: baseHeaders(c) });
    const text = await res.text();
    try {
      return JSON.parse(text) as WbResponse<T>;
    } catch {
      return {
        status_cd: String(res.status),
        status_desc: text.slice(0, 200) || "Non-JSON response",
      };
    }
  } catch (err) {
    return {
      status_cd: "NETWORK",
      status_desc: err instanceof Error ? err.message : "Network error",
    };
  }
};

export const isConfigured = () => cfg() !== null;

/** Auth handshake — returns the raw envelope so the UI can show real status. */
export const authenticate = () => {
  const c = cfg();
  if (!c) return Promise.resolve({ __unconfigured: true } as const);
  return wbGet("/ewaybillapi/v1.03/authenticate", {
    username: c.username,
    password: c.password,
  });
};

/** Get GSTIN trade details — proves the live integration end-to-end. */
export const getGstinDetails = (gstin: string) =>
  wbGet("/ewaybillapi/v1.03/ewayapi/getgstindetails", { GSTIN: gstin });

/** Get HSN details — used to enrich item rows in the detail view. */
export const getHsnDetails = (hsncode: string) =>
  wbGet("/ewaybillapi/v1.03/ewayapi/gethsndetailsbyhsncode", { hsncode });

/** Get transporter (TRANSIN) details. */
export const getTransporterDetails = (trn: string) =>
  wbGet("/ewaybillapi/v1.03/ewayapi/gettransporterdetails", { trn_no: trn });
