"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import type { VisibilityState } from "@tanstack/react-table";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { IconColumns3, IconGripVertical } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/** Label + icon per reorderable column, keyed by column id. */
export type ColumnMeta = Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }
>;

/** One draggable row of the column picker: grab handle, checkbox, icon, label. */
function SortableColumnRow({
  id,
  label,
  icon: Icon,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  checked: boolean;
  onCheckedChange: (visible: boolean) => void;
}) {
  const checkboxId = React.useId();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-sm px-1 py-1",
        isDragging && "relative z-10 bg-muted",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${label} column`}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
      >
        <IconGripVertical size={14} />
      </button>
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <label
        htmlFor={checkboxId}
        className="flex flex-1 cursor-pointer items-center gap-1.5 text-sm"
      >
        <Icon size={14} className="text-muted-foreground" />
        {label}
      </label>
    </div>
  );
}

type Props = {
  /** Current user order of the reorderable (non-pinned) columns. */
  columnOrder: string[];
  onColumnOrderChange: (order: string[]) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: React.Dispatch<
    React.SetStateAction<VisibilityState>
  >;
  columnMeta: ColumnMeta;
  /** Order restored by the Reset link (visibility resets to all-visible). */
  defaultOrder: readonly string[];
};

/**
 * "Columns" toolbar button: a popover listing the reorderable columns with
 * drag-to-reorder handles and show/hide checkboxes. Pinned columns simply
 * aren't passed in `columnOrder`, so they never appear here.
 */
export function ColumnPickerPopover({
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  onColumnVisibilityChange,
  columnMeta,
  defaultOrder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnOrder.indexOf(String(active.id));
    const newIndex = columnOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onColumnOrderChange(arrayMove(columnOrder, oldIndex, newIndex));
  };

  const reset = () => {
    onColumnOrderChange([...defaultOrder]);
    onColumnVisibilityChange({});
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="ml-auto h-9">
          <IconColumns3 size={16} className="mr-1" /> Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">
            Show &amp; order columns
          </span>
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer text-xs text-primary transition-colors hover:underline"
          >
            Reset
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {columnOrder.map((id) => {
                const meta = columnMeta[id];
                if (!meta) return null;
                return (
                  <SortableColumnRow
                    key={id}
                    id={id}
                    label={meta.label}
                    icon={meta.icon}
                    checked={columnVisibility[id] !== false}
                    onCheckedChange={(visible) =>
                      onColumnVisibilityChange((current) => ({
                        ...current,
                        [id]: visible,
                      }))
                    }
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}
