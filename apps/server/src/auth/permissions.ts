/**
 * Server-side re-export of the shared permission registry.
 *
 * The catalog lives in `@skerp/types/permissions` so server and web both
 * consume the same constants and union type. This file is
 * the import locality the server uses; it's also where any server-only
 * helpers (e.g. PERMS-to-Prisma mappers) should be added in the future.
 */

export {
  PERMS,
  ALL_PERMISSION_KEYS,
  moduleCodeOf,
  type PermissionKey,
  type MasterSlug,
} from "@skerp/types";
