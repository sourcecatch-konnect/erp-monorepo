/** Indian financial year helpers (April–March), mirrors the server's
 *  `fyCodeFor` in apps/server/src/modules/_shared/doc-number.ts. */

const pad = (v: number) => String(v % 100).padStart(2, "0");

export function fyCodeFor(date = new Date()): string {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1; // month 3 = April
  return `${pad(start)}-${pad(start + 1)}`;
}

/** Current FY first, then the previous `count - 1` years. */
export function recentFyCodes(count = 4): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const startNow = now.getMonth() >= 3 ? year : year - 1;
  return Array.from({ length: count }, (_, i) => {
    const s = startNow - i;
    return `${pad(s)}-${pad(s + 1)}`;
  });
}
