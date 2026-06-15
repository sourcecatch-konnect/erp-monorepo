/**
 * GSTIN format: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
 * Example: 27ABCDE1234F1Z5
 * State codes 01-37 are valid; we use a common set.
 */
import { pick, randAlpha, randDigits } from "./random";

const STATE_CODES = [
  "01","02","03","04","05","06","07","08","09","10",
  "11","12","13","14","15","16","17","18","19","20",
  "21","22","23","24","25","26","27","28","29","30",
  "31","32","33","34","35","36","37",
];

const ENTITY_CHARS_FOR_PAN = ["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"];
const LAST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const REG_NUM_CHARS = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function fakeGSTIN(): string {
  const stateCode = pick(STATE_CODES);
  const pan4 = randAlpha(4);
  const entityChar = pick(ENTITY_CHARS_FOR_PAN);
  const digits = randDigits(4);
  const panLast = randAlpha(1);
  const regNum = pick(REG_NUM_CHARS);
  const last = pick(LAST_CHARS);
  return `${stateCode}${pan4}${entityChar}${digits}${panLast}${regNum}Z${last}`;
}
