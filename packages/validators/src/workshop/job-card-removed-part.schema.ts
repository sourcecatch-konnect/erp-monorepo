import { z } from "zod";

const id = z.string().trim().min(1);
const paise = z.coerce.bigint().min(0n);

export const removedPartConditionSchema = z.enum([
  "REUSABLE",
  "REPAIRABLE",
  "SCRAP",
]);

export const createJobCardRemovedPartSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    sparePartId: id,
    relatedPartLineId: id.optional(),
    qty: z.coerce.number().int().positive(),
    condition: removedPartConditionSchema,
    unitCostPaise: paise.optional(),
    remarks: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) =>
      v.condition !== "REUSABLE" ||
      v.relatedPartLineId ||
      v.unitCostPaise !== undefined,
    {
      message:
        "A reusable part needs either the original part line it replaced, or a manually entered cost",
      path: ["unitCostPaise"],
    },
  );

export const jobCardRemovedPartListQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  condition: removedPartConditionSchema.optional(),
});
