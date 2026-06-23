/**
 * Onelap GPS client.
 *
 * Onelap's API is the Traccar REST API. We log in once with the account
 * credentials (POST /api/session, form-encoded), cache the JSESSIONID cookie
 * in memory, and reuse it for /api/devices and /api/positions. On a 401/403
 * (cookie expired) we clear it, log in again, and retry once.
 *
 * Verified live: login returns a fresh JSESSIONID; devices join positions by
 * `position.deviceId === device.id`; speed is in knots; address is always null.
 */
import type { FleetVehicle, DevicePosition, DeviceStatus } from "@skerp/types";

const BASE_URL = process.env.ONELAP_BASE_URL ?? "https://web.onelap.in";
const EMAIL = process.env.ONELAP_EMAIL ?? "";
const PASSWORD = process.env.ONELAP_PASSWORD ?? "";

const KNOTS_TO_KMPH = 1.852;

/* Raw Traccar shapes — only the fields we consume. */
type TraccarDevice = {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string | null;
  phone: string | null;
  validity: string | null;
  attributes?: Record<string, unknown> | null;
};

type TraccarPosition = {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address: string | null;
  fixTime: string | null;
};

let sessionCookie: string | null = null;

async function login(): Promise<string> {
  if (!EMAIL || !PASSWORD) {
    throw new Error("ONELAP_EMAIL / ONELAP_PASSWORD are not configured");
  }

  const res = await fetch(`${BASE_URL}/api/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`Onelap login failed (HTTP ${res.status})`);
  }

  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/JSESSIONID=([^;]+)/);
  if (!match) {
    throw new Error("Onelap login did not return a session cookie");
  }

  sessionCookie = `JSESSIONID=${match[1]}`;
  return sessionCookie;
}

async function authedGet<T>(path: string): Promise<T> {
  if (!sessionCookie) await login();

  const fetchOnce = () =>
    fetch(`${BASE_URL}/api${path}`, {
      headers: {
        Cookie: sessionCookie as string,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

  let res = await fetchOnce();
  if (res.status === 401 || res.status === 403) {
    sessionCookie = null;
    await login();
    res = await fetchOnce();
  }

  if (!res.ok) {
    throw new Error(`Onelap GET ${path} failed (HTTP ${res.status})`);
  }

  return (await res.json()) as T;
}

function toStatus(raw: string): DeviceStatus {
  return raw === "online" || raw === "offline" ? raw : "unknown";
}

function numberAttr(
  attrs: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = attrs?.[key];
  return typeof value === "number" ? value : null;
}

function stringAttr(
  attrs: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = attrs?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** Fetch every device with its latest known position, flattened for the web. */
export async function getFleet(): Promise<FleetVehicle[]> {
  const [devices, positions] = await Promise.all([
    authedGet<TraccarDevice[]>("/devices"),
    authedGet<TraccarPosition[]>("/positions"),
  ]);

  const byDevice = new Map<number, TraccarPosition>();
  for (const p of positions) byDevice.set(p.deviceId, p);

  return devices.map((device) => {
    const raw = byDevice.get(device.id);
    const position: DevicePosition | null = raw
      ? {
          positionId: raw.id,
          latitude: raw.latitude,
          longitude: raw.longitude,
          speedKmph: Math.round(raw.speed * KNOTS_TO_KMPH),
          course: raw.course,
          address: raw.address ?? null,
          fixTime: raw.fixTime ?? null,
        }
      : null;

    return {
      id: device.id,
      name: device.name?.trim() || `Device ${device.id}`,
      uniqueId: device.uniqueId,
      status: toStatus(device.status),
      lastUpdate: device.lastUpdate ?? null,
      battery: numberAttr(device.attributes, "batteryLevel"),
      vehicleNumber: stringAttr(device.attributes, "vehicleNumber"),
      phone: device.phone ?? null,
      validity: device.validity ?? null,
      position,
    } satisfies FleetVehicle;
  });
}
