import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../util/auth.util.js";
import { JwtPayload } from "@skerp/types";
import { sendError } from "../modules/_shared/response.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    req.user = decoded; // attach user

    next();
  } catch {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  }
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
