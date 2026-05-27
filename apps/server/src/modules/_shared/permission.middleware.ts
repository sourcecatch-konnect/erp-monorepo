import { NextFunction, Request, Response } from "express";
import { PermissionAction } from "@skerp/types";
import { sendError } from "./response.js";

/**
 * CRUD-action permission gate for the master `createCrudRouter` factory.
 *
 * The factory is generic across every master, so it can't import a typed
 * `PermissionKey` constant — it composes the full key from a module-level
 * string (`"masters.customer"`) plus the action (`"view"`) and checks it
 * against the hydrated `req.ctx.permissions` set.
 *
 * Bespoke routes should prefer `can(PERMS....)` from
 * `src/auth/can.middleware.ts`, which is type-safe against the registry.
 */
const actionToKeySuffix: Record<PermissionAction, string> = {
  view: "view",
  create: "create",
  update: "update",
  delete: "delete",
};

export const requirePermission = (
  permissionKey: string,
  action: PermissionAction
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx) {
      return sendError(res, 401, {
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const fullKey = `${permissionKey}.${actionToKeySuffix[action]}`;
    if (!req.ctx.permissions.has(fullKey)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    return next();
  };
};
