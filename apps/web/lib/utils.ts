/**
 * The app's className joiner.
 *
 * This used to be a plain `filter(Boolean).join(" ")`, which cannot resolve
 * Tailwind conflicts: `cn("px-4", cond && "px-2")` produced "px-4 px-2" and
 * the winner was decided by CSS source order rather than by intent. It now
 * re-exports the shared `twMerge(clsx(...))` helper so a later class wins, as
 * every caller already assumed.
 */
export { cn } from "@skerp/ui/lib/util";
