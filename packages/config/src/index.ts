export const defaultServerPort = 3000;
export const defaultAdminWebPort = 3001;
export const defaultEmployeeWebPort = 3002;

export const permissionModules = [
  "dashboard",
  "employees",
  "roles",
  "permissions",
  "masters",
  "orders",
  "lorry_receipts",
  "trips",
  "fleet_tracking",
  "operations",
  "accounts",
] as const;
