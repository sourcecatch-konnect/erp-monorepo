"use client";

import * as React from "react";
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
import { CREATE_ACTIONS, type CreateAction } from "../create-actions";

/**
 * Quick Create — one row that starts the day's work without walking through a
 * module's list page first.
 *
 * Every button is a plain link to the creation page that already owns the
 * form, so validation, goods rows, attachments and save behaviour stay in one
 * place (see create-actions.ts for why none of these is a drawer).
 *
 * The row renders only what the viewer may create. A user with no create
 * permission at all gets nothing rather than a row of dead buttons — the
 * server is the real gate; this only decides what is worth showing.
 */
export function QuickCreate() {
  const allowed = useAllowedActions();
  const inline = allowed.filter((a) => !a.overflow);
  const overflow = allowed.filter((a) => a.overflow);

  if (allowed.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5">
      <span className="mr-0.5 text-xs font-medium text-muted-foreground">
        Create
      </span>

      {inline.map((action) => (
        <Button
          key={action.href}
          asChild
          size="sm"
          variant={action.primary ? "default" : "outline"}
        >
          <Link href={action.href}>
            <IconPlus className="size-4" />
            {action.label}
          </Link>
        </Button>
      ))}

      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              More
              <IconChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
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
