/** Deterministic-ish random helpers — NOT crypto-safe, only for test data. */

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randDigits(n: number): string {
  return Array.from({ length: n }, () => String(randInt(0, 9))).join("");
}

export function randAlpha(n: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: n }, () => pick(chars.split(""))).join("");
}
