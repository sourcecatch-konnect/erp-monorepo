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
    custodyLocation: z.string().trim().min(1).max(200),
    provenanceReference: z.string().trim().min(1).max(500),
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
  lifecycleStatus: z
    .enum([
      "HELD",
      "IN_REPAIR",
      "PENDING_APPROVAL",
      "STOCKED",
      "SCRAP_HELD",
      "DISPOSAL_PENDING",
      "DISPOSED",
    ])
    .optional(),
});

export const removedPartActionSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    version: z.coerce.number().int().positive(),
    action: z.enum([
      "SEND_REPAIR",
      "RECEIVE_REPAIR",
      "SUBMIT_VALUATION",
      "APPROVE_STOCK",
      "REJECT",
      "DECLARE_SCRAP",
      "REQUEST_DISPOSAL",
      "APPROVE_DISPOSAL",
    ]),
    reason: z.string().trim().min(1).max(500),
    evidence: z.string().trim().min(1).max(500),
    custodyLocation: z.string().trim().min(1).max(200),
    unitCostPaise: z.coerce.bigint().positive().optional(),
  })
  .refine(
    (input) =>
      !["RECEIVE_REPAIR", "SUBMIT_VALUATION", "APPROVE_STOCK"].includes(
        input.action,
      ) || input.unitCostPaise !== undefined,
    {
      path: ["unitCostPaise"],
      message: "A positive recoverable value is required",
    },
  );
