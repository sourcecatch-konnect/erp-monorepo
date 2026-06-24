"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";
import type { LivePosition } from "@skerp/types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

/**
 * Connects to the app Socket.IO server, subscribes to the tracking room, and
 * invokes `onPositions` with each live batch. Returns whether the socket is
 * currently connected (for a "Live" indicator).
 */
export function useTrackingSocket(
  onPositions: (positions: LivePosition[]) => void,
): boolean {
  const [connected, setConnected] = React.useState(false);
  // Keep the latest callback without re-opening the socket on every render.
  const handlerRef = React.useRef(onPositions);
  handlerRef.current = onPositions;

  React.useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    const subscribe = () => {
      setConnected(true);
      socket.emit("tracking:subscribe");
    };

    socket.on("connect", subscribe);
    socket.on("disconnect", () => setConnected(false));
    socket.on("tracking:positions", (positions: LivePosition[]) => {
      handlerRef.current(positions);
    });

    return () => {
      socket.emit("tracking:unsubscribe");
      socket.off("tracking:positions");
      socket.disconnect();
    };
  }, []);

  return connected;
}
