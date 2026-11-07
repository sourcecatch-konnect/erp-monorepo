import { z } from "zod";
import { optionalRupeesToPaise, rupeesToPaise } from "../_shared/money.js";

/* -----------------------------
   HELPERS
------------------------------ */

/** Blank (a cleared "Any" select) and null both mean "applies to any". */
const optionalId = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

/** Money is entered in rupees and stored as paise (see `_shared/money`). */
const optionalPaise = (label: string) =>
  optionalRupeesToPaise(label, { allowZero: true }).transform((v) => v ?? null);

/** Form inputs arrive as strings; JSON callers may send numbers. */
const wholeNumber = (label: string, min: number) =>
  z.coerce
    .number({ invalid_type_error: `Enter ${label}` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`);

const optionalWholeNumber = (label: string, min: number) =>
  z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) =>
      v === "" || v === null || v === undefined ? null : Number(v),
    )
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= min),
      `${label} must be a whole number of at least ${min}`,
    );

const dateInput = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Date is required");

const optionalDateInput = z
  .union([z.string(), z.date()])
  .nullish()
  .transform((v) => (v ? new Date(v) : null))
  .refine(
    (d) => d === null || !Number.isNaN(d.getTime()),
    "Enter a valid date",
  );

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
    fromUnit: wholeNumber("Band start", 1),
    toUnit: optionalWholeNumber("Band end", 1),
    /** Rupees in, paise out. Blank is refused, not read as ₹0 — a forgotten
     *  rate would otherwise make that band free. */
    ratePaise: z
      .union([z.string(), z.number()])
      .refine((v) => String(v).trim() !== "", "Enter a rate")
      .pipe(rupeesToPaise("Rate", { allowZero: true })),
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
      if (
        previous &&
        previous.toUnit !== null &&
        band.fromUnit !== previous.toUnit + 1
      ) {
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
  /** A label only — derived from the broker and vehicle type, never matched
   *  on. Kept so lists and the LDC payment screen have something to show. */
  name: z.string().trim().min(1, "Name is required").max(120),

  /** Required: a slab prices one broker's detention. There is no house slab —
   *  a broker with no slab quotes zero and says so, rather than silently
   *  inheriting someone else's rate card. */
  transportId: z.string().trim().min(1, "Select a broker / transporter"),

  /** Narrowing scopes. Null means "applies to any". */
  customerId: optionalId,
  vehicleTypeId: optionalId,

  /** Rupees in, paise out. */
  freightFromPaise: optionalPaise("Freight from"),
  freightToPaise: optionalPaise("Freight to"),

  basis: detentionBasisSchema.default("DAY"),

  firstDayFree: z.boolean().default(false),
  lastDayFree: z.boolean().default(false),

  freeHours: optionalWholeNumber("Free hours", 0),
  blockHours: optionalWholeNumber("Block size", 1),

  priority: wholeNumber("Priority", 0).default(0),

  effectiveFrom: dateInput,
  effectiveTo: optionalDateInput,

  isActive: z.boolean().default(true),

  bands: bandsSchema,
});

const withSlabRules = (schema: typeof slabBase) =>
  schema.superRefine((value, ctx) => {
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
export type CreateDetentionSlabInput = z.infer<
  typeof createDetentionSlabSchema
>;
export type UpdateDetentionSlabInput = z.infer<
  typeof updateDetentionSlabSchema
>;
export type DetentionQuoteQuery = z.infer<typeof detentionQuoteQuerySchema>;
