/**
 * Options for "Page section", read from the page itself when the panel opens,
 * so no feature page has to register anything: the visible headings and card
 * titles inside the AppShell work area (<main>), in page order.
 */

const SECTION_SELECTOR = 'h1, h2, h3, [data-slot="card-title"]';
const MAX_SECTIONS = 20;
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

export function listPageSections(): string[] {
  const seen = new Set<string>();
  const sections: string[] = [];
  for (const heading of headings()) {
    if (!isVisible(heading)) continue;
    const text = textOf(heading);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    sections.push(text);
    if (sections.length >= MAX_SECTIONS) break;
  }
  return sections;
}

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
