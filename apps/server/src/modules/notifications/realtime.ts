import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyAccessToken } from "../../util/auth.util.js";

let io: Server | null = null;

const parseCookie = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
};

export const initNotificationRealtime = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean | string) => void
      ) => callback(null, origin ?? true),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      parseCookie(socket.handshake.headers.cookie, "accessToken") ||
      (typeof socket.handshake.auth.token === "string"
        ? socket.handshake.auth.token
        : undefined);

    if (!token) return next(new Error("Not authenticated"));

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId =
      typeof socket.data.userId === "string" ? socket.data.userId : undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
};

export const emitInAppNotification = (
  userId: string,
  notification: unknown
) => {
  io?.to(`user:${userId}`).emit("notification:new", notification);
};

/** The shared Socket.IO server, for other realtime features (e.g. tracking). */
export const getIo = (): Server | null => io;
