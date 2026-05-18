import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../util/auth.util.js";
import { JwtPayload } from "@skerp/types";
import { ROLES } from "../util/auth.util.js";

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
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    req.user = decoded; // attach user

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    next();
  };
};