"use client";

import Link from "next/link";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { useCan } from "@/features/auth";
import { cn } from "@/lib/utils";
import { CREATE_ACTIONS, type CreateAction } from "../create-actions";

/**
 * Quick Create — one row that starts the day's work without walking through a
 * module's list page first.
 *
 * Every button is a plain link to the creation page that already owns the
 * form, so validation, goods rows, attachments and save behaviour stay in one
 * place (see create-actions.ts for why none of these is a drawer).
 *
 * Drawn as icon tiles rather than a strip of outline buttons: this is where
 * the day starts, and a row of same-weight buttons said nothing about which
 * of them people press twenty times a day.
 *
 * The row renders only what the viewer may create. A user with no create
 * permission at all gets nothing rather than a row of dead buttons — the
 * server is the real gate; this only decides what is worth showing.
 */
const TONES = [
  "bg-learn-4-soft text-learn-4",
  "bg-learn-1-soft text-learn-1",
  "bg-learn-6-soft text-learn-6",
  "bg-learn-5-soft text-learn-5",
  "bg-learn-2-soft text-learn-2",
  "bg-learn-3-soft text-learn-3",
];

export function QuickCreate() {
  const allowed = useAllowedActions();
  const inline = allowed.filter((a) => !a.overflow);
  const overflow = allowed.filter((a) => a.overflow);

  if (allowed.length === 0) return null;

  return (
    <section aria-label="Create" className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Start something</h2>
        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                More
                <IconChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((action) => (
                <DropdownMenuItem key={action.href} asChild>
                  <Link href={action.href}>
                    <action.icon className="size-4 text-muted-foreground" />
                    {action.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {inline.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors duration-150",
              action.primary
                ? "border-primary bg-primary/5 hover:bg-primary/10"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                action.primary
                  ? "bg-primary text-primary-foreground"
                  : TONES[index % TONES.length],
              )}
            >
              <action.icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {action.label}
              </span>
            </span>
            <IconPlus
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Permission checks are hooks, so they cannot run inside a filter callback —
 * the registry is fixed at module scope, which keeps the hook order stable.
 */
function useAllowedActions(): CreateAction[] {
  const granted = CREATE_ACTIONS.map((action) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- CREATE_ACTIONS is a module-level constant, so this list never changes length between renders.
    useCan(action.permission),
  );
  return CREATE_ACTIONS.filter((_, i) => granted[i]);
}
