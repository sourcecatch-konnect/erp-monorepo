"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBook, IconRoute, IconUserCircle } from "@tabler/icons-react";
import { cn } from "@skerp/ui/lib/util";

const LINKS = [
  { href: "/training", label: "My role & training", icon: IconUserCircle },
  { href: "/training/process-map", label: "How the business works", icon: IconRoute },
  { href: "/training/glossary", label: "Glossary", icon: IconBook },
] as const;

/** The three training screens, always one click apart. */
export function TrainingNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/training"
      ? !LINKS.some((link) => link.href !== "/training" && pathname.startsWith(link.href))
      : pathname.startsWith(href);

  return (
    <nav aria-label="Training" className="flex flex-wrap gap-1 border-b border-border">
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
    </nav>
  );
}
