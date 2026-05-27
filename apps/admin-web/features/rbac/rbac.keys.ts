export const rbacKeys = {
  permissions: ["rbac", "permissions"] as const,
  roles: ["rbac", "roles"] as const,
  role: (id: string) => ["rbac", "role", id] as const,
  users: ["rbac", "users"] as const,
  user: (id: string) => ["rbac", "user", id] as const,
  branches: ["rbac", "branches"] as const,
  auditLog: (params: Record<string, unknown>) =>
    ["rbac", "audit-log", params] as const,
};
