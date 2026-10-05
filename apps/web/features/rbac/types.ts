export type PermissionDefDto = {
  id: string;
  key: string;
  moduleCode: string;
  description: string | null;
  isSystem: boolean;
};
export type PermissionModuleDto = {
  moduleCode: string;
  label: string;
  permissionCount: number;
};
export type RoleSummary = {
  id: string;
  name: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; rolePermissions: number };
};

export type RoleDetail = RoleSummary & {
  permissionKeys: string[];
};

export type UserSummary = {
  id: string;
  userName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  status: boolean;
  branchScope: "ALL" | "ASSIGNED";
  branchId: string;
  role: { id: string; name: string; isSystem: boolean } | null;
  userBranches: { branchId: string }[];
};

export type UserAccessDetail = UserSummary & {
  branchIds: string[];
  overrides: { key: string; effect: "GRANT" | "DENY" }[];
};

export type BranchOption = {
  id: string;
  name: string;
  branchCode: string;
  shortCode: string;
};

export type AuditActor = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AuditLogQuery = {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  /** ISO instant, inclusive. */
  from?: string;
  /** ISO instant, exclusive. */
  to?: string;
  page?: number;
  size?: number;
};

export type AuditLogEntry = {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  /** Display names for every id this entry mentions (entity, roleId, branchIds…). */
  refs: Record<string, string>;
  createdAt: string;
  actor: AuditActor | null;
};
