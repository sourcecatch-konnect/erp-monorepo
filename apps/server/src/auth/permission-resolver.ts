import { db } from "../../prisma/prisma.js";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "@skerp/types";

export type UserPermissionContext = {
  userId: string;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
  permissions: Set<string>;
  branchScope: "ALL" | "ASSIGNED";
  branchIds: string[];
};

/**
 * Resolve a user's full permission set in a single round-trip.
 *
 *   permissions = (role's RolePermission grants ∪ UserPermission GRANTs)
 *                 minus UserPermission DENYs
 *
 * If the role is a system role (i.e. Admin), short-circuit to "every
 * permission" — that's how the legacy ROLES.ADMIN bypass is replaced.
 */
export const resolvePermissions = async (
  userId: string
): Promise<UserPermissionContext | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      roleId: true,
      branchScope: true,
      branchId: true,
      role: {
        select: {
          id: true,
          name: true,
          isSystem: true,
          rolePermissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
      userPermissions: {
        select: {
          effect: true,
          permission: { select: { key: true } },
        },
      },
      userBranches: { select: { branchId: true } },
    },
  });

  if (!user || !user.role) return null;

  let permissions: Set<string>;
  if (user.role.isSystem) {
    const all = await db.permissionDef.findMany({ select: { key: true } });
    permissions = new Set([...ALL_PERMISSION_KEYS, ...all.map((p) => p.key)]);
  } else {
    permissions = new Set(user.role.rolePermissions.map((r) => r.permission.key));
    for (const up of user.userPermissions) {
      if (up.effect === "GRANT") permissions.add(up.permission.key);
      else permissions.delete(up.permission.key);
    }
  }

  const branchIds =
    user.branchScope === "ALL"
      ? []
      : user.userBranches.length
        ? user.userBranches.map((b) => b.branchId)
        : user.branchId
          ? [user.branchId]
          : [];

  return {
    userId: user.id,
    roleId: user.role.id,
    roleName: user.role.name,
    isSystemRole: user.role.isSystem,
    permissions,
    branchScope: user.branchScope,
    branchIds,
  };
};

/**
 * Convenience type-safe check. Accepts any PermissionKey from the registry.
 */
export const hasPermission = (
  ctx: UserPermissionContext,
  key: PermissionKey
): boolean => ctx.permissions.has(key);
