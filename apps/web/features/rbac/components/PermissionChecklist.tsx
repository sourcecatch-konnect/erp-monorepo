"use client";

import {
  permissionActionOf,
  permissionAreaLabel,
  permissionAreaOf,
  permissionLabel,
} from "@skerp/types";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { cn } from "@/lib/utils";
import { actionIcon } from "./permission-icons";

/**
 * Checkbox list for areas whose verbs are irregular (approve, cancel, close,
 * reopen_settlement…) and so don't fit the master matrix. Also used to render
 * flat search results, where `showArea` labels each row with its area.
 */
export function PermissionChecklist({
  keys,
  readOnly,
  isAllowed,
  isChanged,
  onSet,
  showArea = false,
}: {
  keys: string[];
  readOnly: boolean;
  isAllowed: (key: string) => boolean;
  isChanged: (key: string) => boolean;
  onSet: (keys: string[], on: boolean) => void;
  showArea?: boolean;
}) {
  return (
    <ul className="grid gap-1 rounded-md border border-border bg-card p-2 md:grid-cols-2">
      {keys.map((key) => {
        const changed = isChanged(key);
        const allowed = isAllowed(key);
        const Glyph = actionIcon(permissionActionOf(key));
        return (
          <li key={key}>
            <label
              title={key}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors duration-150",
                readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted",
                changed && "bg-primary/10 ring-1 ring-inset ring-primary",
              )}
            >
              <Checkbox
                className="mt-0.5"
                checked={allowed}
                disabled={readOnly}
                onCheckedChange={(c) => onSet([key], c === true)}
              />
              {/* The glyph makes the verb scannable down the column. */}
              <Glyph
                size={16}
                aria-hidden="true"
                className={cn(
                  "mt-0.5 shrink-0",
                  allowed ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">
                {permissionLabel(key)}
                {showArea && (
                  <span className="block text-xs text-muted-foreground">
                    {permissionAreaLabel(permissionAreaOf(key))}
                  </span>
                )}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
