"use client";

import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@/lib/utils";

type BaseProps = {
  label: string;
  /** The one solid button on the page. Everything else is the soft variant. */
  primary?: boolean;
  className?: string;
};

type Props = BaseProps &
  (
    | { href: string; onClick?: never }
    | { href?: never; onClick: () => void }
  );

/**
 * The "do the next step" button on every My Work row: a compact label with a
 * small icon chip and a diagonal arrow. Built on the shared Button (`soft`
 * variant: a light primary tint that fills solid on hover), flat, with design
 * tokens only so it follows light and dark themes.
 */
export function ActionButton({
  label,
  href,
  onClick,
  primary = false,
  className,
}: Props) {
  const classes = cn(
    "shrink-0 gap-2 pl-3 pr-1.5 text-[13px] font-semibold",
    className,
  );

  const content = (
    <>
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-md transition-colors",
          primary
            ? "bg-primary-foreground/20"
            : "bg-primary/15 group-hover/button:bg-primary-foreground/20",
        )}
      >
        <IconArrowUpRight
          size={14}
          stroke={2}
          className="transition-transform group-hover/button:translate-x-px group-hover/button:-translate-y-px"
        />
      </span>
    </>
  );

  const variant = primary ? "default" : "soft";

  if (href) {
    return (
      <Button asChild variant={variant} size="sm" className={classes}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={classes}
      onClick={onClick}
    >
      {content}
    </Button>
  );
}
