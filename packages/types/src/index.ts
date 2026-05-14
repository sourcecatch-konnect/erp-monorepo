export type AppKind = "admin" | "employee";

export type PermissionAction = "view" | "create" | "update" | "delete";

export type PermissionModule =
  | "dashboard"
  | "employees"
  | "roles"
  | "permissions"
  | "masters"
  | "orders"
  | "lorry_receipts"
  | "trips"
  | "fleet_tracking"
  | "operations"
  | "accounts";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  app: AppKind;
  roleId?: string;
  companyId?: string;
  branchId?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}
