import { z } from "zod";

/**
 * The single source of truth for the rupees → paise boundary.
 *
 * Convention (see `apps/server/src/lib/money.ts` and `apps/web/lib/money.ts`):
 * money is **entered in rupees** on the UI/wire and **stored as paise**
 * (integer, matching the server's BigInt columns). Every schema that accepts a
 * money input must use one of these field factories — never a bespoke
 * `Number(v) * 100` transform, which is how fields drift out of the convention
 * (e.g. a trip freight that forgot to multiply and silently stored rupees in a
 * paise column).
 */

type MoneyOptions = {
  /** Allow an amount of exactly ₹0 (e.g. an empty/repositioning trip). */
  allowZero?: boolean;
};

const toPaise = (value: string | number) => Math.round(Number(value) * 100);

const isValidPaise = (value: number, allowZero: boolean) =>
  Number.isInteger(value) && (allowZero ? value >= 0 : value > 0);

const message = (label: string, allowZero: boolean) =>
  `${label} must be a ${allowZero ? "non-negative" : "positive"} amount`;

/** Required rupee amount → paise. Positive by default; pass `allowZero` for ≥ 0. */
export const rupeesToPaise = (label: string, opts: MoneyOptions = {}) =>
  z
    .union([z.string(), z.number()])
    .transform(toPaise)
    .refine(
      (value) => isValidPaise(value, opts.allowZero ?? false),
      message(label, opts.allowZero ?? false),
    );

/** Optional rupee amount → paise. Blank / undefined / null → `undefined`. */
export const optionalRupeesToPaise = (label: string, opts: MoneyOptions = {}) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }
      return toPaise(value);
    })
    .refine(
      (value) => value === undefined || isValidPaise(value, opts.allowZero ?? false),
      message(label, opts.allowZero ?? false),
    );
