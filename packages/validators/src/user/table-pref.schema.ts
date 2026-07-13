import { z } from "zod";

/** Route param naming the table a preference belongs to (e.g. "trips"). */
export const tableKeySchema = z
  .string()
  .regex(/^[a-z0-9_.-]{1,64}$/i, "Invalid table key");

/**
 * A user's saved layout for one table: column order plus the visibility map
 * (TanStack `VisibilityState` — absent id = visible).
 */
export const upsertTablePrefSchema = z.object({
  order: z.array(z.string().min(1).max(40)).max(32),
  visibility: z.record(z.string().max(40), z.boolean()),
});
