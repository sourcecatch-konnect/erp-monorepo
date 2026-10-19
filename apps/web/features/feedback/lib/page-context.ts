import type { FeedbackContext, FeedbackPage } from "@skerp/types";
import { NAV_SECTIONS, isNavGroup } from "@/config/navigation";

/**
 * Works out which screen the user is on from the URL alone, by matching it
 * against the sidebar — so no feature page has to register itself.
 */

type NavTrail = { href: string; trail: string[] };

const stripQuery = (href: string) => href.split("?")[0] ?? href;

const NAV_TRAILS: NavTrail[] = NAV_SECTIONS.flatMap((section) =>
  section.items.flatMap((item): NavTrail[] => {
    if (!isNavGroup(item)) {
      return [{ href: stripQuery(item.href), trail: [section.label, item.title] }];
    }
    const groupLink =
      "href" in item && typeof item.href === "string"
        ? [{ href: stripQuery(item.href), trail: [section.label, item.title] }]
        : [];
    return [
      ...groupLink,
      ...item.items.map((leaf) => ({
        href: stripQuery(leaf.href),
        trail: [section.label, item.title, leaf.title],
      })),
    ];
  }),
);

/** "lorry-receipts" → "Lorry Receipts" */
const titleize = (segment: string) =>
  segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** cuid / uuid / document numbers — anything that identifies one record. */
const looksLikeId = (segment: string) =>
  /^[0-9a-f-]{32,36}$/i.test(segment) ||
  /^[a-z0-9]{20,}$/i.test(segment) ||
  (/\d/.test(segment) && segment.length >= 4);

export type PageInfo = FeedbackPage & {
  breadcrumb: string[];
  /** Friendly name of the open record, when the breadcrumb knows it. */
  entityLabel?: string;
};

export function describePage(
  pathname: string,
  breadcrumbLabels: Record<string, string>,
): PageInfo {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumb = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    return breadcrumbLabels[href] ?? titleize(decodeURIComponent(segment));
  });

  let best: NavTrail | undefined;
  for (const entry of NAV_TRAILS) {
    const matches =
      pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (matches && (!best || entry.href.length > best.href.length)) {
      best = entry;
    }
  }

  if (!best) {
    return {
      path: pathname || "/",
      title: breadcrumb.at(-1) ?? "Home",
      module:
        breadcrumb.length > 1 ? breadcrumb.slice(0, -1).join(" › ") : "General",
      breadcrumb,
    };
  }

  const rest = pathname
    .slice(best.href.length)
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const entityId = rest.find(looksLikeId);
  const subPages = rest.filter((segment) => !looksLikeId(segment)).map(titleize);
  const leafTitle = best.trail.at(-1) ?? "Page";

  return {
    path: pathname,
    title: [leafTitle, ...subPages].join(" › "),
    module: best.trail.slice(0, -1).join(" › ") || "General",
    ...(entityId ? { entityId: entityId.slice(0, 80) } : {}),
    ...(entityId && breadcrumbLabels[pathname]
      ? { entityLabel: breadcrumbLabels[pathname] }
      : {}),
    breadcrumb,
  };
}

/** Browser details attached to every submission (no personal data). */
export const describeClient = (): Omit<
  FeedbackContext,
  "breadcrumb" | "recentApi" | "recentErrors"
> => ({
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
  userAgent: navigator.userAgent.slice(0, 400),
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  screen: `${window.screen.width}x${window.screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
  online: navigator.onLine,
});
