/**
 * Tracking realtime proxy.
 *
 * Web clients can't reach Onelap's WebSocket (it needs the account session
 * cookie). Instead the server keeps a single upstream connection to
 * `wss://web.onelap.in/api/socket` and rebroadcasts position events to
 * subscribed web clients over the app's existing Socket.IO server.
 *
 * The upstream connection is opened lazily on the first subscriber and closed
 * when the last one leaves, so we don't hold a socket open for nobody.
 */
import type { Server } from "socket.io";
import WebSocket from "ws";
import type { LivePosition } from "@skerp/types";

import { getPermissionContext } from "../../auth/permission-cache.js";
import {
  ONELAP_SOCKET_URL,
  loginForSocket,
  toLivePosition,
} from "./onelap.client.js";

const ROOM = "tracking";
const PERMISSION = "tracking.view";
const RECONNECT_MS = 5_000;

let upstream: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let stopping = false;

const roomSize = (io: Server) =>
  io.sockets.adapter.rooms.get(ROOM)?.size ?? 0;

function scheduleReconnect(io: Server) {
  if (stopping || reconnectTimer || roomSize(io) === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (roomSize(io) > 0) void connectUpstream(io);
  }, RECONNECT_MS);
}

async function connectUpstream(io: Server) {
  if (upstream) return;
  try {
    const cookie = await loginForSocket();
    const ws = new WebSocket(ONELAP_SOCKET_URL, {
      headers: { Cookie: cookie },
    });
    upstream = ws;

    ws.on("message", (data: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(data.toString()) as {
          positions?: unknown[];
        };
        if (!Array.isArray(parsed.positions)) return;

        const live = parsed.positions
          .map(toLivePosition)
          .filter((p): p is LivePosition => p !== null);

        if (live.length) io.to(ROOM).emit("tracking:positions", live);
      } catch {
        /* ignore malformed frames */
      }
    });

    ws.on("close", () => {
      upstream = null;
      scheduleReconnect(io);
    });

    ws.on("error", () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    });
  } catch {
    upstream = null;
    scheduleReconnect(io);
  }
}

function stopUpstreamIfIdle(io: Server) {
  if (roomSize(io) > 0) return;
  stopping = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (upstream) {
    try {
      upstream.close();
    } catch {
      /* noop */
    }
    upstream = null;
  }
}

export function initTrackingRealtime(io: Server): void {
  io.on("connection", (socket) => {
    socket.on("tracking:subscribe", async () => {
      const userId =
        typeof socket.data.userId === "string" ? socket.data.userId : undefined;
      if (!userId) return;

      const ctx = await getPermissionContext(userId);
      if (!ctx?.permissions.has(PERMISSION)) return;

      socket.join(ROOM);
      stopping = false;
      void connectUpstream(io);
    });

    socket.on("tracking:unsubscribe", () => {
      socket.leave(ROOM);
      stopUpstreamIfIdle(io);
    });

    socket.on("disconnect", () => stopUpstreamIfIdle(io));
  });
}
