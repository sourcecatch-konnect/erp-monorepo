import { BadRequestError } from "../../lib/error.js";

/** Largest remainders keep every paise; source IDs break ties consistently. */
export function allocateServiceDiscount(
  lines: { id: string; amountPaise: bigint }[],
  discountPaise: bigint,
) {
  const total = lines.reduce((sum, line) => sum + line.amountPaise, 0n);
  if (
    new Set(lines.map((line) => line.id)).size !== lines.length ||
    lines.some((line) => line.amountPaise < 0n) ||
    discountPaise < 0n ||
    discountPaise > total
  )
    throw new BadRequestError("Invalid service bill discount allocation");
  const shares = lines.map((line) => ({
    ...line,
    discountPaise: total ? (discountPaise * line.amountPaise) / total : 0n,
    remainder: total ? (discountPaise * line.amountPaise) % total : 0n,
  }));
  let remaining =
    discountPaise - shares.reduce((sum, line) => sum + line.discountPaise, 0n);
  const ranked = [...shares].sort((a, b) =>
    a.remainder === b.remainder
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const line of ranked) {
    if (remaining === 0n) break;
    line.discountPaise += 1n;
    remaining -= 1n;
  }
  return new Map(
    shares.map((line) => [
      line.id,
      {
        discountPaise: line.discountPaise,
        netAmountPaise: line.amountPaise - line.discountPaise,
      },
    ]),
  );
}
