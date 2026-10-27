"use client";

import * as React from "react";

import { cn } from "../lib/util";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet";

/**
 * Side panel that explains a screen in plain words. Compose it from
 * HelpSection blocks; the content itself belongs to each feature.
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-slot="help-sheet"
        className="w-full gap-0 data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader className="gap-1 border-b border-border px-6 py-4 pr-12">
          <p className="text-xs font-medium text-muted-foreground">Help</p>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
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
