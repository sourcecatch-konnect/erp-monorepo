/**
 * PAN format: [A-Z]{5}[0-9]{4}[A-Z]{1}
 * Example: ABCDE1234F
 */
import { pick, randAlpha, randDigits } from "./random";

const PAN_ENTITY_CHARS = ["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"];

export function fakePAN(): string {
  const first4 = randAlpha(4);
  const entityChar = pick(PAN_ENTITY_CHARS);
  const digits = randDigits(4);
  const last = randAlpha(1);
  return `${first4}${entityChar}${digits}${last}`;
}
