import { z } from "zod";

/* -----------------------------
   HELPERS
------------------------------ */

const optionalId = z
  .string()
  .trim()
  .min(1)
  .nullish()
  .transform((v) => v ?? null);

/** Money arrives from forms as rupees; the database stores paise. */
const paise = z
  .number({ invalid_type_error: "Enter an amount" })
  .int("Amount must be a whole number of paise")
  .min(0, "Amount cannot be negative");

const optionalPaise = paise.nullish().transform((v) => v ?? null);

const dateInput = z
  .string()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Enter a valid date");

const optionalDateInput = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Enter a valid date");

export const detentionBasisSchema = z.enum(["DAY", "HOUR"]);

/* -----------------------------
   BANDS
------------------------------ */

/**
 * One stacked tier. `toUnit` null means open-ended ("from the 3rd day"), so a
 * slab's last band normally leaves it empty.
 */
export const detentionSlabBandSchema = z
  .object({
    fromUnit: z.number().int().min(1, "Bands start at unit 1"),
    toUnit: z.number().int().min(1).nullish().transform((v) => v ?? null),
    ratePaise: paise,
  })
  .refine((b) => b.toUnit === null || b.toUnit >= b.fromUnit, {
    message: "Band end must not be before its start",
    path: ["toUnit"],
  });

/**
 * Bands must tile the run without gaps or overlaps, and only the last may be
 * open-ended — otherwise the charge would depend on row order, which is
 * exactly the ambiguity the slab is meant to remove.
 */
const bandsSchema = z
  .array(detentionSlabBandSchema)
  .min(1, "Add at least one rate band")
  .superRefine((bands, ctx) => {
    const sorted = [...bands].sort((a, b) => a.fromUnit - b.fromUnit);

    sorted.forEach((band, index) => {
      if (index === 0 && band.fromUnit !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The first band must start at unit 1",
          path: [index, "fromUnit"],
        });
      }
      if (band.toUnit === null && index !== sorted.length - 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only the last band may be open-ended",
          path: [index, "toUnit"],
        });
      }
      const previous = sorted[index - 1];
      if (previous && previous.toUnit !== null && band.fromUnit !== previous.toUnit + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            band.fromUnit > previous.toUnit + 1
              ? "Gap between bands — every unit must be covered"
              : "Bands overlap",
          path: [index, "fromUnit"],
        });
      }
    });
  });

/* -----------------------------
   SLAB
------------------------------ */

const slabBase = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),

  /** All scopes optional — null means "applies to any". */
  transportId: optionalId,
  customerId: optionalId,
  vehicleTypeId: optionalId,

  freightFromPaise: optionalPaise,
  freightToPaise: optionalPaise,

  basis: detentionBasisSchema.default("DAY"),

  firstDayFree: z.boolean().default(false),
  lastDayFree: z.boolean().default(false),

  freeHours: z.number().int().min(0).nullish().transform((v) => v ?? null),
  blockHours: z.number().int().min(1).nullish().transform((v) => v ?? null),

  priority: z.number().int().min(0).default(0),

  effectiveFrom: dateInput,
  effectiveTo: optionalDateInput,

  isActive: z.boolean().default(true),

  bands: bandsSchema,
});

const withSlabRules = (schema: typeof slabBase) =>
  schema
    .superRefine((value, ctx) => {
      if (
        value.freightFromPaise !== null &&
        value.freightToPaise !== null &&
        value.freightToPaise < value.freightFromPaise
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Freight range end must not be below its start",
          path: ["freightToPaise"],
        });
      }

      if (
        value.effectiveTo !== null &&
        value.effectiveTo.getTime() < value.effectiveFrom.getTime()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must not be before the start date",
          path: ["effectiveTo"],
        });
      }

      // The two bases read different fields; letting both be filled in would
      // leave the engine quietly ignoring half the form.
      if (value.basis === "HOUR") {
        if (value.blockHours === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hour-based slabs need a block size (the spec uses 24)",
            path: ["blockHours"],
          });
        }
        if (value.firstDayFree || value.lastDayFree) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Free days apply to day-based slabs — use free hours here",
            path: ["firstDayFree"],
          });
        }
      } else if (value.freeHours !== null || value.blockHours !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free hours and block size apply to hour-based slabs only",
          path: ["freeHours"],
        });
      }
    });

export const createDetentionSlabSchema = withSlabRules(slabBase);

/** Update replaces the whole slab including its bands — a partial band list
 *  would silently leave an un-tiled run behind. */
export const updateDetentionSlabSchema = withSlabRules(slabBase);

/* -----------------------------
   QUOTE
------------------------------ */

/** Query for `GET /detention/challans/:id/quote`. */
export const detentionQuoteQuerySchema = z.object({
  /** Override the resolved reporting date (the operator may know better). */
  reportingAt: optionalDateInput,
  /** Override the resolved unloading date. */
  unloadingAt: optionalDateInput,
  /** Force a specific slab instead of letting the matcher choose. */
  slabId: optionalId,
});

export type DetentionBasisInput = z.infer<typeof detentionBasisSchema>;
export type DetentionSlabBandInput = z.infer<typeof detentionSlabBandSchema>;
export type CreateDetentionSlabInput = z.infer<typeof createDetentionSlabSchema>;
export type UpdateDetentionSlabInput = z.infer<typeof updateDetentionSlabSchema>;
export type DetentionQuoteQuery = z.infer<typeof detentionQuoteQuerySchema>;
