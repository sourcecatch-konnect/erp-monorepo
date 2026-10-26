/**
 * Money on the Dashboard is read at a glance, not reconciled, so amounts are
 * shown in lakh/crore the way the office says them. The exact rupee figure
 * goes in a `title` wherever a short form is printed.
 */

const RUPEE = (paise: number) => paise / 100;

/** "42.61" + "L" — split so the unit can be set smaller than the number. */
export const shortMoneyParts = (
  paise: number,
): { value: string; unit: string } => {
  const rupees = RUPEE(paise);
  const abs = Math.abs(rupees);
  if (abs >= 10_000_000)
    return { value: (rupees / 10_000_000).toFixed(2), unit: "Cr" };
  if (abs >= 100_000)
    return { value: (rupees / 100_000).toFixed(2), unit: "L" };
  if (abs >= 1_000) return { value: (rupees / 1_000).toFixed(1), unit: "K" };
  return { value: rupees.toFixed(0), unit: "" };
};

/** "₹42.61L" on one line, for a table cell or a row's amount column. */
export const shortMoney = (paise: number): string => {
  const { value, unit } = shortMoneyParts(paise);
  return `₹${value}${unit}`;
};

/** The full figure, for the `title` behind every short form. */
export const exactMoney = (paise: number): string =>
  RUPEE(paise).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

export const count = (n: number): string => n.toLocaleString("en-IN");

/** "▲ 8.2%" / "▼ 1.1%" — null when there was nothing to compare against. */
export const deltaLabel = (pct: number | null): string | null => {
  if (pct === null || !Number.isFinite(pct)) return null;
  const arrow = pct >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
};
