import { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "@skerp/types";
import { sendError } from "../modules/_shared/response.js";

/**
 * Permission gate. Reads from the hydrated req.ctx (see auth.middlware.ts).
 * Returns 401 if no session, 403 if the key isn't in the user's set.
 *
 * Usage:
 *   router.post("/lr/:id/approve", can(PERMS.LORRY_RECEIPT.APPROVE), handler);
 */
export const can = (key: PermissionKey) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx) {
      return sendError(res, 401, {
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }
    if (!req.ctx.permissions.has(key)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }
    return next();
  };
};

/**
 * Allow if the user has ANY of the listed keys. Used for endpoints that
 * accept "view" or "manage" — rare. Prefer `can(single)` whenever possible.
 */
export const canAny = (...keys: PermissionKey[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx) {
      return sendError(res, 401, {
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }
    if (!keys.some((k) => req.ctx!.permissions.has(k))) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }
    return next();
  };
};
