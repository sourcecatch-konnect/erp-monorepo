"use client";

import { cn } from "@/lib/utils";
import type {
  PermissionArea,
  PermissionGroup,
} from "../role-permissions.model";
import { groupIcon } from "./permission-icons";

export type RailSelection =
  /** The whole Master data matrix. */
  | { kind: "matrix"; group: string }
  /** A single permission area. */
  | { kind: "area"; group: string; code: string };

type Counts = {
  allowed: (keys: string[]) => number;
  changed: (keys: string[]) => number;
};

/**
 * Left navigation for the role editor: one row per group, with areas nested
 * underneath. The Master data group has no children — it opens as a single
 * action matrix, which collapses two dozen rail rows into one.
 *
 * Each row carries a fill bar, so how much of an area a role reaches is
 * legible without opening it.
 */
export function PermissionGroupRail({
  groups,
  selection,
  onSelect,
  counts,
}: {
  groups: PermissionGroup[];
  selection: RailSelection;
  onSelect: (next: RailSelection) => void;
  counts: Counts;
}) {
  return (
    <nav aria-label="Permission groups" className="space-y-5">
      {groups.map((group) => {
        const keys = group.areas.flatMap((a) => a.keys);
        const Glyph = groupIcon(group.name);
        return (
          <div key={group.name} className="space-y-0.5">
            {group.isMatrix ? (
              <RailRow
                icon={<Glyph size={16} aria-hidden="true" />}
                label={group.name}
                allowed={counts.allowed(keys)}
                total={keys.length}
                changed={counts.changed(keys)}
                active={selection.kind === "matrix"}
                onClick={() => onSelect({ kind: "matrix", group: group.name })}
              />
            ) : (
              <>
                <p className="flex items-center gap-2 px-3 pb-1.5 text-xs font-medium uppercase text-muted-foreground">
                  <Glyph size={14} aria-hidden="true" />
                  {group.name}
                  <span className="ml-auto tabular-nums normal-case">
                    {counts.allowed(keys)}/{keys.length}
                  </span>
                </p>
                {group.areas.map((area) => (
                  <AreaRow
                    key={area.code}
                    area={area}
                    counts={counts}
                    active={
                      selection.kind === "area" && selection.code === area.code
                    }
                    onClick={() =>
                      onSelect({
                        kind: "area",
                        group: group.name,
                        code: area.code,
                      })
                    }
                  />
                ))}
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function AreaRow({
  area,
  counts,
  active,
  onClick,
}: {
  area: PermissionArea;
  counts: Counts;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <RailRow
      label={area.shortLabel}
      allowed={counts.allowed(area.keys)}
      total={area.keys.length}
      changed={counts.changed(area.keys)}
      active={active}
      onClick={onClick}
    />
  );
}

function RailRow({
  icon,
  label,
  allowed,
  total,
  changed,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  allowed: number;
  total: number;
  changed: number;
  active: boolean;
  onClick: () => void;
}) {
  const percent = total ? Math.round((allowed / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full space-y-1.5 border-l-2 px-3 py-2 text-left text-sm transition-colors duration-150",
        active
          ? "border-primary bg-muted text-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {changed > 0 && (
          <span
            aria-label={`${changed} unsaved`}
            title={`${changed} unsaved`}
            className="size-1.5 shrink-0 rounded-full bg-primary"
          />
        )}
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            allowed > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {allowed}/{total}
        </span>
      </span>
      <span
        className="block h-0.5 w-full overflow-hidden rounded-sm bg-border"
        aria-hidden="true"
      >
        <span
          className={cn(
            "block h-full",
            allowed === 0
              ? "bg-transparent"
              : allowed === total
                ? "bg-primary"
                : "bg-primary/50",
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
    </button>
  );
}
