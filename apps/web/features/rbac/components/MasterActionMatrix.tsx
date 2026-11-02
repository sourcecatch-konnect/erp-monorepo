"use client";

import { permissionLabel } from "@skerp/types";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { cn } from "@/lib/utils";
import {
  actionLabel,
  keyFor,
  matrixActions,
  type PermissionArea,
} from "../role-permissions.model";
import { actionIcon } from "./permission-icons";

type CheckState = boolean | "indeterminate";

const stateOf = (
  keys: string[],
  isAllowed: (key: string) => boolean,
): CheckState => {
  if (!keys.length) return false;
  const on = keys.filter(isAllowed).length;
  return on === keys.length ? true : on > 0 ? "indeterminate" : false;
};

/**
 * Master permissions are perfectly regular — every master has the same six
 * actions — so they read far better as a grid than as 150 checkbox rows.
 * Row labels toggle a master, column headers toggle an action everywhere.
 */
export function MasterActionMatrix({
  areas,
  readOnly,
  isAllowed,
  isChanged,
  onSet,
}: {
  areas: PermissionArea[];
  readOnly: boolean;
  isAllowed: (key: string) => boolean;
  isChanged: (key: string) => boolean;
  onSet: (keys: string[], on: boolean) => void;
}) {
  const actions = matrixActions(areas);
  const allKeys = areas.flatMap((a) => a.keys);

  const columnKeys = (action: string) =>
    areas.flatMap((area) => {
      const key = keyFor(area, action);
      return key ? [key] : [];
    });

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 w-56 bg-card">
              Master
            </TableHead>
            {actions.map((action) => {
              const Glyph = actionIcon(action);
              return (
                <TableHead key={action} className="px-2 text-center">
                  <HeaderToggle
                    label={actionLabel(action)}
                    icon={<Glyph size={14} aria-hidden="true" />}
                    state={stateOf(columnKeys(action), isAllowed)}
                    readOnly={readOnly}
                    title={`${actionLabel(action)} for every master`}
                    onChange={(on) => onSet(columnKeys(action), on)}
                  />
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-b-2 border-border bg-muted/40 hover:bg-muted/40">
            <TableCell className="sticky left-0 z-10 bg-muted/40 font-medium">
              <HeaderToggle
                label="All masters"
                state={stateOf(allKeys, isAllowed)}
                readOnly={readOnly}
                title="Every master permission"
                onChange={(on) => onSet(allKeys, on)}
                align="start"
              />
            </TableCell>
            {actions.map((action) => (
              <TableCell key={action} />
            ))}
          </TableRow>

          {areas.map((area) => (
            <TableRow key={area.code}>
              <TableCell className="sticky left-0 z-10 bg-card">
                <HeaderToggle
                  label={area.shortLabel}
                  state={stateOf(area.keys, isAllowed)}
                  readOnly={readOnly}
                  title={`Every permission for ${area.shortLabel}`}
                  onChange={(on) => onSet(area.keys, on)}
                  align="start"
                />
              </TableCell>
              {actions.map((action) => {
                const key = keyFor(area, action);
                if (!key)
                  return (
                    <TableCell
                      key={action}
                      className="text-center text-muted-foreground"
                    >
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">Not applicable</span>
                    </TableCell>
                  );
                return (
                  <TableCell key={action} className="p-0 text-center">
                    <label
                      title={`${permissionLabel(key)} — ${key}`}
                      className={cn(
                        "flex h-10 items-center justify-center transition-colors duration-150",
                        readOnly
                          ? "cursor-default"
                          : "cursor-pointer hover:bg-muted",
                        isChanged(key) &&
                          "bg-primary/10 ring-1 ring-inset ring-primary",
                      )}
                    >
                      <Checkbox
                        aria-label={permissionLabel(key)}
                        checked={isAllowed(key)}
                        disabled={readOnly}
                        onCheckedChange={(c) => onSet([key], c === true)}
                      />
                    </label>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HeaderToggle({
  label,
  icon,
  state,
  readOnly,
  title,
  onChange,
  align = "center",
}: {
  label: string;
  icon?: React.ReactNode;
  state: CheckState;
  readOnly: boolean;
  title: string;
  onChange: (on: boolean) => void;
  align?: "center" | "start";
}) {
  const text = (
    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
      {icon}
      {label}
    </span>
  );
  if (readOnly) return text;
  return (
    <label
      title={title}
      className={cn(
        "flex cursor-pointer items-center gap-2",
        align === "center" ? "justify-center" : "justify-start",
      )}
    >
      <Checkbox
        aria-label={title}
        checked={state}
        onCheckedChange={(c) => onChange(c === true)}
      />
      {text}
    </label>
  );
}
