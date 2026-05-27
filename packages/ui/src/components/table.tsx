"use client";

import * as React from "react";
import { cn } from "../lib/util";

/* ---------------------------
   TABLE ROOT
---------------------------- */
function Table({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-md border"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          "border-separate border-spacing-0",
          className
        )}
        {...props}
      />
    </div>
  );
}

/* ---------------------------
   HEADER
---------------------------- */
function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-muted/50 sticky top-0 z-10",
        "[&_tr]:border-b",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   BODY
---------------------------- */
function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   FOOTER
---------------------------- */
function TableFooter({
  className,
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/60 font-medium",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   ROW (IMPORTANT IMPROVEMENT)
---------------------------- */
function TableRow({
  className,
  "data-selected": selected,
  ...props
}: React.ComponentProps<"tr"> & { "data-selected"?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      className={cn(
        "border-b transition-colors",
        "hover:bg-muted/50",
        "data-[state=selected]:bg-muted",
        "cursor-default",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   HEAD
---------------------------- */
function TableHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle font-medium",
        "whitespace-nowrap text-foreground",
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------
   CELL
---------------------------- */
function TableCell({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle whitespace-nowrap",
        "text-sm text-foreground",
        className
      )}
      {...props}
    />
  );
}
/* ---------------------------
   CAPTION
---------------------------- */
function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        "mt-3 text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};