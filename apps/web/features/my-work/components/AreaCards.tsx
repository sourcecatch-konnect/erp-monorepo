"use client";

import { IconCircleCheck } from "@tabler/icons-react";
import type { MyWorkModule, MyWorkQueue } from "@skerp/types";
import { cn } from "@/lib/utils";
import { ALL_ICON, MODULES, type ModuleDef } from "./modules";

type ChipProps = {
  label: string;
  /** Full name + what it covers, shown on hover. */
  hint: string;
  icon: ModuleDef["icon"];
  waiting: number;
  late: number;
  veryLate: number;
  selected: boolean;
  onClick: () => void;
};

/**
 * One area as a chip sized to its text: icon, name, count, late. Names never
 * get cut; when the row is full, chips move to the next line.
 */
function AreaChip({
  label,
  hint,
  icon: IconCmp,
  waiting,
  late,
  veryLate,
  selected,
  onClick,
}: ChipProps) {
  const empty = waiting === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={hint}
      className={cn(
        "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border bg-card px-3 text-sm transition-colors hover:bg-muted/50",
        selected && "border-primary bg-primary/10 hover:bg-primary/10",
      )}
    >
      <IconCmp
        className={cn(
          "size-4 shrink-0",
          selected ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          selected ? "font-semibold text-primary" : "font-medium text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          empty ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {waiting.toLocaleString("en-IN")}
      </span>
      {empty ? (
        <IconCircleCheck
          className="size-4 shrink-0 text-success"
          aria-label="Nothing waiting"
        />
      ) : late > 0 ? (
        // Red only when something is badly late; a little late is orange.
        <span
          className={cn(
            "rounded-sm px-1.5 text-xs font-medium tabular-nums",
            veryLate > 0
              ? "bg-destructive/10 text-destructive"
              : "bg-warning/15 text-warning",
          )}
        >
          {late.toLocaleString("en-IN")} late
        </span>
      ) : (
        <span className="text-xs text-success">on time</span>
      )}
    </button>
  );
}

/**
 * The area filter above the To do list: "All work" plus one chip per area the
 * user has access to. Picking a chip narrows the list; picking the selected
 * chip again goes back to all work.
 */
export function AreaCards({
  queues,
  value,
  onChange,
}: {
  queues: MyWorkQueue[];
  value: MyWorkModule | null;
  onChange: (module: MyWorkModule | null) => void;
}) {
  const sum = (items: MyWorkQueue[], pick: (q: MyWorkQueue) => number) =>
    items.reduce((n, q) => n + pick(q), 0);

  // Only areas the user has at least one queue in (queues are permission-filtered).
  const areas = MODULES.map((m) => {
    const items = queues.filter((q) => q.module === m.key);
    return {
      ...m,
      present: items.length > 0,
      waiting: sum(items, (q) => q.waiting),
      late: sum(items, (q) => q.late),
      veryLate: sum(items, (q) => q.veryLate),
    };
  }).filter((a) => a.present);

  return (
    <nav aria-label="Work areas" className="flex flex-wrap gap-2">
      <AreaChip
        label="All work"
        hint="Everything waiting on you, most urgent first"
        icon={ALL_ICON}
        waiting={sum(queues, (q) => q.waiting)}
        late={sum(queues, (q) => q.late)}
        veryLate={sum(queues, (q) => q.veryLate)}
        selected={value === null}
        onClick={() => onChange(null)}
      />
      {areas.map((a) => (
        <AreaChip
          key={a.key}
          label={a.short}
          hint={`${a.label}: ${a.covers}`}
          icon={a.icon}
          waiting={a.waiting}
          late={a.late}
          veryLate={a.veryLate}
          selected={value === a.key}
          onClick={() => onChange(value === a.key ? null : a.key)}
        />
      ))}
    </nav>
  );
}
