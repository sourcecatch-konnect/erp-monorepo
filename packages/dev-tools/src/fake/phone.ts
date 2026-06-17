/**
 * Indian phone: [6-9]\d{9}  (10 digits, first digit 6-9)
 */
import { randInt, randDigits } from "./random";

export function fakeIndianPhone(): string {
  const first = String(randInt(6, 9));
  return `${first}${randDigits(9)}`;
}
