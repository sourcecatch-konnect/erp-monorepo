"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowLeft,
  IconCircleCheck,
  IconCopy,
  IconDeviceFloppy,
  IconKey,
  IconLayoutGrid,
  IconLock,
  IconPencil,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { StatTile } from "@skerp/ui/components/stat-tile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { cn } from "@/lib/utils";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import type { RoleDetail } from "./types";
import {
  brokenAreas,
  buildAreas,
  buildGroups,
  impliedViewKeys,
  keyFor,
  plural,
  searchKeys,
  type PermissionArea,
} from "./role-permissions.model";
import {
  PermissionGroupRail,
  type RailSelection,
} from "./components/PermissionGroupRail";
import { groupIcon } from "./components/permission-icons";
import { MasterActionMatrix } from "./components/MasterActionMatrix";
import { PermissionChecklist } from "./components/PermissionChecklist";

type ViewFilter = "all" | "allowed" | "changed";

const FILTERS: { value: ViewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "allowed", label: "Allowed" },
  { value: "changed", label: "Changed" },
];

export function RoleDetailPage({ roleId }: { roleId: string }) {
  const qc = useQueryClient();
  const { setLabel } = useBreadcrumbLabels();

  const roleQuery = useQuery({
    queryKey: rbacKeys.role(roleId),
    queryFn: () => rbacApi.getRole(roleId),
  });
  const catalogQuery = useQuery({
    queryKey: rbacKeys.permissions,
    queryFn: () => rbacApi.permissions(),
    staleTime: 10 * 60 * 1000,
  });
  // Only for the "Copy from" menu — names are enough until one is picked.
  const rolesQuery = useQuery({
    queryKey: rbacKeys.roles,
    queryFn: () => rbacApi.listRoles(),
    staleTime: 5 * 60 * 1000,
  });
  const role = roleQuery.data;

  const [granted, setGranted] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (role) setGranted(new Set(role.permissionKeys));
  }, [role]);

  useEffect(() => {
    const href = `/settings/roles/${roleId}`;
    setLabel(href, role?.name ?? null);
    return () => setLabel(href, null);
  }, [role?.name, roleId, setLabel]);

  const areas = useMemo(
    () => buildAreas(catalogQuery.data ?? []),
    [catalogQuery.data],
  );
  const groups = useMemo(() => buildGroups(areas), [areas]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [selection, setSelection] = useState<RailSelection | null>(null);
  // Default to the first rail entry once the catalog arrives.
  const active: RailSelection | null = useMemo(() => {
    if (selection) return selection;
    const first = groups[0];
    if (!first) return null;
    return first.isMatrix
      ? { kind: "matrix", group: first.name }
      : { kind: "area", group: first.name, code: first.areas[0]!.code };
  }, [selection, groups]);

  const saved = useMemo(
    () => new Set(role?.permissionKeys ?? []),
    [role?.permissionKeys],
  );
  const added = [...granted].filter((key) => !saved.has(key)).length;
  const removed = [...saved].filter((key) => !granted.has(key)).length;
  const dirty = added + removed > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveMut = useMutation({
    mutationFn: () => rbacApi.setRolePermissions(roleId, Array.from(granted)),
    onSuccess: () => {
      qc.setQueryData<RoleDetail>(rbacKeys.role(roleId), (old) =>
        old
          ? {
              ...old,
              permissionKeys: Array.from(granted),
              _count: { ...old._count, rolePermissions: granted.size },
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: rbacKeys.roles });
      // The Edit access drawer shows what each role allows.
      void qc.invalidateQueries({
        queryKey: [...rbacKeys.permissions, "page"],
      });
      toast.success("Role permissions saved");
    },
  });

  // Only when there's nothing to show: a failed background refetch must not
  // replace the editor and throw away unsaved ticks.
  if (
    (roleQuery.isError && !role) ||
    (catalogQuery.isError && !catalogQuery.data)
  ) {
    return (
      <div className="space-y-4 p-6">
        <BackLink />
        <div role="alert" className="space-y-3 text-sm">
          <p>
            Couldn&apos;t load this role. Check your connection and try again.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void roleQuery.refetch();
              void catalogQuery.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!role || !catalogQuery.data || !active) return <RoleDetailSkeleton />;

  // Built-in roles are granted everything by the server, whatever is stored.
  const readOnly = role.isSystem;
  const isAllowed = (key: string) => readOnly || granted.has(key);
  const isChanged = (key: string) =>
    !readOnly && granted.has(key) !== saved.has(key);
  const countAllowed = (keys: string[]) => keys.filter(isAllowed).length;
  const countChanged = (keys: string[]) => keys.filter(isChanged).length;

  const totalPermissions = areas.reduce((n, a) => n + a.keys.length, 0);
  const allowedCount = readOnly ? totalPermissions : granted.size;
  const percent = totalPermissions
    ? Math.round((allowedCount / totalPermissions) * 100)
    : 0;
  const areasReached = areas.filter((a) => a.keys.some(isAllowed)).length;

  /**
   * Granting any action implies the area's `view` — without it the role can
   * act on a screen it cannot open. Added with a note, never a prompt.
   */
  const setMany = (keys: string[], on: boolean) => {
    if (readOnly) return;
    const implied = on ? impliedViewKeys(areas, keys, granted) : [];
    setGranted((prev) => {
      const next = new Set(prev);
      for (const key of [...keys, ...implied]) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
    if (implied.length) {
      toast.info(
        implied.length === 1
          ? "View access added too — it is needed to open the screen."
          : `${implied.length} View permissions added too — they are needed to open those screens.`,
      );
    }
  };

  const applyPreset = async (sourceId: string, sourceName: string) => {
    try {
      const source = await rbacApi.getRole(sourceId);
      setGranted(new Set(source.permissionKeys));
      toast.success(
        `Copied ${plural(source.permissionKeys.length, "permission", "permissions")} from ${sourceName}. Adjust and save.`,
      );
    } catch {
      toast.error(`Couldn't read ${sourceName}. Try again.`);
    }
  };

  const searching = search.trim().length > 0;
  const searchHits = searching ? searchKeys(areas, search) : [];
  const broken = readOnly ? [] : brokenAreas(areas, granted);

  const keepKey = (key: string) =>
    filter === "all"
      ? true
      : filter === "allowed"
        ? isAllowed(key)
        : isChanged(key);

  const activeGroup = groups.find((g) => g.name === active.group);
  const activeArea =
    active.kind === "area"
      ? areas.find((a) => a.code === active.code)
      : undefined;

  const filterAreas = (list: PermissionArea[]) =>
    filter === "all" ? list : list.filter((area) => area.keys.some(keepKey));

  const copyableRoles = (rolesQuery.data ?? []).filter((r) => r.id !== roleId);

  return (
    <div className="flex min-h-full flex-col">
      {/* Identity, reach, and the save controls — always in reach while scrolling. */}
      <header className="sticky top-0 z-30 space-y-3 border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <BackLink />
            <div className="flex items-center gap-3">
              {/* An identity mark, so roles are told apart at a glance. */}
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary"
              >
                {initialsOf(role.name)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold text-foreground">
                    {role.name}
                  </h1>
                  {readOnly && (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <IconLock size={12} aria-hidden="true" />
                      Built-in
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {role._count.users === 0
                    ? "Not given to anyone yet"
                    : `Given to ${plural(role._count.users, "person", "people")}`}
                </p>
              </div>
            </div>
          </div>

          {!readOnly && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {copyableRoles.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <IconCopy size={16} aria-hidden="true" />
                      Copy from
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    {copyableRoles.map((r) => (
                      <DropdownMenuItem
                        key={r.id}
                        onSelect={() => void applyPreset(r.id, r.name)}
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold text-muted-foreground"
                        >
                          {initialsOf(r.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {r.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {r._count.rolePermissions}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!dirty || saveMut.isPending}
                onClick={() => {
                  setGranted(new Set(role.permissionKeys));
                  saveMut.reset();
                }}
              >
                <IconArrowBackUp size={16} aria-hidden="true" />
                Discard
              </Button>
              <Button
                size="sm"
                disabled={!dirty || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                <IconDeviceFloppy size={16} aria-hidden="true" />
                {saveMut.isPending
                  ? "Saving…"
                  : dirty
                    ? `Save ${plural(added + removed, "change", "changes")}`
                    : "Save changes"}
              </Button>
            </div>
          )}
        </div>

        {/* Reach at a glance: a narrow role vs. an almost-admin one. */}
        <div className="space-y-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"
            role="img"
            aria-label={`${percent}% of all permissions allowed`}
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {percent}% of everything
            {dirty && (
              <span className="text-primary">
                {" · "}
                {changeSummary(added, removed)}
              </span>
            )}
          </p>
        </div>

        {saveMut.isError && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t save the role. {saveMut.error.message} Try again.
          </p>
        )}
      </header>

      {/* Answers "what kind of role is this?" before any checkbox is read.
          Outside the sticky header so it scrolls away once you start editing. */}
      <div className="grid gap-3 px-6 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={IconKey}
          tone="primary"
          label="Permissions allowed"
          value={`${allowedCount} / ${totalPermissions}`}
          hint={reachLabel(percent)}
        />
        <StatTile
          icon={IconLayoutGrid}
          tone={2}
          label="Areas reached"
          value={`${areasReached} / ${areas.length}`}
          hint={
            areasReached === areas.length
              ? "Every area"
              : `${areas.length - areasReached} untouched`
          }
        />
        <StatTile
          icon={IconUsers}
          tone={3}
          label="People with this role"
          value={role._count.users}
          hint={role._count.users === 0 ? "Not in use yet" : "In use"}
        />
        <StatTile
          icon={dirty ? IconPencil : IconCircleCheck}
          tone={dirty ? "warning" : "success"}
          label="Unsaved changes"
          value={dirty ? added + removed : "None"}
          hint={dirty ? changeSummary(added, removed) : "Everything saved"}
        />
      </div>

      {readOnly && (
        <div className="mx-6 mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Built-in roles can&apos;t be changed. People with this role can do
          everything. To make a role with fewer permissions, create one on the{" "}
          <Link href="/settings/roles" className="text-primary hover:underline">
            Roles
          </Link>{" "}
          page and use{" "}
          <strong className="font-medium text-foreground">Copy from…</strong>.
        </div>
      )}

      {broken.length > 0 && (
        <div
          role="status"
          className="mx-6 mt-4 flex items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          <IconAlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <p className="text-foreground">
              {broken.length === 1
                ? `${broken[0]!.label} has actions allowed but not View, so nobody can open that screen.`
                : `${broken.length} areas have actions allowed but not View, so nobody can open those screens.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setMany(
                  broken.flatMap((area) => {
                    const key = keyFor(area, "view");
                    return key ? [key] : [];
                  }),
                  true,
                )
              }
            >
              Add the missing View access
            </Button>
          </div>
        </div>
      )}

      {/* Find a permission, or switch from editing to reviewing. */}
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm sm:flex-1">
          <IconSearch
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search permissions"
            placeholder="Search, e.g. add customer, approve"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div
          role="group"
          aria-label="Show"
          className="inline-flex shrink-0 overflow-hidden rounded-md border border-border"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "border-r border-border px-3 py-1.5 text-xs font-medium transition-colors duration-150 last:border-r-0",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 pb-10">
        {searching ? (
          <SearchResults
            keys={searchHits.filter(keepKey)}
            query={search.trim()}
            readOnly={readOnly}
            isAllowed={isAllowed}
            isChanged={isChanged}
            onSet={setMany}
            onClear={() => {
              setSearch("");
              setFilter("all");
            }}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-48 lg:self-start">
              <PermissionGroupRail
                groups={groups}
                selection={active}
                onSelect={setSelection}
                counts={{ allowed: countAllowed, changed: countChanged }}
              />
            </aside>

            <section className="min-w-0 space-y-3">
              {active.kind === "matrix" && activeGroup ? (
                <MatrixPane
                  areas={filterAreas(activeGroup.areas)}
                  title={activeGroup.name}
                  filter={filter}
                  readOnly={readOnly}
                  isAllowed={isAllowed}
                  isChanged={isChanged}
                  onSet={setMany}
                  onResetFilter={() => setFilter("all")}
                />
              ) : activeArea ? (
                <AreaPane
                  area={activeArea}
                  group={active.group}
                  keys={activeArea.keys.filter(keepKey)}
                  allowed={countAllowed(activeArea.keys)}
                  filter={filter}
                  readOnly={readOnly}
                  isAllowed={isAllowed}
                  isChanged={isChanged}
                  onSet={setMany}
                  onResetFilter={() => setFilter("all")}
                />
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function MatrixPane({
  areas,
  title,
  filter,
  readOnly,
  isAllowed,
  isChanged,
  onSet,
  onResetFilter,
}: {
  areas: PermissionArea[];
  title: string;
  filter: ViewFilter;
  readOnly: boolean;
  isAllowed: (key: string) => boolean;
  isChanged: (key: string) => boolean;
  onSet: (keys: string[], on: boolean) => void;
  onResetFilter: () => void;
}) {
  return (
    <>
      <PaneHeading
        group={title}
        title={title}
        hint="Rows are masters, columns are what the role can do. Tick a column heading to allow that action for every master."
      />
      {areas.length ? (
        <MasterActionMatrix
          areas={areas}
          readOnly={readOnly}
          isAllowed={isAllowed}
          isChanged={isChanged}
          onSet={onSet}
        />
      ) : (
        <EmptyPane filter={filter} onReset={onResetFilter} />
      )}
    </>
  );
}

function AreaPane({
  area,
  group,
  keys,
  allowed,
  filter,
  readOnly,
  isAllowed,
  isChanged,
  onSet,
  onResetFilter,
}: {
  area: PermissionArea;
  group: string;
  keys: string[];
  allowed: number;
  filter: ViewFilter;
  readOnly: boolean;
  isAllowed: (key: string) => boolean;
  isChanged: (key: string) => boolean;
  onSet: (keys: string[], on: boolean) => void;
  onResetFilter: () => void;
}) {
  const allOn = allowed === area.keys.length;
  return (
    <>
      <PaneHeading
        group={group}
        title={area.label}
        hint={`${allowed} of ${area.keys.length} allowed`}
        action={
          readOnly ? undefined : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSet(area.keys, !allOn)}
            >
              {allOn ? "Allow none" : "Allow all"}
            </Button>
          )
        }
      />
      {keys.length ? (
        <PermissionChecklist
          keys={keys}
          readOnly={readOnly}
          isAllowed={isAllowed}
          isChanged={isChanged}
          onSet={onSet}
        />
      ) : (
        <EmptyPane filter={filter} onReset={onResetFilter} />
      )}
    </>
  );
}

function PaneHeading({
  group,
  title,
  hint,
  action,
}: {
  /** Picks the glyph; the pane is always reached through a group. */
  group: string;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  const Glyph = groupIcon(group);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <Glyph size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function SearchResults({
  keys,
  query,
  readOnly,
  isAllowed,
  isChanged,
  onSet,
  onClear,
}: {
  keys: string[];
  query: string;
  readOnly: boolean;
  isAllowed: (key: string) => boolean;
  isChanged: (key: string) => boolean;
  onSet: (keys: string[], on: boolean) => void;
  onClear: () => void;
}) {
  if (!keys.length)
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          Nothing matches &quot;{query}&quot;.
        </p>
        <p className="text-sm text-muted-foreground">
          Try a single word, like &quot;approve&quot;, &quot;trip&quot; or
          &quot;delete&quot;.
        </p>
        <Button variant="outline" onClick={onClear}>
          Clear search
        </Button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {plural(keys.length, "match", "matches")} for &quot;{query}&quot;
        </p>
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSet(keys, true)}
            >
              Allow all matches
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSet(keys, false)}
            >
              Allow none
            </Button>
          </div>
        )}
      </div>
      <PermissionChecklist
        keys={keys}
        readOnly={readOnly}
        isAllowed={isAllowed}
        isChanged={isChanged}
        onSet={onSet}
        showArea
      />
    </div>
  );
}

function EmptyPane({
  filter,
  onReset,
}: {
  filter: ViewFilter;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        {filter === "allowed"
          ? "Nothing is allowed here yet."
          : "Nothing changed here."}
      </p>
      <Button variant="outline" size="sm" onClick={onReset}>
        Show all
      </Button>
    </div>
  );
}

/** Up to two letters from the role name, for the identity mark. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Plain words for how far a role reaches, so the percentage means something. */
function reachLabel(percent: number) {
  if (percent === 0) return "Nothing allowed yet";
  if (percent === 100) return "Everything — same as Admin";
  if (percent < 15) return "A narrow role";
  if (percent < 50) return "A focused role";
  if (percent < 85) return "A broad role";
  return "Close to full access";
}

function changeSummary(added: number, removed: number) {
  if (added && removed)
    return `${plural(added, "permission", "permissions")} added, ${removed} taken away`;
  if (added) return `${plural(added, "permission", "permissions")} added`;
  return `${plural(removed, "permission", "permissions")} taken away`;
}

function BackLink() {
  return (
    <Link
      href="/settings/roles"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      <IconArrowLeft size={16} aria-hidden="true" />
      All roles
    </Link>
  );
}

function RoleDetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-1.5 w-full" />
      </div>
      <Skeleton className="h-9 w-full sm:max-w-sm" />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="overflow-hidden rounded-md border border-border bg-card">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
