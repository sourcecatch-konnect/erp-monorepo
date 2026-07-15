import type { Column } from "@tanstack/react-table";
import type * as React from "react";

/**
 * Right-pinned cells sit over scrolled content, so they need an opaque
 * background. Hover/header tints elsewhere are translucent over `bg-card`,
 * so the pinned equivalents pre-mix the same tint with the card color.
 */
export const PIN_HEAD_BG =
  "bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";
export const PIN_CELL_BG =
  "bg-card group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";

export const pinStyle = <TData,>(
  column: Column<TData, unknown>,
): React.CSSProperties | undefined =>
  column.getIsPinned() === "right"
    ? {
        right: column.getAfter("right"),
        width: column.getSize(),
        minWidth: column.getSize(),
      }
    : undefined;
