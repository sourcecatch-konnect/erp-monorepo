import { z } from "zod";

export const appKindSchema = z.enum(["admin", "employee"]);

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),

  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
  appKind: appKindSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

/* ------------------------------------------------------------------ */
/* Employee management                                                */
/* ------------------------------------------------------------------ */

const employeePasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: employeePasswordSchema,
  companyId: z.string().min(1, "Company is required"),
  branchId: z.string().min(1, "Branch is required"),
  roleId: z.string().min(1, "Role is required"),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email("Invalid email format").optional(),
  roleId: z.string().min(1, "Role is required").optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number")
    .nullable()
    .optional(),
  companyId: z.string().min(1, "Company is required").optional(),
  branchId: z.string().min(1, "Branch is required").optional(),
  whatsappOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
});

export const resetEmployeePasswordSchema = z.object({
  password: employeePasswordSchema,
});

export const updateEmployeeStatusSchema = z.object({
  status: z.boolean(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ResetEmployeePasswordInput = z.infer<
  typeof resetEmployeePasswordSchema
>;
export type UpdateEmployeeStatusInput = z.infer<
  typeof updateEmployeeStatusSchema
>;
export * from "./master/state.schema.js";
export * from "./master/city.schema.js";
export * from "./master/area.schema.js";
export * from "./master/transport.schema.js";
export * from "./master/driver.schema.js";

export * from "./master/vehicle.schema.js";
export * from "./master/spare-category.schema.js";
export * from "./master/spare-parts.schema.js";
export * from "./master/spare-part-supplier.schema.js"
export * from "./master/company.schema.js";
export * from "./master/branch.schema.js";
export * from "./master/route.schema.js";
export * from "./master/warehouse.schema.js"
export * from "./master/customer.schema.js"
export * from "./master/goods.schema.js"
export * from "./master/labour.schema.js"
export * from "./master/pump.schema.js"
export * from "./master/wagon.schema.js"
export * from "./master/railwayFreighMatrix.schema.js"
export * from "./master/agreement.schema.js"
export * from "./master/rateMatrix.schema.js"
export * from "./master/vehicleType.schema.js"
export * from "./order/order.schema.js"
export * from "./trip/trip.schema.js"
export * from "./admin/rbac.schema.js"
export * from "./attachments/attachment.schema.js"
export * from "./lorry-receipt/lorry-receipt.schema.js"
export * from "./lorry-receipt/delivery.schema.js"
export * from "./lr-group/lr-group.schema.js"
export * from "./vp-schedule/vp-schedule.schema.js"
export * from "./cash/creditor.schema.js"
export * from "./cash/cash-account.schema.js"
export * from "./cash/cash-payment.schema.js"
export * from "./cash/cash-day.schema.js"
export * from "./cash/cash-receivable.schema.js"
export * from "./mrrr/mrrr.schema.js"
export * from "./grn/grn.schema.js"
export * from "./vehicle-journey/vehicle-journey.schema.js"
export * from "./trip-expense/trip-expense.schema.js"
export * from "./log-slip/log-slip.schema.js"
export * from "./user/table-pref.schema.js"
