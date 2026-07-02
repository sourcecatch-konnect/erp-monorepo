/**
 * Money helpers — the single source of truth for the web app.
 *
 * Contract: money is stored and sent over the wire as **paise** (integer),
 * matching the server's BigInt columns. Inputs are entered in **rupees** and
 * converted to paise at the validator boundary (`@skerp/validators`).
 *
 *   - value came from the API / a paise column?  → `formatPaise`
 *   - value is already rupees in hand?           → `formatRupees`
 *
 * Never format a paise value with `formatRupees` — it renders 100× too large.
 * This is exactly the bug that used to live in the LR and trip screens.
 */

const EM_DASH = "—";

export const paiseToRupees = (value: number) => value / 100;
export const rupeesToPaise = (value: number) => Math.round(value * 100);

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isNaN(num) ? null : num;
};

/** Format a **rupee** amount as INR. Null / blank / NaN → em dash. */
export const formatRupees = (value: string | number | null | undefined) => {
  const num = toNumber(value);
  return num === null ? EM_DASH : inr.format(num);
};

/** Format a **paise** amount (as stored / returned by the API) as INR. */
export const formatPaise = (value: string | number | null | undefined) => {
  const num = toNumber(value);
  return num === null ? EM_DASH : inr.format(paiseToRupees(num));
};

/**
 * Compact Indian-numbering format: ₹27K, ₹1.48L, ₹2.77Cr. Picks the largest
 * unit that yields a value ≥ 1 (thousand → K, lakh → L, crore → Cr); below a
 * thousand it shows plain rupees. Trailing zeros are trimmed. Use for dense
 * display (tables, totals); pair with `formatPaise` in a title for exact value.
 */
export const formatRupeesCompact = (value: number): string => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  const unit = (n: number, suffix: string) =>
    `${sign}₹${n.toFixed(2).replace(/\.?0+$/, "")}${suffix}`;

  if (abs >= 1_00_00_000) return unit(abs / 1_00_00_000, "Cr");
  if (abs >= 1_00_000) return unit(abs / 1_00_000, "L");
  if (abs >= 1_000) return unit(abs / 1_000, "K");
  return `${sign}₹${abs.toFixed(Number.isInteger(abs) ? 0 : 2)}`;
};

export const formatPaiseCompact = (value: number) =>
  formatRupeesCompact(paiseToRupees(value));
