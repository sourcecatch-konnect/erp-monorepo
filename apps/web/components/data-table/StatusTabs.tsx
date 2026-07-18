"use client";

import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type StatusTabDef = {
  key: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

type Props = {
  tabs: readonly StatusTabDef[];
  active: string;
  onChange: (key: string) => void;
  counts?: Record<string, number>;
  /** Unique per table — scopes the shared sliding-underline animation. */
  layoutId: string;
};

/** Notion-style status filter tabs with a shared sliding underline. */
export function StatusTabs({ tabs, active, onChange, counts, layoutId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const count = counts?.[tab.key];
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative flex cursor-pointer items-center gap-1.5 rounded-t-sm px-3 py-2 text-sm transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {Icon ? (
              <Icon size={15} className={isActive ? "text-primary" : undefined} />
            ) : null}
            {tab.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded-sm px-1 text-xs tabular-nums",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
            {isActive ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
