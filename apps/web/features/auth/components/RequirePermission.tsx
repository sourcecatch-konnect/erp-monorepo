"use client";

import { ReactNode } from "react";
import { permissionLabel, type PermissionKey } from "@skerp/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@skerp/ui/components/tooltip";
import { useCan } from "../hooks/useCan";

/**
 * Gates a control on a permission, showing it dimmed and inert with a reason
 * instead of removing it.
 *
 * Hiding a button makes a missing permission indistinguishable from a bug: the
 * reader cannot tell whether "New Order" is absent because they lack
 * `order.create`, because the nav entry lost its key, or because the build is
 * stale. A disabled control that names what it needs turns a dead end into a
 * request someone can actually make of their admin.
 *
 * Use this for actions on a page the reader can already open. Keep `<Can>`
 * (which hides) for whole pages and nav links — a link to a 403 is noise.
 *
 * The control is made inert rather than `disabled` so this works with any
 * child without cloning it, and so the tooltip still opens: `Button` carries
 * `disabled:pointer-events-none`, which would swallow the hover that explains
 * why it's off. `inert` also takes it out of the tab order and blocks clicks
 * and Enter, so the action genuinely cannot fire.
 */
export function RequirePermission({
  permission,
  children,
  /** Overrides the generated "You need …" sentence. */
  reason,
}: {
  permission: PermissionKey;
  children: ReactNode;
  reason?: string;
}) {
  const allowed = useCan(permission);
  if (allowed) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Holds the hover: the inert child inside cannot report one. */}
        <span className="inline-flex cursor-not-allowed">
          <span inert className="opacity-50">
            {children}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {reason ??
          `You need "${permissionLabel(permission)}". Ask an admin to add it to your role.`}
      </TooltipContent>
    </Tooltip>
  );
}
