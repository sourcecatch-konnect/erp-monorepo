"use client";

import * as React from "react";

import { cn } from "../lib/util";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

/**
 * Centred panel that explains a screen in plain words. Compose it from
 * HelpSection blocks; the content itself belongs to each feature.
 *
 * A dialog rather than a side drawer: help is something you stop and read,
 * not something you keep open beside your work, and a drawer pinned to one
 * edge made a short explanation sit in a tall narrow column. The name is kept
 * so every feature's call site stays unchanged.
 *
 * Header and footer are fixed; only the middle scrolls, so the title and the
 * "Take the guided tour" button never scroll out of reach.
 */
function HelpSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="help-sheet"
        className="grid max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-lg p-0 sm:max-w-4xl"
      >
        <DialogHeader className="gap-1 border-b border-border bg-primary/5 px-5 py-4 pr-12 text-left">
          <p className="text-xs font-semibold uppercase tracking-tight text-primary">
            Help
          </p>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HelpSection({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section data-slot="help-section" className={cn("space-y-2", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {title}
      </h3>
      <div className="space-y-2 text-sm text-foreground">{children}</div>
    </section>
  );
}

export { HelpSheet, HelpSection };
