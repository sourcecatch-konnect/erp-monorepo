import { z } from "zod";

export const roleNameSchema = z
  .string()
  .trim()
  .min(2, "Role name must be at least 2 characters")
  .max(60, "Role name must be at most 60 characters");

export const createRoleSchema = z.object({
  name: roleNameSchema,
  /** Start with a snapshot of this role's permissions. Later edits to it don't flow through. */
  inheritFromRoleId: z.string().trim().min(1).optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const renameRoleSchema = z.object({
  name: roleNameSchema,
});
export type RenameRoleInput = z.infer<typeof renameRoleSchema>;

export const copyRoleSchema = z.object({
  name: roleNameSchema,
});
export type CopyRoleInput = z.infer<typeof copyRoleSchema>;

export const setRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()).max(1000),
});
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;

export const branchScopeSchema = z.enum(["ALL", "ASSIGNED"]);
export type BranchScope = z.infer<typeof branchScopeSchema>;

export const permissionEffectSchema = z.enum(["GRANT", "DENY"]);
export type PermissionEffect = z.infer<typeof permissionEffectSchema>;

export const userPermissionOverrideSchema = z.object({
  key: z.string().min(1),
  effect: permissionEffectSchema,
});
export type UserPermissionOverride = z.infer<
  typeof userPermissionOverrideSchema
>;

/**
 * Shape consumed by `PATCH /admin/users/:id/access`. Every field is
 * optional so the drawer can submit only what changed; superRefine ensures
 * ASSIGNED scope requires at least one branch.
 */
export const updateUserAccessSchema = z
  .object({
    roleId: z.string().min(1).optional(),
    branchScope: branchScopeSchema.optional(),
    branchIds: z.array(z.string().min(1)).optional(),
    overrides: z.array(userPermissionOverrideSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.branchScope === "ASSIGNED" && val.branchIds?.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchIds"],
        message: "Select at least one branch when scope is ASSIGNED",
      });
    }
  });
export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;

/** Bounded, zero-based permission pages for the access drawer. */
export const permissionPageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(100000).default(0),
  size: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(120).optional(),
  moduleCode: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .optional(),
  roleId: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .optional(),
});
export type PermissionPageQuery = z.infer<typeof permissionPageQuerySchema>;

/** Bounded, zero-based list pages with an optional free-text search. */
const searchPageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(100000).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
  search: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || undefined)
    .optional(),
});

/** User pages for Settings → Access; search matches role name. */
export const userAccessPageQuerySchema = searchPageQuerySchema;
export type UserAccessPageQuery = z.infer<typeof userAccessPageQuerySchema>;

/** User pages for Settings → Users; search matches name, email or username. */
export const employeePageQuerySchema = searchPageQuerySchema;
export type EmployeePageQuery = z.infer<typeof employeePageQuerySchema>;

/** Role pages for Settings → Roles; search matches role name. */
export const rolePageQuerySchema = searchPageQuerySchema;
export type RolePageQuery = z.infer<typeof rolePageQuerySchema>;
