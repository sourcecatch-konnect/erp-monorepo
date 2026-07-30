/**
 * Onelap GPS client.
 *
 * Onelap is the Traccar REST API rebranded. Per Onelap's official API spec we
 * authenticate with **stateless HTTP Basic auth** — `base64(phoneNumber:password)`
 * — so there is no session cookie to fetch, cache, or refresh.
 *
 * `GET /api/devices/v2` returns each device's metadata together with its latest
 * position (latitude/longitude/speed/course) in a single call, so we don't need
 * a separate /positions fetch + join. Verified live: speed is in knots; a device
 * that has never reported sits at 0,0.
 */
import type {
  FleetVehicle,
  DevicePosition,
  DeviceStatus,
  TrailPoint,
  LivePosition,
} from "@skerp/types";

const BASE_URL = process.env.ONELAP_BASE_URL ?? "https://web.onelap.in";
const EMAIL = process.env.ONELAP_EMAIL ?? "";
const PASSWORD = process.env.ONELAP_PASSWORD ?? "";

const KNOTS_TO_KMPH = 1.852;
const toKmph = (knots: number | null | undefined) =>
  Math.round((knots ?? 0) * KNOTS_TO_KMPH);

/** wss:// socket URL derived from the configured base URL. */
export const ONELAP_SOCKET_URL = `${BASE_URL.replace(/^http/, "ws")}/api/socket`;

/** Row from `/api/devices/v2` — device metadata + flattened latest position. */
export type OneLapDevice = {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string | null;
  phone: string | null;
  validity: string | null;
  positionId: number;
  attributes?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  course?: number | null;
};
/** Stateless Basic auth header: base64(phoneNumber:password). */
function authHeader(): string {
  if (!EMAIL || !PASSWORD) {
    throw new Error("ONELAP_EMAIL / ONELAP_PASSWORD are not configured");
  }
  const token = Buffer.from(`${EMAIL}:${PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

async function authedGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: {
      Authorization: authHeader(),
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!res.ok) {
    throw new Error(`Onelap GET ${path} failed (HTTP ${res.status})`);
  }

  return (await res.json()) as T;
}
export async function getOneLapDevices(): Promise<OneLapDevice[]> {
  return authedGet<OneLapDevice[]>("/devices/v2");
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
  const devices = await getOneLapDevices();

  return devices.map((device) => {
    const lat = typeof device.latitude === "number" ? device.latitude : null;
    const lng = typeof device.longitude === "number" ? device.longitude : null;
    // 0,0 is "null island" — a device that has never reported a real fix.
    const hasFix = lat !== null && lng !== null && (lat !== 0 || lng !== 0);

    const position: DevicePosition | null = hasFix
      ? {
        positionId: device.positionId,
        latitude: lat,
        longitude: lng,
        speedKmph: toKmph(device.speed),
        course: device.course ?? 0,
        address: null,
        fixTime: device.lastUpdate ?? null,
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

/** Raw `/api/reports/mini-route` point — note `fixedTime` (not `fixTime`). */
type MiniRoutePoint = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  course?: number | null;
  fixedTime?: string | null;
  fixTime?: string | null;
};

/** Breadcrumb trail for one device between two ISO timestamps (UTC). */
export async function getHistory(
  deviceId: number,
  fromIso: string,
  toIso: string,
): Promise<TrailPoint[]> {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: fromIso,
    to: toIso,
  });
  const points = await authedGet<MiniRoutePoint[]>(
    `/reports/mini-route?${params.toString()}`,
  );

  return points
    .filter(
      (p) => typeof p.latitude === "number" && typeof p.longitude === "number",
    )
    .map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      speedKmph: toKmph(p.speed),
      course: p.course ?? 0,
      fixTime: p.fixedTime ?? p.fixTime ?? null,
    }));
}

/* ------------------------------------------------------------------ */
/* WebSocket support (the one place the session cookie is required)   */
/* ------------------------------------------------------------------ */

/** Log in via /api/session and return the `JSESSIONID=…` cookie for the WS. */
export async function loginForSocket(): Promise<string> {
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
  if (!res.ok) throw new Error(`Onelap login failed (HTTP ${res.status})`);

  const match = (res.headers.get("set-cookie") ?? "").match(
    /JSESSIONID=([^;]+)/,
  );
  if (!match) throw new Error("Onelap login did not return a session cookie");
  return `JSESSIONID=${match[1]}`;
}

/** Raw socket position → LivePosition, or null if it lacks valid coordinates. */
export function toLivePosition(raw: unknown): LivePosition | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const deviceId = p.deviceId;
  const latitude = p.latitude;
  const longitude = p.longitude;
  if (
    typeof deviceId !== "number" ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return {
    deviceId,
    latitude,
    longitude,
    speedKmph: toKmph(typeof p.speed === "number" ? p.speed : 0),
    course: typeof p.course === "number" ? p.course : 0,
    fixTime: typeof p.fixTime === "string" ? p.fixTime : null,
  };
}
