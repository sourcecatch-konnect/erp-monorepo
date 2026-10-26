"use client";
import { useEffect, useState } from "react";
import { IconCheck, IconX, IconChevronDown } from "@tabler/icons-react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateUserAccessSchema,
  type UpdateUserAccessInput,
  type PermissionPageQuery,
} from "@skerp/validators";
import {
  permissionLabel,
  permissionAreaLabel,
  permissionAreaOf,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Input } from "@skerp/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@skerp/ui/components/radioButton";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@skerp/ui/components/collapsible";
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
  SheetDescription,
  SheetFooter,
} from "@skerp/ui/components/sheet";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TablePaginationFooter } from "@/components/data-table";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import type { BranchOption, RoleSummary } from "./types";

export function UserAccessDrawer({
  userId,
  roles,
  branches,
  onClose,
}: {
  userId: string;
  roles: RoleSummary[];
  branches: BranchOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const accessQuery = useQuery({
    queryKey: rbacKeys.user(userId),
    queryFn: () => rbacApi.getUserAccess(userId),
  });
  const access = accessQuery.data;
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
    if (access)
      form.reset({
        roleId: access.role?.id,
        branchScope: access.branchScope,
        branchIds: access.branchIds,
        overrides: access.overrides,
      });
  }, [access, form]);
  const scope = form.watch("branchScope");
  const roleId = form.watch("roleId");
  const branchIds = form.watch("branchIds") ?? [];
  const overrides = form.watch("overrides") ?? [];
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 4);
  const [area, setArea] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const pageParams: PermissionPageQuery = {
    page,
    size: pageSize,
    search: debouncedSearch.trim() || undefined,
    moduleCode: area === "all" ? undefined : area,
    roleId: roleId || undefined,
  };
  const catalogQuery = useQuery({
    queryKey: rbacKeys.permissionPage(pageParams),
    queryFn: ({ signal }) => rbacApi.permissionPage(pageParams, signal),
    enabled: expanded,
    staleTime: 60 * 1000,
  });
  const modulesQuery = useQuery({
    queryKey: rbacKeys.permissionModules,
    queryFn: () => rbacApi.permissionModules(),
    enabled: expanded,
    staleTime: 10 * 60 * 1000,
  });
  const areas = [...(modulesQuery.data ?? [])].sort((a, b) =>
    permissionAreaLabel(a.moduleCode).localeCompare(
      permissionAreaLabel(b.moduleCode),
    ),
  );
  const visiblePermissions = catalogQuery.data?.items ?? [];
  const totalPermissions = catalogQuery.data?.total ?? 0;
  const overrideMap = new Map(overrides.map((o) => [o.key, o.effect]));
  const saveMut = useMutation({
    mutationFn: (values: UpdateUserAccessInput) =>
      rbacApi.updateUserAccess(userId, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rbacKeys.users });
      void qc.invalidateQueries({ queryKey: rbacKeys.user(userId) });
      toast.success("Access updated successfully");
      onClose();
    },
  });
  const setOverride = (key: string, effect: string) => {
    // Same Radix "" quirk as the role select: ignore it rather than treating
    // it as "Same as role", which would silently drop the override.
    if (effect !== "none" && effect !== "GRANT" && effect !== "DENY") return;
    const without = overrides.filter((o) => o.key !== key);
    form.setValue(
      "overrides",
      effect === "none" ? without : [...without, { key, effect }],
      { shouldDirty: true },
    );
  };
  const name = access
    ? [access.firstName, access.middleName, access.lastName]
        .filter(Boolean)
        .join(" ") || access.userName
    : "";
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !saveMut.isPending) onClose();
      }}
    >
      <SheetContent className="flex h-dvh w-full flex-col overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>
            {name ? `Edit access for ${name}` : "Edit access"}
          </SheetTitle>
          <SheetDescription>
            {access?.email ??
              "Choose what this person can do and which branches they work in."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {accessQuery.isError ? (
            <div role="alert" className="space-y-3 p-4 text-sm">
              <p>Couldn&apos;t load this person&apos;s access. Try again.</p>
              <Button
                variant="outline"
                onClick={() => void accessQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : !access ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <FormProvider {...form}>
              <form
                id="user-access-form"
                onSubmit={form.handleSubmit((values) => saveMut.mutate(values))}
                className="space-y-6 p-4"
              >
                <fieldset disabled={saveMut.isPending} className="space-y-6">
                  <section className="space-y-3 rounded-lg border bg-card p-4">
                    <label
                      htmlFor="access-role"
                      className="text-base font-semibold"
                    >
                      Role
                    </label>
                    <p className="text-sm text-muted-foreground">
                      The role decides what this person can do. Pick the one
                      that matches their job.
                    </p>
                    <Controller
                      control={form.control}
                      name="roleId"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          // Radix's hidden native <select> reports "" when the
                          // reset value lands before its options register,
                          // which would wipe the loaded role. Never a real pick.
                          onValueChange={(value) => {
                            if (value) field.onChange(value);
                          }}
                        >
                          <SelectTrigger id="access-role">
                            <SelectValue placeholder="Pick a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                                {r.isSystem ? " (built-in)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.roleId && (
                      <p role="alert" className="text-sm text-destructive">
                        Pick a role.
                      </p>
                    )}
                  </section>
                  <section className="space-y-3 rounded-lg border bg-card p-4">
                    <h2 id="branches-label" className="text-base font-semibold">
                      Branches
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Which branches can this person see and work in?
                    </p>
                    <Controller
                      control={form.control}
                      name="branchScope"
                      render={({ field }) => (
                        <RadioGroup
                          aria-labelledby="branches-label"
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="ALL" />
                            All branches
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="ASSIGNED" />
                            Only the branches I pick
                          </label>
                        </RadioGroup>
                      )}
                    />
                    {scope === "ASSIGNED" && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {branchIds.length} of {branches.length} picked
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {branches.map((b) => (
                            <label
                              key={b.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={branchIds.includes(b.id)}
                                onCheckedChange={(checked) =>
                                  form.setValue(
                                    "branchIds",
                                    checked === true
                                      ? [...branchIds, b.id]
                                      : branchIds.filter((id) => id !== b.id),
                                    { shouldDirty: true, shouldValidate: true },
                                  )
                                }
                              />
                              {b.name}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                    {form.formState.errors.branchIds && (
                      <p role="alert" className="text-sm text-destructive">
                        Pick at least one branch.
                      </p>
                    )}
                  </section>
                  <Collapsible
                    open={expanded}
                    onOpenChange={setExpanded}
                    className="rounded-lg border bg-card"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-semibold">
                      <span>Special permissions</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {overrides.length ? `${overrides.length} set` : "None"}
                        <IconChevronDown
                          size={18}
                          aria-hidden="true"
                          className={expanded ? "rotate-180" : undefined}
                        />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 p-4 pt-0">
                      <p className="text-sm text-muted-foreground">
                        Allow or block a single action for this person only,
                        without changing their role. Most people don&apos;t need
                        any.
                      </p>
                      <section className="space-y-2">
                        <h3 className="text-sm font-medium">
                          Set for this person
                        </h3>
                        {overrides.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No special permissions are set. Their role decides
                            what they can do.
                          </p>
                        ) : (
                          overrides.map((o) => (
                            <div
                              key={o.key}
                              className="flex items-center justify-between gap-2 rounded-sm bg-primary/5 p-2 text-sm"
                            >
                              <div className="min-w-0 break-words">
                                <span className="font-medium">
                                  {o.effect === "GRANT" ? "Allowed" : "Blocked"}
                                </span>{" "}
                                {" \u00b7 "}
                                <span title={o.key}>
                                  {permissionLabel(o.key)}
                                </span>
                                <p className="text-muted-foreground">
                                  {permissionAreaLabel(permissionAreaOf(o.key))}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Go back to what the role allows"
                                aria-label={`Remove special permission: ${permissionLabel(o.key)}`}
                                onClick={() => setOverride(o.key, "none")}
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        )}
                      </section>
                      <div className="min-w-0 space-y-3">
                        <h3 className="text-sm font-medium">Search category</h3>
                        {modulesQuery.isPending ? (
                          <Skeleton className="h-9 w-full" />
                        ) : modulesQuery.isError ? (
                          <div role="alert" className="space-y-2 text-sm">
                            <p>Couldn&apos;t load categories.</p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void modulesQuery.refetch()}
                            >
                              Try again
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={area}
                            onValueChange={(value) => {
                              setArea(value);
                              setPage(0);
                            }}
                          >
                            <SelectTrigger
                              id="permission-category"
                              aria-label="Permission category"
                              className="w-full min-w-0"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">
                                All categories
                              </SelectItem>
                              {areas.map((a) => (
                                <SelectItem
                                  key={a.moduleCode}
                                  value={a.moduleCode}
                                >
                                  {permissionAreaLabel(a.moduleCode)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Input
                          id="permission-search"
                          aria-label="Search permissions"
                          placeholder="Search, e.g. approve payments"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                          }}
                        />
                      </div>
                      {(search || area !== "all") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setArea("all");
                            setPage(0);
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                      {catalogQuery.isError ? (
                        <div role="alert" className="space-y-2 text-sm">
                          <p>Couldn&apos;t load permissions.</p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void catalogQuery.refetch()}
                          >
                            Try again
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Table className="min-w-[24rem] table-fixed sm:min-w-0">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="whitespace-normal">
                                  What they can do
                                </TableHead>
                                <TableHead className="w-16 whitespace-normal text-center">
                                  Access
                                </TableHead>
                                <TableHead className="w-40 whitespace-normal">
                                  For this person
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catalogQuery.isPending ? (
                                Array.from({ length: 4 }, (_, i) => (
                                  <TableRow key={i}>
                                    {[0, 1, 2].map((j) => (
                                      <TableCell key={j}>
                                        <Skeleton className="h-5 w-full" />
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))
                              ) : visiblePermissions.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={3}
                                    className="py-6 text-sm text-muted-foreground"
                                  >
                                    {search || area !== "all"
                                      ? "No permissions match these filters. Try a simpler word or clear the filters."
                                      : "No permissions are available yet."}
                                  </TableCell>
                                </TableRow>
                              ) : (
                                visiblePermissions.map((p, i) => (
                                  <PermissionRow
                                    key={p.key}
                                    areaHeading={
                                      i === 0 ||
                                      permissionAreaOf(
                                        visiblePermissions[i - 1]!.key,
                                      ) !== permissionAreaOf(p.key)
                                    }
                                    permissionKey={p.key}
                                    effect={overrideMap.get(p.key) ?? "none"}
                                    allowed={p.roleAllowed}
                                    onChange={(effect) =>
                                      setOverride(p.key, effect)
                                    }
                                  />
                                ))
                              )}
                            </TableBody>
                          </Table>
                          {!catalogQuery.isPending &&
                            totalPermissions > pageSize && (
                              <TablePaginationFooter
                                total={totalPermissions}
                                page={page}
                                size={pageSize}
                                onPageChange={setPage}
                              />
                            )}
                        </>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </fieldset>
              </form>
            </FormProvider>
          )}
        </div>
        <SheetFooter className="shrink-0 border-t p-4">
          {Object.keys(form.formState.errors).length > 0 && (
            <p
              role="alert"
              className="rounded-sm border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
            >
              {form.formState.errors.branchIds
                ? "Pick at least one branch before saving."
                : form.formState.errors.roleId
                  ? "Pick a role before saving."
                  : "Check the highlighted fields before saving."}
            </p>
          )}
          {saveMut.isError && (
            <p
              role="alert"
              className="rounded-sm border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
            >
              Couldn&apos;t save access. {saveMut.error.message} Try again.
            </p>
          )}
          <div className="flex w-full justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saveMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="user-access-form"
              disabled={!access || accessQuery.isError || saveMut.isPending}
            >
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
function PermissionRow({
  permissionKey,
  effect,
  allowed,
  areaHeading,
  onChange,
}: {
  permissionKey: string;
  effect: string;
  allowed: boolean;
  areaHeading: boolean;
  onChange: (effect: string) => void;
}) {
  const effectiveAllowed = effect === "GRANT" || (effect !== "DENY" && allowed);
  return (
    <>
      {areaHeading && (
        <TableRow className="bg-muted/40">
          <TableCell colSpan={3} className="whitespace-normal font-medium">
            {permissionAreaLabel(permissionAreaOf(permissionKey))}
          </TableCell>
        </TableRow>
      )}
      <TableRow className={effect !== "none" ? "bg-primary/5" : undefined}>
        <TableCell
          title={permissionKey}
          className="whitespace-normal break-words"
        >
          {permissionLabel(permissionKey)}
        </TableCell>
        <TableCell className="text-center">
          {effectiveAllowed ? (
            <span title="Allowed" className="inline-flex text-success">
              <IconCheck size={20} aria-hidden="true" />
              <span className="sr-only">Allowed</span>
            </span>
          ) : (
            <span title="Not allowed" className="inline-flex text-destructive">
              <IconX size={20} aria-hidden="true" />
              <span className="sr-only">Not allowed</span>
            </span>
          )}
        </TableCell>
        <TableCell>
          <Select value={effect} onValueChange={onChange}>
            <SelectTrigger
              aria-label={`Special permission: ${permissionLabel(permissionKey)}`}
              className="w-full min-w-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Same as role</SelectItem>
              <SelectItem value="GRANT">Allow</SelectItem>
              <SelectItem value="DENY">Block</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
      </TableRow>
    </>
  );
}
