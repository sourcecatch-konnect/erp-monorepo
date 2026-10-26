import type {
  PermissionPageQuery,
  RolePageQuery,
  UserAccessPageQuery,
} from "@skerp/validators";
export const rbacKeys = {
  permissionPage: (params: PermissionPageQuery) =>
    ["rbac", "permissions", "page", params] as const,
  permissions: ["rbac", "permissions"] as const,

  permissionModules: ["rbac", "permission-modules"] as const,

  permissionsByModule: (moduleCode: string) =>
    ["rbac", "permissions", moduleCode] as const,

  roles: ["rbac", "roles"] as const,
  rolesPage: (params: RolePageQuery) =>
    ["rbac", "roles", "page", params] as const,
  role: (id: string) => ["rbac", "role", id] as const,

  users: ["rbac", "users"] as const,
  usersPage: (params: UserAccessPageQuery) =>
    ["rbac", "users", "page", params] as const,
  user: (id: string) => ["rbac", "user", id] as const,

  branches: ["rbac", "branches"] as const,

  auditLog: (params: Record<string, unknown>) =>
    ["rbac", "audit-log", params] as const,
  auditActors: ["rbac", "audit-log-actors"] as const,
};
