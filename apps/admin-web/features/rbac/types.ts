export type PermissionDefDto = {
  id: string;
  key: string;
  moduleCode: string;
  description: string | null;
  isSystem: boolean;
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

export type AuditLogEntry = {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};
