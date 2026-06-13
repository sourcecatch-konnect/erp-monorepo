"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";

type DetailField<T> = {
  label: string;
  value: (data: T) => React.ReactNode;
};

type Props<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  data?: T | null;
  isLoading?: boolean;
  fields: DetailField<T>[];
};

export default function MasterDetailDialog<T>({
  open,
  onOpenChange,
  title,
  description = "View complete information.",
  data,
  isLoading,
  fields,
}: Props<T>) {
    const fieldCount = fields.length;

const dialogWidthClass =
  fieldCount <= 3
    ? "!max-w-md"
    : fieldCount <= 8
      ? "!max-w-2xl"
      : fieldCount <= 14
        ? "!max-w-4xl"
        : "!max-w-[1200px]";

const gridClass =
  fieldCount <= 8
    ? "grid-cols-1"
    : "grid-cols-1 md:grid-cols-2";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
     <DialogContent className={`max-h-[90vh] !w-[95vw] overflow-y-auto ${dialogWidthClass}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : data ? (
   <div className={`grid gap-x-8 gap-y-0 text-sm ${gridClass}`}>
  {fields.map((field) => (
    <div
      key={field.label}
      className="grid grid-cols-[150px_1fr] gap-4 border-b py-3"
    >
      <span className="text-muted-foreground">
        {field.label}
      </span>

      <span className="break-words font-medium text-foreground">
        {field.value(data) || "-"}
      </span>
    </div>
  ))}
</div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No detail found.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}