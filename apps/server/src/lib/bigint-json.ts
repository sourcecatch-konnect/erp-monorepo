/**
 * Money columns are stored as paise in BigInt (Prisma returns them as JS
 * `bigint`). `JSON.stringify` — used by Express `res.json` — cannot serialize
 * BigInt and throws "Do not know how to serialize a BigInt".
 *
 * Paise values stay well under Number.MAX_SAFE_INTEGER (9.007e15), so emitting
 * them as JSON numbers is safe and keeps the wire/contract as `number` — the
 * frontend continues to treat money as a number. Install this once at startup.
 */
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
): number {
  return Number(this);
};

export {};
