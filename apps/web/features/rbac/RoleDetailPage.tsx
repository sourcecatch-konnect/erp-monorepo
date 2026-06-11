"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@skerp/ui/components/accordion";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import type { PermissionDefDto } from "./types";

const titleizeIdentifier = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s._:-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const permissionActionLabel = (key: string): string => {
  const action = key.split(".").at(-1) ?? key;
  return titleizeIdentifier(action);
};

export function RoleDetailPage({ roleId }: { roleId: string }) {
  const qc = useQueryClient();
  const { setLabel } = useBreadcrumbLabels();

  const { data: role } = useQuery({
    queryKey: rbacKeys.role(roleId),
    queryFn: () => rbacApi.getRole(roleId),
  });
const { data: modules = [], isLoading: modulesLoading } = useQuery({
  queryKey: rbacKeys.permissionModules,
  queryFn: () => rbacApi.permissionModules(),
  staleTime: 10 * 60 * 1000,
});

  const [granted, setGranted] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (role) setGranted(new Set(role.permissionKeys));
  }, [role]);

  useEffect(() => {
    const href = `/settings/roles/${roleId}`;
    setLabel(href, role?.name ?? null);
    return () => setLabel(href, null);
  }, [role?.name, roleId, setLabel]);

const [openModules, setOpenModules] = useState<string[]>([]);
const saveMut = useMutation({
  mutationFn: () => rbacApi.setRolePermissions(roleId, Array.from(granted)),
  onSuccess: () => {
    qc.setQueryData(rbacKeys.role(roleId), (old: any) => {
      if (!old) return old;

      return {
        ...old,
        permissionKeys: Array.from(granted),
        _count: {
          ...old._count,
          rolePermissions: granted.size,
        },
      };
    });

    qc.invalidateQueries({ queryKey: rbacKeys.roles });
  },
});

  const toggle = (key: string) => {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (perms: PermissionDefDto[], on: boolean) => {
    setGranted((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (on) next.add(p.key);
        else next.delete(p.key);
      }
      return next;
    });
  };

  const readOnly = role?.isSystem ?? false;
  const dirty =
    !!role &&
    (granted.size !== role.permissionKeys.length ||
      role.permissionKeys.some((k) => !granted.has(k)));

  if (!role) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-sm border border-border bg-card"
          >
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
          <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/settings/roles"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← All roles
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {role.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {role.isSystem
              ? "System role — managed by the seed script, not editable here."
              : `${role._count.users} user${role._count.users === 1 ? "" : "s"} · ${granted.size} permission${granted.size === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2">
          {!readOnly && dirty && (
            <Button
              variant="outline"
              onClick={() => setGranted(new Set(role.permissionKeys))}
            >
              Discard
            </Button>
          )}
          {!readOnly && (
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
            >
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </div>
        </div>
      </header>

      {readOnly && (
        <div className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This role is locked. To change system-role permissions, edit
          <code className="mx-1 rounded-sm bg-background px-1">prisma/seed-admin.ts</code>
          and re-seed.
        </div>
      )}

  <Accordion
  type="multiple"
  value={openModules}
  onValueChange={setOpenModules}
  className="space-y-3"
>
  {modules.map((m) => (
    <RolePermissionModule
      key={m.moduleCode}
      moduleCode={m.moduleCode}
      moduleLabel={m.label}
      permissionCount={m.permissionCount}
      granted={granted}
      setGranted={setGranted}
      readOnly={readOnly}
      isOpen={openModules.includes(m.moduleCode)}
    />
  ))}
</Accordion>
{!readOnly && dirty && (
  <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
    <p className="text-sm text-muted-foreground">
      You have unsaved permission changes.
    </p>

    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => setGranted(new Set(role.permissionKeys))}
      >
        Discard
      </Button>

      <Button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
      >
        {saveMut.isPending ? "Saving..." : "Save changes"}
      </Button>
    </div>
  </div>
)}
    </div>
  );
}
function RolePermissionModule({
  moduleCode,
  moduleLabel,
  permissionCount,
  granted,
  setGranted,
  readOnly,
  isOpen,
}: {
  moduleCode: string;
  moduleLabel: string;
  permissionCount: number;
  granted: Set<string>;
  setGranted: React.Dispatch<React.SetStateAction<Set<string>>>;
  readOnly: boolean;
  isOpen: boolean;
}) {
  const { data: perms = [], isLoading } = useQuery<PermissionDefDto[]>({
    queryKey: rbacKeys.permissionsByModule(moduleCode),
    queryFn: () => rbacApi.permissions(moduleCode),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const allOn = perms.length > 0 && perms.every((p) => granted.has(p.key));
  const someOn = perms.some((p) => granted.has(p.key));
  const selectedCount = perms.filter((p) => granted.has(p.key)).length;

  const toggle = (key: string) => {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (on: boolean) => {
    setGranted((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (on) next.add(p.key);
        else next.delete(p.key);
      }
      return next;
    });
  };

  return (
    <AccordionItem
      value={moduleCode}
    className="overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md"
    >
     <div className="flex items-center gap-4 border-b bg-muted/30 px-5">
      <AccordionTrigger className="flex-1 py-4 text-left hover:no-underline">
          <span className="flex min-w-0 flex-col">
            <span className="font-medium text-foreground">{moduleLabel}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {isOpen
                ? `${selectedCount} of ${perms.length} permissions selected`
                : `${permissionCount} permissions`}
            </span>
          </span>
        </AccordionTrigger>

        {!readOnly && isOpen && (
          <div className="flex shrink-0 items-center">
            <Checkbox
              checked={allOn ? true : someOn ? "indeterminate" : false}
              onCheckedChange={(c) => toggleModule(c === true)}
            />
          </div>
        )}
      </div>

      <AccordionContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {perms.map((p) => (
              <li
                key={p.key}
               className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-muted/40"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {permissionActionLabel(p.key)}
                  </div>
                  <div className="mt-1 inline-flex rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {p.key}
                  </div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground">
                      {p.description}
                    </div>
                  )}
                </div>

                <Checkbox
                  checked={granted.has(p.key)}
                  disabled={readOnly}
                  onCheckedChange={() => toggle(p.key)}
                />
              </li>
            ))}
          </ul>
        )}
      </AccordionContent>
      
    </AccordionItem>
    
    
  );
}