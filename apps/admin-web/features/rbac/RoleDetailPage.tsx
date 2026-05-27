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

  const { data: catalog } = useQuery({
    queryKey: rbacKeys.permissions,
    queryFn: rbacApi.permissions,
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

  const grouped = useMemo(() => {
    if (!catalog) return [];
    const byModule = new Map<string, PermissionDefDto[]>();
    for (const p of catalog) {
      const list = byModule.get(p.moduleCode) ?? [];
      list.push(p);
      byModule.set(p.moduleCode, list);
    }
    return Array.from(byModule.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const saveMut = useMutation({
    mutationFn: () => rbacApi.setRolePermissions(roleId, Array.from(granted)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.role(roleId) });
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

  if (!role || !catalog) {
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
      </header>

      {readOnly && (
        <div className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This role is locked. To change system-role permissions, edit
          <code className="mx-1 rounded-sm bg-background px-1">prisma/seed-admin.ts</code>
          and re-seed.
        </div>
      )}

      <Accordion type="multiple" className="space-y-3">
        {grouped.map(([moduleCode, perms]) => {
          const allOn = perms.every((p) => granted.has(p.key));
          const someOn = perms.some((p) => granted.has(p.key));
          const selectedCount = perms.filter((p) => granted.has(p.key)).length;
          const moduleLabel = titleizeIdentifier(moduleCode);
          return (
            <AccordionItem
              key={moduleCode}
              value={moduleCode}
              className="overflow-hidden rounded-sm border border-border bg-card"
            >
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium text-foreground">
                      {moduleLabel}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {selectedCount} of {perms.length} permissions selected
                    </span>
                  </span>
                </AccordionTrigger>
                {!readOnly && (
                  <div className="flex shrink-0 items-center">
                    <Checkbox
                      checked={allOn ? true : someOn ? "indeterminate" : false}
                      onCheckedChange={(c) => toggleModule(perms, c === true)}
                    />
                  </div>
                )}
              </div>
              <AccordionContent className="p-0">
                <ul className="divide-y divide-border">
                  {perms.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {permissionActionLabel(p.key)}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
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
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
