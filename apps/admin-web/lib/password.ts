const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#$%&*";

const pick = (set: string): string =>
  set.charAt(Math.floor(Math.random() * set.length));

/**
 * Generates a strong random password with at least one upper, lower, digit
 * and symbol. Ambiguous characters (O/0, I/l/1) are excluded.
 */
export function generatePassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars: string[] = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  // Fisher-Yates shuffle so the guaranteed chars aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = tmp;
  }
  return chars.join("");
}
