import { z } from "zod";

const id = z.string().trim().min(1);
const paise = z.coerce.bigint().min(0n);

export const removedPartConditionSchema = z.enum(["REUSABLE", "REPAIRABLE", "SCRAP"]);

export const createJobCardRemovedPartSchema = z
  .object({
    sparePartId: id,
    relatedPartLineId: id.optional(),
    qty: z.coerce.number().int().positive(),
    condition: removedPartConditionSchema,
    unitCostPaise: paise.optional(),
    remarks: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.condition !== "REUSABLE" || v.relatedPartLineId || v.unitCostPaise !== undefined,
    {
      message:
        "A reusable part needs either the original part line it replaced, or a manually entered cost",
      path: ["unitCostPaise"],
    },
  );
