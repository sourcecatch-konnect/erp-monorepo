export const rupeesToPaise = (value: number) => Math.round(value * 100);

// Money is stored as paise in BigInt; Prisma returns it as `bigint`. Accept
// both so DB reads and plain numbers convert through the same boundary.
export const paiseToRupees = (value: bigint | number) => Number(value) / 100;

export const convertRupeeFieldsToPaise = <
  T extends Record<string, unknown>,
>(
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
