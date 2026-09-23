export const rupeesToPaise = (value: number) => Math.round(value * 100);

// Money is stored as paise in BigInt; Prisma returns it as `bigint`. Accept
// both so DB reads and plain numbers convert through the same boundary.
export const paiseToRupees = (value: bigint | number) => Number(value) / 100;

export const convertRupeeFieldsToPaise = <T extends Record<string, unknown>>(
  data: T,
  fields: string[],
): T => {
  const converted = { ...data } as Record<string, unknown>;

  for (const field of fields) {
    const value = converted[field];

    if (typeof value === "number") {
      converted[field] = rupeesToPaise(value);
    }
  }

  return converted as T;
};

/**
 * Round-half-up a BigInt paise amount by a basis-points rate (1 bps = 0.01%,
 * so 10000 bps = 100%). Same integer-only shape as billing's GST calc
 * (`taxForRate` in billing.service.ts) — never floating point on money.
 */
export const roundPaiseByBps = (amountPaise: bigint, rateBps: number): bigint =>
  (amountPaise * BigInt(rateBps) + 5000n) / 10000n;
