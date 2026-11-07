import { z } from "zod";

/**
 * DC Acknowledgement + Approval (LDC phase L5).
 *
 * One acknowledgement per challan: the broker's claim, transcribed by staff
 * from his bill and email (the broker has no ERP login). An approver then
 * rules on it. The schemas are shared by the server (`.parse`) and the web
 * forms (`zodResolver`), so the two can never drift.
 */

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
/** Paise. Optional everywhere — an ack may legitimately claim nothing under
 *  a head. `nullish` rather than defaulting to 0 so "not claimed" stays
 *  distinguishable from "claimed nil", the same distinction the detention
 *  claim fix (D-14) had to restore on the payment slip. */
const optionalPaise = z.coerce.bigint().nonnegative().nullish();
const optionalCount = z.coerce.number().int().min(0).nullish();

export const deliveryChallanAckItemSchema = z.object({
  challanItemId: id,
  totalQty: z.coerce.number().int().min(0),
  receivedQty: z.coerce.number().int().min(0),
  damageQty: z.coerce.number().int().min(0).default(0),
});

const ackItemRules = (
  item: z.infer<typeof deliveryChallanAckItemSchema>,
  ctx: z.RefinementCtx,
) => {
  // Mirrors the DB CHECK, so the operator gets a field error instead of a
  // 500 from a constraint violation.
  if (item.receivedQty > item.totalQty)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["receivedQty"],
      message: "Received cannot exceed the quantity sent",
    });
  if (item.damageQty > item.totalQty)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["damageQty"],
      message: "Damaged cannot exceed the quantity sent",
    });
};

export const upsertDeliveryChallanAckSchema = z
  .object({
    /** Drives the detention window once this ack is approved (Q18). */
    reportingDate: isoDate.nullish(),
    unloadingDate: isoDate.nullish(),
    collectionDate: isoDate.nullish(),

    claimedDetentionDays: optionalCount,
    claimedDetentionPaise: optionalPaise,
    parkingPaise: optionalPaise,
    otherPaise: optionalPaise,
    labourPaise: optionalPaise,
    damagePaise: optionalPaise,

    remarks: z.string().trim().max(500).nullish(),
    podAttachmentId: id.nullish(),

    items: z.array(deliveryChallanAckItemSchema).max(500).default([]),

    /** Optimistic concurrency when editing an existing acknowledgement. */
    version: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    value.items.forEach((item, index) => {
      const nested: z.RefinementCtx = {
        ...ctx,
        addIssue: (issue) =>
          ctx.addIssue({
            ...issue,
            path: ["items", index, ...(issue.path ?? [])],
          }),
      };
      ackItemRules(item, nested);
    });

    if (
      value.reportingDate &&
      value.unloadingDate &&
      value.unloadingDate < value.reportingDate
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unloadingDate"],
        message: "Unloading cannot be before reporting",
      });
  });

export const approveDeliveryChallanSchema = z.object({
  /** Approved figures. Omitted means "take the accepted ack's number". */
  approvedDetentionDays: optionalCount,
  approvedParkingPaise: optionalPaise,
  approvedOtherPaise: optionalPaise,
  approvedLabourPaise: optionalPaise,
  approvedDamagePaise: optionalPaise,
  approvedShortagePaise: optionalPaise,

  remarks: z.string().trim().max(500).nullish(),
});

export const revokeDeliveryChallanApprovalSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  version: z.coerce.number().int().min(1),
});

export type UpsertDeliveryChallanAckInput = z.infer<
  typeof upsertDeliveryChallanAckSchema
>;
export type ApproveDeliveryChallanInput = z.infer<
  typeof approveDeliveryChallanSchema
>;
export type RevokeDeliveryChallanApprovalInput = z.infer<
  typeof revokeDeliveryChallanApprovalSchema
>;
