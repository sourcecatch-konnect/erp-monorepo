import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../util/auth.util.js";
import { JwtPayload } from "@skerp/types";
import { sendError } from "../modules/_shared/response.js";
import { getPermissionContext } from "../auth/permission-cache.js";
import type { UserPermissionContext } from "../auth/permission-resolver.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      ctx?: UserPermissionContext;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  let decoded: JwtPayload;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  }

  req.user = decoded;

  // Hydrate permission context. Failures here log out the user — the token
  // is valid but the underlying user/role no longer resolves.
  const ctx = await getPermissionContext(decoded.userId);
  if (!ctx) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "User no longer exists",
    });
  }
  req.ctx = ctx;

  next();
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    next();
  };
};
