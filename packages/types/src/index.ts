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
export * from "./master/goods.type.js"
export * from "./master/labour.type.js"
export * from "./master/pump.type.js"
export * from "./master/wagon.type.js"
export * from "./master/railwayFreighMatrix.type.js"
export * from "./master/rateMatrix.type.js"
export * from "./master/agreement.type.js"
export * from "./master/vehicleType.type.js"
export * from "./order/order.type.js"
export * from "./trip/trip.type.js"
export * from "./lorry-receipt/lorry-receipt.type.js"
export * from "./lr-group/lr-group.type.js"
export * from "./cash/cash.type.js"
export * from "./tracking.js"
export * from "./permissions.js"
export * from "./vp-schedule/vp-schedule.type.js"
export * from "./mrrr/mrrr.type.js"
export * from "./grn/grn.type.js"
export * from "./vp-loading/vp-loading.type.js"
export * from "./vehicle-journey/vehicle-journey.type.js"
export * from "./log-slip/log-slip.type.js"
