"use client";

import { useEffect, useMemo } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateUserAccessSchema,
  type UpdateUserAccessInput,
} from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@skerp/ui/components/sheet";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";

export function UserAccessDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: access } = useQuery({
    queryKey: rbacKeys.user(userId),
    queryFn: () => rbacApi.getUserAccess(userId),
  });
  const { data: roles } = useQuery({
    queryKey: rbacKeys.roles,
    queryFn: rbacApi.listRoles,
  });
  const { data: branches } = useQuery({
    queryKey: rbacKeys.branches,
    queryFn: rbacApi.branches,
  });
  const { data: catalog } = useQuery({
    queryKey: rbacKeys.permissions,
    queryFn: rbacApi.permissions,
  });

  const form = useForm<UpdateUserAccessInput>({
    resolver: zodResolver(updateUserAccessSchema),
    defaultValues: {
      roleId: undefined,
      branchScope: "ASSIGNED",
      branchIds: [],
      overrides: [],
    },
  });

  useEffect(() => {
    if (!access) return;
    form.reset({
      roleId: access.role?.id,
      branchScope: access.branchScope,
      branchIds: access.branchIds,
      overrides: access.overrides,
    });
  }, [access, form]);

  const scope = form.watch("branchScope");
  const branchIds = form.watch("branchIds") ?? [];
  const overrides = form.watch("overrides") ?? [];

  const overrideMap = useMemo(
    () => new Map(overrides.map((o) => [o.key, o.effect])),
    [overrides]
  );

  const saveMut = useMutation({
    mutationFn: (values: UpdateUserAccessInput) =>
      rbacApi.updateUserAccess(userId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.users });
      qc.invalidateQueries({ queryKey: rbacKeys.user(userId) });
      onClose();
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    saveMut.mutate(values);
  });

  const toggleBranch = (id: string) => {
    const next = branchIds.includes(id)
      ? branchIds.filter((b) => b !== id)
      : [...branchIds, id];
    form.setValue("branchIds", next, { shouldDirty: true });
  };

  const setOverride = (key: string, effect: "GRANT" | "DENY" | "none") => {
    const without = overrides.filter((o) => o.key !== key);
    form.setValue(
      "overrides",
      effect === "none" ? without : [...without, { key, effect }],
      { shouldDirty: true }
    );
  };

  const loading = !access || !roles || !branches || !catalog;
  const branchError = form.formState.errors.branchIds?.message;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit access</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <FormProvider {...form}>
            <form
              id="user-access-form"
              onSubmit={onSubmit}
              className="space-y-6 p-4"
            >
              <section className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Role
                </label>
                <Controller
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles!.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} {r.isSystem && "(system)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </section>

              <section className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Branch scope
                </label>
                <Controller
                  control={form.control}
                  name="branchScope"
                  render={({ field }) => (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={field.value === "ALL"}
                          onChange={() => field.onChange("ALL")}
                        />
                        All branches
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={field.value === "ASSIGNED"}
                          onChange={() => field.onChange("ASSIGNED")}
                        />
                        Specific branches
                      </label>
                    </div>
                  )}
                />
                {scope === "ASSIGNED" && (
                  <div
                    className={`grid grid-cols-1 gap-2 rounded-sm border p-3 sm:grid-cols-2 ${branchError ? "border-destructive" : "border-border"}`}
                  >
                    {branches!.map((b) => (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={branchIds.includes(b.id)}
                          onCheckedChange={() => toggleBranch(b.id)}
                        />
                        <span>
                          {b.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {b.shortCode}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {typeof branchError === "string" && (
                  <p className="text-xs text-destructive">{branchError}</p>
                )}
              </section>

              <Advanced
                catalog={catalog!}
                overrideMap={overrideMap}
                onChange={setOverride}
              />
            </form>
          </FormProvider>
        )}

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-access-form"
            disabled={saveMut.isPending || loading}
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Advanced({
  catalog,
  overrideMap,
  onChange,
}: {
  catalog: { id: string; key: string }[];
  overrideMap: Map<string, "GRANT" | "DENY">;
  onChange: (key: string, effect: "GRANT" | "DENY" | "none") => void;
}) {
  return (
    <details className="rounded-sm border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">
        Advanced (per-user overrides)
      </summary>
      <div className="space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Overrides apply on top of the role&apos;s permissions. DENY beats
          GRANT.
        </p>
        <div className="max-h-72 overflow-y-auto rounded-sm border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Permission</th>
                <th className="px-3 py-2 font-medium">Effect</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {catalog.map((p) => {
                const current = overrideMap.get(p.key) ?? "none";
                return (
                  <tr
                    key={p.id}
                    className="border-t border-border first:border-t-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-foreground">
                      {p.key}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={current}
                        onValueChange={(v) =>
                          onChange(p.key, v as "GRANT" | "DENY" | "none")
                        }
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— (inherit)</SelectItem>
                          <SelectItem value="GRANT">Grant</SelectItem>
                          <SelectItem value="DENY">Deny</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {overrideMap.has(p.key) ? "Overridden" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
