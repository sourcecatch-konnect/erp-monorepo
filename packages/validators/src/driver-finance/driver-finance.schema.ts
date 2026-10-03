import { z } from "zod";
// Same PaymentMode enum the vendor-payment disbursement uses.
import { paymentModeSchema } from "../cash/creditor.schema.js";

/**
 * Driver finance (Driver Lifecycle epic): salary advances and payouts. Amounts
 * travel as paise strings (z.coerce.bigint), same as vendor payment.
 */

const id = z.string().trim().min(1);
const isoDate = z.coerce.date();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const driverFinanceEntryStatusSchema = z.enum(["POSTED", "REVERSED"]);
export const driverPayoutSourceSchema = z.enum(["SALARY_RUN", "LOG_SLIP", "MANUAL"]);

/* ------------------------------------------------------------------ */
/* Salary advance                                                      */
/* ------------------------------------------------------------------ */

export const createDriverSalaryAdvanceSchema = z.object({
  driverId: id,
  branchId: id,
  amountPaise: z.coerce.bigint().positive(),
  paidAt: isoDate,
  mode: paymentModeSchema,
  referenceNo: optionalText(120),
  reason: optionalText(500),
  fundingLedgerId: id,
  /** Generate once per attempt and reuse on retry — a retried request then
   *  returns the first advance instead of creating a second one. */
  clientRequestId: id,
});

/* ------------------------------------------------------------------ */
/* Payout                                                              */
/* ------------------------------------------------------------------ */

/** SALARY_RUN payouts are created by the salary-run screen (Phase 3), never
 *  through this body — so only LOG_SLIP and MANUAL are accepted here. */
export const createDriverPayoutSchema = z
  .object({
    driverId: id,
    /** Required for MANUAL. For LOG_SLIP the server uses the journey's home
     *  branch and ignores this. */
    branchId: id.optional(),
    source: z.enum(["LOG_SLIP", "MANUAL"]),
    logSlipId: id.optional(),
    amountPaise: z.coerce.bigint().positive(),
    paidAt: isoDate,
    mode: paymentModeSchema,
    referenceNo: optionalText(120),
    fundingLedgerId: id,
    clientRequestId: id,
  })
  .superRefine((value, ctx) => {
    if (value.source === "LOG_SLIP" && !value.logSlipId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logSlipId"],
        message: "A log slip payment needs the log slip",
      });
    if (value.source === "MANUAL" && value.logSlipId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logSlipId"],
        message: "A manual payment cannot point at a log slip",
      });
    if (value.source === "MANUAL" && !value.branchId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchId"],
        message: "Branch is required",
      });
  });

/* ------------------------------------------------------------------ */
/* Salary run                                                          */
/* ------------------------------------------------------------------ */

const month = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM");
const version = z.number().int().positive();

export const driverSalaryRunStatusSchema = z.enum(["DRAFT", "APPROVED", "PAID", "CANCELLED"]);

/** Salary runs are company-wide and run at head office — no branch to pick. */
export const createDriverSalaryRunSchema = z.object({
  month,
});

/** DRAFT edits: absent days / this month's salary / remarks per driver, or
 *  `remove` to drop a driver from the run. Every line is recalculated. */
export const updateDriverSalaryRunSchema = z.object({
  version,
  /** Also save each changed salary as the driver's salary in the Driver
   *  master (so the next run starts from it). Needs Driver master edit. */
  updateMaster: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        driverId: id,
        absentDays: z.number().int().min(0).max(31),
        baseSalaryPaise: z.coerce.bigint().nonnegative(),
        remarks: optionalText(300),
        remove: z.boolean().optional(),
      }),
    )
    .max(1000),
});

export const driverSalaryRunVersionSchema = z.object({ version });

export const cancelDriverSalaryRunSchema = z.object({
  version,
  reason: z.string().trim().min(3, "Give a reason (min 3 characters)").max(500),
});

/** One cash / bank account used for a salary payment, and how much from it. */
export const salaryPaymentSourceSchema = z.object({
  fundingLedgerId: id,
  mode: paymentModeSchema,
  amountPaise: z.coerce.bigint().positive(),
});

export const payDriverSalaryRunSchema = z
  .object({
    driverIds: z.array(id).min(1, "Select at least one driver").max(1000),
    paidAt: isoDate,
    referenceNo: optionalText(120),
    /** Accounts the total is paid from, in order. Their amounts must add up to
     *  what is due; a driver's pay can be split across two accounts. */
    sources: z.array(salaryPaymentSourceSchema).min(1, "Choose an account").max(10),
    /** One id per Pay click; every payout uses `<id>:<driverId>:<n>`, so a
     *  retried click pays nobody twice. */
    clientRequestId: id,
  })
  .superRefine((value, ctx) => {
    const ids = value.sources.map((s) => s.fundingLedgerId);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sources"],
        message: "Each account can be used only once",
      });
  });

export const driverSalaryRunListQuerySchema = z.object({
  status: driverSalaryRunStatusSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const reverseDriverFinanceEntrySchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (min 3 characters)").max(500),
});

/** List filters (paging/search come from the shared list-query parser). */
export const driverFinanceListQuerySchema = z.object({
  driverId: id.optional(),
  status: driverFinanceEntryStatusSchema.optional(),
});

export type CreateDriverSalaryAdvanceInput = z.infer<typeof createDriverSalaryAdvanceSchema>;
export type CreateDriverPayoutInput = z.infer<typeof createDriverPayoutSchema>;
export type ReverseDriverFinanceEntryInput = z.infer<typeof reverseDriverFinanceEntrySchema>;
export type DriverFinanceListQuery = z.infer<typeof driverFinanceListQuerySchema>;
export type CreateDriverSalaryRunInput = z.infer<typeof createDriverSalaryRunSchema>;
export type UpdateDriverSalaryRunInput = z.infer<typeof updateDriverSalaryRunSchema>;
export type PayDriverSalaryRunInput = z.infer<typeof payDriverSalaryRunSchema>;
