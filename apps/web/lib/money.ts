export const paiseToRupees = (value: number) => value / 100;

export const formatRupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value);

export const formatPaise = (value: number) =>
  formatRupees(paiseToRupees(value));

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
