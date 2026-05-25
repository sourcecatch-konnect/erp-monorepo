export type AppKind = "admin" | "employee";

export type PermissionAction = "view" | "create" | "update" | "delete";

export type PermissionModule =
  | "dashboard"
  | "employees"
  | "roles"
  | "permissions"
  | "masters"
  | "masters.state"
  | "masters.city"
  | "masters.area"
  | "masters.transport"
  | "masters.vehicle"
  | "masters.driver"
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

export interface LoginBody {
  email: string;
  password: string;
}
export type JwtPayload = {
  userId: string;
  email: string;
  role: string;
  appKind: "admin" | "employee";
};

export interface AuthUser {
  id: string;
  email: string;
  role: {
    id: string;
    name: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
export * from "./master/state.type.js"
export * from "./master/city.type.js"
export * from "./master/area.type.js"
export * from "./master/api.type.js"
export * from "./master/transport.type.js"
export * from "./shared/index.js"
export * from "./master/vehicle.type.js"
export * from "./master/spare-category.type.js"
export * from "./master/spare-part.type.js"
export * from "./master/spare-partsSuppiler.type.js"
export * from "./master/customer.type.js"
export * from "./master/company.type.js"
export * from "./master/branch.type.js"
export * from "./master/route.type.js"
export * from "./master/warehouse.type.js"
export * from "./master/driver.type.js"