"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBook,
  IconRoute,
  IconTargetArrow,
  IconUserCircle,
} from "@tabler/icons-react";
import { cn } from "@skerp/ui/lib/util";
import { IS_TRAINING_ENVIRONMENT } from "../environment";
import {
  TRAINING_LANGUAGES,
  setTrainingLanguage,
  useTrainingLanguage,
} from "../i18n";

const LINKS = [
  { href: "/training", label: "My role & training", icon: IconUserCircle },
  {
    href: "/training/process-map",
    label: "How the business works",
    icon: IconRoute,
  },
  { href: "/training/glossary", label: "Glossary", icon: IconBook },
  // Missions use the demo data, so they only exist on the training copy.
  ...(IS_TRAINING_ENVIRONMENT
    ? [
        {
          href: "/training/missions",
          label: "Practice missions",
          icon: IconTargetArrow,
        },
      ]
    : []),
];

/** The training screens, always one click apart. */
export function TrainingNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/training"
      ? !LINKS.some(
          (link) => link.href !== "/training" && pathname.startsWith(link.href),
        )
      : pathname.startsWith(href);

  return (
    <nav
      aria-label="Training"
      className="flex flex-wrap items-center gap-1 border-b border-border"
    >
      {LINKS.map(({ href, label, icon: LinkIcon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <LinkIcon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}

      <LanguageToggle />
    </nav>
  );
}

/**
 * English / हिंदी, on every training screen. Each language is named in its own
 * script, which is what a reader scans for. Untranslated text stays English,
 * so switching never leaves a blank on screen.
 */
function LanguageToggle() {
  const lang = useTrainingLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className="ms-auto mb-1.5 inline-flex overflow-hidden rounded-lg border border-border bg-card"
    >
      {TRAINING_LANGUAGES.map((item) => {
        const on = item.key === lang;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => setTrainingLanguage(item.key)}
            className={cn(
              "border-s px-2.5 py-1 text-xs font-medium transition-colors duration-150 first:border-s-0",
              on
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.native}
          </button>
        );
      })}
    </div>
  );
}
