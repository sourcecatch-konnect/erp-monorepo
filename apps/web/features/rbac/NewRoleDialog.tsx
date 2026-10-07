"use client";

import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRoleSchema, type CreateRoleInput } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import TextField from "../masters/_shared/fields/TextField";
import SelectField from "../masters/_shared/fields/SelectField";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import type { RoleSummary } from "./types";

/** Select item for "start empty" — Radix Select can't use "" as an item value. */
const NO_SOURCE = "none";

const permissionsOf = (role: RoleSummary) =>
  role.isSystem
    ? "every permission"
    : `${role._count.rolePermissions} permission${role._count.rolePermissions === 1 ? "" : "s"}`;

export function NewRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "", inheritFromRoleId: NO_SOURCE },
  });
  // Every role, not a page: anyone can be the starting point.
  const rolesQuery = useQuery({
    queryKey: rbacKeys.roles,
    queryFn: rbacApi.listRoles,
    enabled: open,
  });
  const roles = rolesQuery.data ?? [];
  const sourceId = form.watch("inheritFromRoleId");
  const source = roles.find((r) => r.id === sourceId);

  const createMut = useMutation({
    mutationFn: rbacApi.createRole,
    onSuccess: (role) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.roles });
      toast.success(`Role "${role.name}" created`);
      form.reset();
      onOpenChange(false);
      // Next step is always reviewing or picking its permissions.
      router.push(`/settings/roles/${role.id}`);
    },
  });

  const setOpen = (next: boolean) => {
    if (createMut.isPending) return;
    if (!next) {
      form.reset();
      createMut.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Name the role, and start from an existing role&apos;s permissions if
            it&apos;s similar.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            id="new-role-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              createMut.mutate({
                name: values.name,
                inheritFromRoleId:
                  values.inheritFromRoleId === NO_SOURCE
                    ? undefined
                    : values.inheritFromRoleId,
              }),
            )}
          >
            <fieldset disabled={createMut.isPending} className="space-y-4">
              <TextField<CreateRoleInput>
                name="name"
                label="Role name"
                placeholder="e.g. Accounts assistant"
                required
              />
              <div className="space-y-2">
                <SelectField<CreateRoleInput>
                  name="inheritFromRoleId"
                  label="Inherit permissions from"
                  options={[
                    {
                      value: NO_SOURCE,
                      label: "Don't inherit (start with no permissions)",
                    },
                    ...roles.map((r) => ({
                      value: r.id,
                      label: `${r.name} · ${permissionsOf(r)}`,
                    })),
                  ]}
                />
                {rolesQuery.isError ? (
                  <div role="alert" className="flex items-center gap-3 text-sm">
                    <span className="text-destructive">
                      Couldn&apos;t load roles to inherit from.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void rolesQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {source
                      ? `Starts with ${permissionsOf(source)} from ${source.name}. You can change them on the next page. Later changes to ${source.name} won't change this role.`
                      : "The role starts empty. You'll pick its permissions on the next page."}
                  </p>
                )}
              </div>
            </fieldset>
          </form>
        </FormProvider>
        {createMut.isError && (
          <p
            role="alert"
            className="rounded-sm border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          >
            Couldn&apos;t create the role. {createMut.error.message}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={createMut.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-role-form"
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "Creating…" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
