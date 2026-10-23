export function toValidDate(value: unknown): Date | undefined {
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Serializes a picked local date/time with its UTC offset attached (e.g.
// "2026-09-19T14:00:00+05:30"). A bare "YYYY-MM-DDTHH:mm" string has no
// timezone, so `new Date(...)` on the server parses it in the SERVER's local
// time (often UTC) rather than the browser's — for IST (+5:30) that silently
// shifts every timestamp by 5.5 hours and can make a past time look "in the
// future" (or vice versa). Always include the offset to make the instant
// unambiguous regardless of where it's parsed.
export function toLocalDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`
  );
}
