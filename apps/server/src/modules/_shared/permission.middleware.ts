import { NextFunction, Request, Response } from "express";
import { PermissionAction } from "@skerp/types";
import { db } from "../../../prisma/prisma.js";
import { ROLES } from "../../util/auth.util.js";
import { sendError } from "./response.js";

const actionToColumn = {
  view: "canView",
  create: "canCreate",
  update: "canUpdate",
  delete: "canDelete",
} as const satisfies Record<PermissionAction, keyof PermissionRecord>;

type PermissionRecord = {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export const requirePermission = (
  permissionKey: string,
  action: PermissionAction
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return sendError(res, 401, {
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const permission = await db.permission.findFirst({
      where: {
        role: {
          name: req.user.role,
        },
        module: {
          code: permissionKey,
        },
      },
      select: {
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    });

    if (!permission?.[actionToColumn[action]]) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    return next();
  };
};
