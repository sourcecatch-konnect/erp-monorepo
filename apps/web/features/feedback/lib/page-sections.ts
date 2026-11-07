/**
 * Names a part of the page from the page itself, so no feature page has to
 * register anything: the visible headings and card titles inside the AppShell
 * work area (<main>), in page order. Used when the reporter points at the
 * screen — there is no "Page section" field to fill in by hand.
 */

const SECTION_SELECTOR = 'h1, h2, h3, [data-slot="card-title"]';
const MAX_SECTION_CHARS = 80;

const textOf = (element: HTMLElement): string =>
  (element.innerText || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SECTION_CHARS);

const isVisible = (element: HTMLElement): boolean =>
  typeof element.checkVisibility === "function"
    ? element.checkVisibility()
    : element.offsetParent !== null;

const headings = (): HTMLElement[] => {
  const main = document.querySelector("main");
  return main ? Array.from(main.querySelectorAll<HTMLElement>(SECTION_SELECTOR)) : [];
};

/** The heading the picked element sits under, else the element's own text. */
export function sectionFor(element: HTMLElement): string | undefined {
  let nearest: HTMLElement | undefined;
  // querySelectorAll returns document order: stop at the first heading after the element.
  for (const heading of headings()) {
    const contains = heading.contains(element);
    const before = Boolean(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!contains && !before) break;
    if (isVisible(heading) && textOf(heading)) nearest = heading;
  }
  return (nearest ? textOf(nearest) : textOf(element)) || undefined;
}
