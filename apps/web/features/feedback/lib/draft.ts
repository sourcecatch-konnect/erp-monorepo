/**
 * Unsent feedback is kept per page in localStorage, so closing the sheet by
 * mistake doesn't lose what someone typed. Storage can be unavailable
 * (private mode, blocked site data) — every access is guarded.
 */

const keyFor = (path: string) => `skerp:feedback-draft:${path}`;

export function loadDraft<T>(path: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(keyFor(path));
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(path: string, values: T): void {
  try {
    window.localStorage.setItem(keyFor(path), JSON.stringify(values));
  } catch {
    // Storage full or blocked — the draft is a convenience, not a guarantee.
  }
}

export function clearDraft(path: string): void {
  try {
    window.localStorage.removeItem(keyFor(path));
  } catch {
    // ignore
  }
}
