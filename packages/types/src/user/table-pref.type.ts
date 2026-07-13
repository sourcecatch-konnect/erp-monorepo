import { z } from "zod";
import { upsertTablePrefSchema } from "@skerp/validators";

/** A user's saved table layout: column order + visibility map. */
export type TablePrefData = z.infer<typeof upsertTablePrefSchema>;

export type UpsertTablePrefBody = z.input<typeof upsertTablePrefSchema>;
