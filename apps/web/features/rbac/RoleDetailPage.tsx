"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  comparePermissionKeys,
  permissionAreaLabel,
  permissionLabel,
} from "@skerp/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@skerp/ui/components/accordion";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@/lib/utils";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import type { PermissionDefDto, RoleDetail } from "./types";

type PermissionArea = { code: string; label: string; keys: string[] };

/** Areas sorted by name; within an area, View → Create → Edit → Delete → the rest. */
function groupByArea(perms: PermissionDefDto[]): PermissionArea[] {
  const byCode = new Map<string, string[]>();
  for (const p of perms) {
    const keys = byCode.get(p.moduleCode) ?? [];
    keys.push(p.key);
    byCode.set(p.moduleCode, keys);
  }
  return Array.from(byCode, ([code, keys]) => ({
    code,
    label: permissionAreaLabel(code),
    keys: keys.sort(comparePermissionKeys),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Every word must appear in the permission name or its area name. */
function filterAreas(areas: PermissionArea[], search: string) {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return areas;
  const matches = (text: string) =>
    words.every((word) => text.toLowerCase().includes(word));
  return areas
    .map((area) => ({
      ...area,
      keys: area.keys.filter((key) =>
        matches(`${permissionLabel(key)} ${area.label}`),
      ),
    }))
    .filter((area) => area.keys.length > 0);
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

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
    () => groupByArea(catalogQuery.data ?? []),
    [catalogQuery.data],
  );
  const [search, setSearch] = useState("");
  const visibleAreas = useMemo(
    () => filterAreas(areas, search),
    [areas, search],
  );
  const [openAreas, setOpenAreas] = useState<string[]>([]);

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
  if ((roleQuery.isError && !role) || (catalogQuery.isError && !catalogQuery.data)) {
    return (
      <div className="space-y-4 p-6">
        <BackLink />
        <div role="alert" className="space-y-3 text-sm">
          <p>Couldn&apos;t load this role. Check your connection and try again.</p>
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

  if (!role || !catalogQuery.data) return <RoleDetailSkeleton />;

  // Built-in roles are granted everything by the server, whatever is stored.
  const readOnly = role.isSystem;
  const isAllowed = (key: string) => readOnly || granted.has(key);
  const totalPermissions = areas.reduce((n, a) => n + a.keys.length, 0);
  const allowedCount = readOnly ? totalPermissions : granted.size;
  const searching = search.trim().length > 0;
  const allOpen =
    visibleAreas.length > 0 &&
    visibleAreas.every((a) => openAreas.includes(a.code));

  const setMany = (keys: string[], on: boolean) =>
    setGranted((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  const usedBy =
    role._count.users === 0
      ? "Not given to anyone yet"
      : `Given to ${plural(role._count.users, "person", "people")}`;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6 p-6">
        <header className="space-y-2">
          <BackLink />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">
              {role.name}
            </h1>
            {readOnly && (
              <span className="rounded-sm border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Built-in
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {usedBy} · {allowedCount} of {totalPermissions} permissions allowed
          </p>
        </header>

        {readOnly && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Built-in roles can&apos;t be changed. People with this role can do
            everything. To make a role with fewer permissions, copy this one
            from the{" "}
            <Link href="/settings/roles" className="text-primary hover:underline">
              Roles
            </Link>{" "}
            page.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            aria-label="Search permissions"
            placeholder="Search, e.g. approve payments"
            className="sm:max-w-sm"
            value={search}
            onChange={(e) => {
              const next = e.target.value;
              setSearch(next);
              // Open every area with a match so results are visible at once.
              setOpenAreas(
                next.trim()
                  ? filterAreas(areas, next).map((a) => a.code)
                  : [],
              );
            }}
          />
          {visibleAreas.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setOpenAreas(allOpen ? [] : visibleAreas.map((a) => a.code))
              }
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          )}
        </div>

        {visibleAreas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              No permissions match &quot;{search.trim()}&quot;.
            </p>
            <p className="text-sm text-muted-foreground">
              Try a simpler word, like &quot;approve&quot; or &quot;bills&quot;.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setOpenAreas([]);
              }}
            >
              Clear search
            </Button>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openAreas}
            onValueChange={setOpenAreas}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            {visibleAreas.map((area) => {
              const fullArea = areas.find((a) => a.code === area.code)!;
              return (
                <PermissionAreaSection
                  key={area.code}
                  area={area}
                  areaTotal={fullArea.keys.length}
                  areaAllowed={fullArea.keys.filter(isAllowed).length}
                  areaChanged={
                    fullArea.keys.filter(
                      (key) => granted.has(key) !== saved.has(key),
                    ).length
                  }
                  searching={searching}
                  readOnly={readOnly}
                  isAllowed={isAllowed}
                  isChanged={(key) => granted.has(key) !== saved.has(key)}
                  onToggle={(key, on) => setMany([key], on)}
                  onToggleArea={(on) => setMany(area.keys, on)}
                />
              );
            })}
          </Accordion>
        )}
      </div>

      {!readOnly && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-card px-6 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm" aria-live="polite">
              <p className={dirty ? "text-foreground" : "text-muted-foreground"}>
                {dirty
                  ? `${changeSummary(added, removed)} The role will have ${plural(granted.size, "permission", "permissions")}.`
                  : "No unsaved changes."}
              </p>
              {saveMut.isError && (
                <p role="alert" className="text-destructive">
                  Couldn&apos;t save the role. {saveMut.error.message} Try
                  again.
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                disabled={!dirty || saveMut.isPending}
                onClick={() => {
                  setGranted(new Set(role.permissionKeys));
                  saveMut.reset();
                }}
              >
                Discard changes
              </Button>
              <Button
                disabled={!dirty || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function changeSummary(added: number, removed: number) {
  if (added && removed)
    return `Giving ${plural(added, "new permission", "new permissions")} and taking away ${removed}.`;
  if (added) return `Giving ${plural(added, "new permission", "new permissions")}.`;
  return `Taking away ${plural(removed, "permission", "permissions")}.`;
}

function PermissionAreaSection({
  area,
  areaTotal,
  areaAllowed,
  areaChanged,
  searching,
  readOnly,
  isAllowed,
  isChanged,
  onToggle,
  onToggleArea,
}: {
  area: PermissionArea;
  areaTotal: number;
  areaAllowed: number;
  areaChanged: number;
  searching: boolean;
  readOnly: boolean;
  isAllowed: (key: string) => boolean;
  isChanged: (key: string) => boolean;
  onToggle: (key: string, on: boolean) => void;
  onToggleArea: (on: boolean) => void;
}) {
  const shownAllowed = area.keys.filter(isAllowed).length;
  const allShownOn = shownAllowed === area.keys.length;
  const status =
    areaAllowed === 0
      ? "None allowed"
      : areaAllowed === areaTotal
        ? `All ${areaTotal} allowed`
        : `${areaAllowed} of ${areaTotal} allowed`;

  return (
    <AccordionItem value={area.code} className="border-border">
      <div className="flex items-center gap-4 pr-4 transition-colors duration-150 hover:bg-muted/40">
        {/* The trigger renders inside Radix's header element, which needs the room. */}
        <div className="min-w-0 flex-1">
          <AccordionTrigger className="rounded-none px-4 py-3 hover:no-underline">
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-foreground">
                {area.label}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {status}
                {areaChanged > 0 && (
                  <span className="text-primary">
                    {" · "}
                    {areaChanged} unsaved
                  </span>
                )}
              </span>
            </span>
          </AccordionTrigger>
        </div>
        {!readOnly && (
          <label
            className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground"
            title={
              searching
                ? "Allow every permission shown here"
                : "Allow every permission in this area"
            }
          >
            <Checkbox
              aria-label={`Allow all${searching ? " shown" : ""} in ${area.label}`}
              checked={
                allShownOn ? true : shownAllowed > 0 ? "indeterminate" : false
              }
              onCheckedChange={(c) => onToggleArea(c === true)}
            />
            All
          </label>
        )}
      </div>
      <AccordionContent className="px-4 pb-4">
        <ul className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
          {area.keys.map((key) => {
            const changed = isChanged(key);
            return (
              <li key={key}>
                <label
                  title={key}
                  className={cn(
                    "flex items-start gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors duration-150",
                    readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted",
                    changed && "bg-primary/5",
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={isAllowed(key)}
                    disabled={readOnly}
                    onCheckedChange={(c) => onToggle(key, c === true)}
                  />
                  <span className="min-w-0 flex-1">{permissionLabel(key)}</span>
                  {changed && (
                    <span className="shrink-0 text-xs font-medium text-primary">
                      Changed
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
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
      </div>
      <Skeleton className="h-9 w-full sm:max-w-sm" />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: 8 }, (_, i) => (
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
  );
}
