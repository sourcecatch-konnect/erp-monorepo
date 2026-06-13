type ClassValue = string | false | null | undefined;

/**
 * Tiny className joiner — filters out falsy values.
 * For conditional classes: cn("base", isActive && "active").
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
