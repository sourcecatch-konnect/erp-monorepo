import {
  comparePermissionKeys,
  permissionActionOf,
  permissionAreaGroup,
  permissionAreaLabel,
  permissionAreaShortLabel,
  permissionLabel,
  PERMISSION_GROUP_ORDER,
} from "@skerp/types";
import type { PermissionDefDto } from "./types";

export type PermissionArea = {
  code: string;
  /** Full label, e.g. "Master data: Customers". */
  label: string;
  /** Label without the group prefix, e.g. "Customers". */
  shortLabel: string;
  keys: string[];
};

export type PermissionGroup = {
  name: string;
  areas: PermissionArea[];
  /** Masters are regular enough to render as one action matrix. */
  isMatrix: boolean;
};

/** Column order in the master matrix; anything unexpected is appended. */
const ACTION_ORDER = [
  "view",
  "create",
  "update",
  "delete",
  "export",
  "bulk_import",
] as const;

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  export: "Export",
  bulk_import: "Import",
};

export const actionLabel = (action: string) =>
  ACTION_LABELS[action] ?? permissionLabel(action);

/**
 * Search synonyms, so "add customer" and "remove city" find the create and
 * delete keys even though the labels say Create and Delete.
 */
const SYNONYMS: Record<string, string> = {
  add: "create",
  new: "create",
  make: "create",
  remove: "delete",
  del: "delete",
  destroy: "delete",
  edit: "update",
  modify: "update",
  change: "update",
  see: "view",
  read: "view",
  open: "view",
  download: "export",
  upload: "bulk_import",
  import: "bulk_import",
};

/** Areas sorted by label; within an area, View -> Create -> Edit -> Delete -> rest. */
export function buildAreas(perms: PermissionDefDto[]): PermissionArea[] {
  const byCode = new Map<string, string[]>();
  for (const p of perms) {
    const keys = byCode.get(p.moduleCode) ?? [];
    keys.push(p.key);
    byCode.set(p.moduleCode, keys);
  }
  return Array.from(byCode, ([code, keys]) => ({
    code,
    label: permissionAreaLabel(code),
    shortLabel: permissionAreaShortLabel(code),
    keys: keys.sort(comparePermissionKeys),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Buckets the areas into the rail's groups, in PERMISSION_GROUP_ORDER. */
export function buildGroups(areas: PermissionArea[]): PermissionGroup[] {
  const byGroup = new Map<string, PermissionArea[]>();
  for (const area of areas) {
    const name = permissionAreaGroup(area.code);
    byGroup.set(name, [...(byGroup.get(name) ?? []), area]);
  }
  return PERMISSION_GROUP_ORDER.filter((name) => byGroup.has(name)).map(
    (name) => ({
      name,
      areas: byGroup.get(name)!,
      isMatrix: name === "Master data",
    }),
  );
}

/** Distinct action columns across the given areas, in ACTION_ORDER. */
export function matrixActions(areas: PermissionArea[]): string[] {
  const seen = new Set<string>();
  for (const area of areas) {
    for (const key of area.keys) seen.add(permissionActionOf(key));
  }
  const known = ACTION_ORDER.filter((a) => seen.has(a));
  const extra = [...seen]
    .filter((a) => !ACTION_ORDER.includes(a as (typeof ACTION_ORDER)[number]))
    .sort();
  return [...known, ...extra];
}

/** The key for an area/action pair, or undefined if that action doesn't exist. */
export function keyFor(area: PermissionArea, action: string) {
  return area.keys.find((key) => permissionActionOf(key) === action);
}

/**
 * Every search word must match the permission label, its area label, or the
 * raw key — after synonym expansion.
 */
export function searchKeys(areas: PermissionArea[], search: string): string[] {
  const words = search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => SYNONYMS[word] ?? word);
  if (!words.length) return [];
  const hits: string[] = [];
  for (const area of areas) {
    for (const key of area.keys) {
      const haystack =
        `${permissionLabel(key)} ${area.label} ${key}`.toLowerCase();
      if (words.every((word) => haystack.includes(word))) hits.push(key);
    }
  }
  return hits;
}

/**
 * An action is useless without its area's `view`, so granting anything implies
 * view. Returns the view keys that had to be added alongside `keys`.
 */
export function impliedViewKeys(
  areas: PermissionArea[],
  keys: string[],
  granted: ReadonlySet<string>,
): string[] {
  const implied = new Set<string>();
  for (const key of keys) {
    if (permissionActionOf(key) === "view") continue;
    const area = areas.find((a) => a.keys.includes(key));
    const viewKey = area && keyFor(area, "view");
    if (viewKey && !granted.has(viewKey) && !keys.includes(viewKey)) {
      implied.add(viewKey);
    }
  }
  return [...implied];
}

/**
 * Areas where something is granted but `view` is not — a role that can act on
 * a screen it cannot open.
 */
export function brokenAreas(
  areas: PermissionArea[],
  granted: ReadonlySet<string>,
): PermissionArea[] {
  return areas.filter((area) => {
    const viewKey = keyFor(area, "view");
    if (!viewKey || granted.has(viewKey)) return false;
    return area.keys.some((key) => granted.has(key));
  });
}

export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
