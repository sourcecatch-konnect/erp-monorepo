"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import type { InAppNotification } from "./types";

export const useNotificationSocket = ({
  socketUrl,
  onNotification,
}: {
  socketUrl: string;
  onNotification: (notification: InAppNotification) => void;
}) => {
  useEffect(() => {
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", onNotification);

    return () => {
      socket.off("notification:new", onNotification);
      socket.disconnect();
    };
  }, [socketUrl, onNotification]);
};
