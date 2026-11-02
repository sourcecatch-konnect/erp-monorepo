"use client";
import { useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconMinus,
} from "@tabler/icons-react";
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
  permissionActionOf,
  permissionAreaGroup,
  permissionAreaLabel,
  permissionAreaOf,
  permissionAreaShortLabel,
  PERMISSION_GROUP_ORDER,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TablePaginationFooter } from "@/components/data-table";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import { actionIcon } from "./components/permission-icons";
import type { BranchOption, RoleSummary } from "./types";

/** "changed" reviews what's already set for this person; "browse" finds more. */
type AccessTab = "changed" | "browse";

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
  const [tab, setTab] = useState<AccessTab>("browse");
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
  /**
   * ~35 flat options is the same wall the role editor had. Bucket them so the
   * dropdown opens on six headings instead of an alphabetical list.
   */
  const areaGroups = PERMISSION_GROUP_ORDER.map((name) => ({
    name,
    areas: areas.filter((a) => permissionAreaGroup(a.moduleCode) === name),
  })).filter((g) => g.areas.length > 0);
  const visiblePermissions = catalogQuery.data?.items ?? [];
  const totalPermissions = catalogQuery.data?.total ?? 0;
  const overrideMap = new Map(overrides.map((o) => [o.key, o.effect]));

  const selectedRole = roles.find((r) => r.id === roleId);
  const roleName = selectedRole?.name ?? "";
  /**
   * The table rows carry `roleAllowed` from the server, but only for the page
   * being shown. The override chips sit above the table and can name any key,
   * so read the role's whole set once instead of paging to find each one.
   */
  const roleQuery = useQuery({
    queryKey: rbacKeys.role(roleId ?? ""),
    queryFn: () => rbacApi.getRole(roleId!),
    enabled: expanded && Boolean(roleId),
    staleTime: 60 * 1000,
  });
  const roleKeys = roleQuery.data
    ? new Set(roleQuery.data.permissionKeys)
    : null;
  /** `undefined` means "not known yet" — never claim either way on a guess. */
  const roleAllows = (key: string): boolean | undefined => {
    // The server grants built-in roles everything, whatever is stored.
    if (selectedRole?.isSystem) return true;
    return roleKeys ? roleKeys.has(key) : undefined;
  };

  /** Changes that match what the role already says, so they do nothing. */
  const pointlessOverrides = overrides
    .filter((o) => isRedundant(o.effect, roleAllows(o.key)))
    .map((o) => o.key);

  const removeOverrides = (keys: string[]) => {
    const drop = new Set(keys);
    form.setValue(
      "overrides",
      overrides.filter((o) => !drop.has(o.key)),
      { shouldDirty: true },
    );
  };

  const pendingChanges: string[] = [];
  if (access) {
    if (roleId !== access.role?.id)
      pendingChanges.push(`role → ${roleName || "none"}`);
    if (scope !== access.branchScope)
      pendingChanges.push(
        scope === "ALL" ? "all branches" : "only the branches you picked",
      );
    else if (
      scope === "ASSIGNED" &&
      (branchIds.length !== access.branchIds.length ||
        branchIds.some((id) => !access.branchIds.includes(id)))
    )
      pendingChanges.push(
        branchIds.length === 1 ? "1 branch" : `${branchIds.length} branches`,
      );
    const savedOverrides = new Map(
      access.overrides.map((o) => [o.key, o.effect]),
    );
    const changedOverrides = new Set([
      ...overrides
        .filter((o) => savedOverrides.get(o.key) !== o.effect)
        .map((o) => o.key),
      ...access.overrides
        .filter((o) => !overrideMap.has(o.key))
        .map((o) => o.key),
    ]);
    if (changedOverrides.size)
      pendingChanges.push(
        changedOverrides.size === 1
          ? "1 thing changed just for them"
          : `${changedOverrides.size} things changed just for them`,
      );
  }
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
      {/* Four columns plus a "Use the <role> role" dropdown don't fit in the
          default sheet width — the control was overlapping the Result column. */}
      <SheetContent className="flex h-dvh w-full flex-col overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-3xl data-[side=right]:lg:max-w-5xl">
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
                      <span>Change something just for this person</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {overrides.length
                          ? `${overrides.length} changed`
                          : "Nothing changed"}
                        <IconChevronDown
                          size={18}
                          aria-hidden="true"
                          className={expanded ? "rotate-180" : undefined}
                        />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 p-4 pt-0">
                      <p className="text-sm text-muted-foreground">
                        Give {name || "this person"} something extra, or take
                        something away — for them only. Everyone else with the{" "}
                        {roleName || "same"} role stays the same. Most people
                        don&apos;t need this.
                      </p>
                      {/* Two jobs, two tabs. Reviewing what's already been
                          changed and hunting through 250 permissions for
                          something new are different tasks, and stacking the
                          first above the second buried the search behind a
                          list that grows with every change made. */}
                      <Tabs
                        value={tab}
                        onValueChange={(v) => setTab(v as AccessTab)}
                      >
                        <TabsList>
                          <TabsTrigger value="changed">
                            Changed
                            {overrides.length ? ` (${overrides.length})` : ""}
                          </TabsTrigger>
                          <TabsTrigger value="browse">
                            All permissions
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="changed" className="space-y-3">
                          {overrides.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              Nothing has been changed for{" "}
                              {name || "this person"}.{" "}
                              {roleName
                                ? `The ${roleName} role decides everything.`
                                : "Their role decides everything."}
                            </p>
                          ) : (
                            <>
                              {/* One banner beats repeating the same warning
                                  on a dozen rows. */}
                              {pointlessOverrides.length > 0 && (
                                <div
                                  role="status"
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-muted/40 p-3 text-sm"
                                >
                                  <span className="flex items-start gap-2">
                                    <IconAlertTriangle
                                      size={16}
                                      aria-hidden="true"
                                      className="mt-0.5 shrink-0 text-muted-foreground"
                                    />
                                    <span className="text-muted-foreground">
                                      {pointlessOverrides.length === 1
                                        ? "1 of these changes does nothing"
                                        : `${pointlessOverrides.length} of these changes do nothing`}{" "}
                                      \u2014 the {roleName || "their"} role
                                      already says the same. They will keep
                                      overriding it if the role changes later.
                                    </span>
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      removeOverrides(pointlessOverrides)
                                    }
                                  >
                                    Undo those
                                  </Button>
                                </div>
                              )}
                              {overrides.map((o) => (
                                <OverrideChip
                                  key={o.key}
                                  permissionKey={o.key}
                                  effect={o.effect}
                                  /* undefined until the role's set loads \u2014
                                     then we don't claim either way. */
                                  roleAllowed={roleAllows(o.key)}
                                  roleName={roleName}
                                  onRemove={() => setOverride(o.key, "none")}
                                />
                              ))}
                            </>
                          )}
                        </TabsContent>

                        <TabsContent value="browse" className="space-y-4">
                          <div className="min-w-0 space-y-3">
                            <h3 className="text-sm font-medium">
                              Find something to change
                            </h3>
                            <label
                              htmlFor="permission-category"
                              className="block text-xs font-medium text-muted-foreground"
                            >
                              Area
                            </label>
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
                                  <SelectItem value="all">All areas</SelectItem>
                                  {areaGroups.map((group) => (
                                    <SelectGroup key={group.name}>
                                      <SelectLabel>{group.name}</SelectLabel>
                                      {group.areas.map((a) => (
                                        <SelectItem
                                          key={a.moduleCode}
                                          value={a.moduleCode}
                                        >
                                          {permissionAreaShortLabel(
                                            a.moduleCode,
                                          )}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <label
                              htmlFor="permission-search"
                              className="block text-xs font-medium text-muted-foreground"
                            >
                              Search
                            </label>
                            <Input
                              id="permission-search"
                              aria-label="Search permissions"
                              placeholder="e.g. approve payments"
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
                          {/* Read once, and the four columns explain themselves
                          for the rest of the screen. */}
                          <p className="rounded-sm bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                            Each row reads left to right: what the{" "}
                            <strong className="font-medium text-foreground">
                              {roleName || "their"} role
                            </strong>{" "}
                            gives everyone who has it, what you set{" "}
                            <strong className="font-medium text-foreground">
                              for this person
                            </strong>
                            , and what they end up with.{" "}
                            <strong className="font-medium text-foreground">
                              Always allow
                            </strong>{" "}
                            gives them something extra;{" "}
                            <strong className="font-medium text-foreground">
                              Always block
                            </strong>{" "}
                            takes something away. Leave it on{" "}
                            <strong className="font-medium text-foreground">
                              Use the {roleName || "their"} role
                            </strong>{" "}
                            to change nothing.
                          </p>
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
                                    {/* Naming the source is the point of this
                                    screen: without it you can't tell a ✓ that
                                    came from the role from one you added. */}
                                    <TableHead
                                      className="w-20 whitespace-normal text-center"
                                      title={
                                        roleName
                                          ? `What the ${roleName} role gives everyone who has it`
                                          : "What their role gives"
                                      }
                                    >
                                      {roleName
                                        ? `${roleName} role`
                                        : "Their role"}
                                    </TableHead>
                                    <TableHead className="w-56 whitespace-normal">
                                      For this person
                                    </TableHead>
                                    <TableHead className="w-16 whitespace-normal text-center">
                                      Result
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {catalogQuery.isPending ? (
                                    Array.from({ length: 4 }, (_, i) => (
                                      <TableRow key={i}>
                                        {[0, 1, 2, 3].map((j) => (
                                          <TableCell key={j}>
                                            <Skeleton className="h-5 w-full" />
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))
                                  ) : visiblePermissions.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={4}
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
                                        effect={
                                          overrideMap.get(p.key) ?? "none"
                                        }
                                        allowed={p.roleAllowed}
                                        roleName={roleName}
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
                        </TabsContent>
                      </Tabs>
                    </CollapsibleContent>
                  </Collapsible>
                </fieldset>
              </form>
            </FormProvider>
          )}
        </div>
        <SheetFooter className="shrink-0 border-t p-4">
          {/* Say what Save will do. The three sections scroll independently,
              so without this you can change a role, the branches and several
              overrides with nothing on screen summarising any of it. */}
          {access && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {pendingChanges.length
                ? `Not saved yet: ${pendingChanges.join(" · ")}.`
                : "Nothing to save."}
            </p>
          )}
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
/**
 * Yes / no as a tick or a quiet dash. Not-allowed is the ordinary state for
 * most of a few hundred permissions, so it must not read as an error — a
 * column of red crosses makes the handful of real ticks hard to find.
 */
function YesNo({ allowed, what }: { allowed: boolean; what: string }) {
  const text = `${what}: ${allowed ? "yes" : "no"}`;
  return allowed ? (
    <span className="inline-flex text-success" title={text}>
      <IconCheck size={18} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  ) : (
    <span className="inline-flex text-muted-foreground" title={text}>
      <IconMinus size={18} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** A per-person change that matches what the role already says does nothing. */
const isRedundant = (effect: string, roleAllowed: boolean | undefined) =>
  roleAllowed !== undefined &&
  ((effect === "GRANT" && roleAllowed) || (effect === "DENY" && !roleAllowed));

const redundantNote = (roleName: string, roleAllowed: boolean) =>
  `The ${roleName || "their"} role already ${roleAllowed ? "allows" : "blocks"} this, so you don't need to set it here. If you do, it will stay this way even after the role is changed.`;

function PermissionRow({
  permissionKey,
  effect,
  allowed,
  areaHeading,
  roleName,
  onChange,
}: {
  permissionKey: string;
  effect: string;
  /** What the role alone says, before anything set for this person. */
  allowed: boolean;
  areaHeading: boolean;
  roleName: string;
  onChange: (effect: string) => void;
}) {
  const effectiveAllowed = effect === "GRANT" || (effect !== "DENY" && allowed);
  const redundant = isRedundant(effect, allowed);
  const Glyph = actionIcon(permissionActionOf(permissionKey));

  return (
    <>
      {areaHeading && (
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableCell colSpan={4} className="whitespace-normal font-medium">
            {permissionAreaLabel(permissionAreaOf(permissionKey))}
          </TableCell>
        </TableRow>
      )}
      <TableRow className={effect !== "none" ? "bg-primary/5" : undefined}>
        <TableCell
          title={permissionKey}
          className="whitespace-normal break-words"
        >
          <span className="flex items-start gap-2">
            <Glyph
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0">
              {permissionLabel(permissionKey)}
              {redundant && (
                <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                  <IconAlertTriangle
                    size={12}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  {redundantNote(roleName, allowed)}
                </span>
              )}
            </span>
          </span>
        </TableCell>
        <TableCell className="text-center">
          <YesNo
            allowed={allowed}
            what={
              roleName
                ? `The ${roleName} role gives this`
                : "Their role gives this"
            }
          />
        </TableCell>
        <TableCell>
          <Select value={effect} onValueChange={onChange}>
            <SelectTrigger
              aria-label={`${permissionLabel(permissionKey)} for this person`}
              className="w-full min-w-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* The default has to read as "I'm not touching this". A bare
                  role name ("Same as Employee") reads like a person. */}
              <SelectItem value="none">
                {roleName ? `Use the ${roleName} role` : "Use their role"}
              </SelectItem>
              <SelectItem value="GRANT">Always allow</SelectItem>
              <SelectItem value="DENY">Always block</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-center">
          <YesNo allowed={effectiveAllowed} what="They can do this" />
        </TableCell>
      </TableRow>
    </>
  );
}

/** One thing already changed for this person, listed above the table. */
function OverrideChip({
  permissionKey,
  effect,
  roleAllowed,
  roleName,
  onRemove,
}: {
  permissionKey: string;
  effect: "GRANT" | "DENY";
  roleAllowed: boolean | undefined;
  roleName: string;
  onRemove: () => void;
}) {
  const redundant = isRedundant(effect, roleAllowed);
  return (
    <div className="flex items-start justify-between gap-2 rounded-sm bg-primary/5 p-2 text-sm">
      <div className="min-w-0 break-words">
        <span title={permissionKey}>{permissionLabel(permissionKey)}</span>
        {" — "}
        <span className="font-medium">
          {effect === "GRANT" ? "always allowed" : "always blocked"}
        </span>
        <p className="text-xs text-muted-foreground">
          {permissionAreaLabel(permissionAreaOf(permissionKey))}
        </p>
        {/* Short, because the banner above already explains why. This only
            has to mark which ones it meant. */}
        {redundant && roleAllowed !== undefined && (
          <p
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
            title={redundantNote(roleName, roleAllowed)}
          >
            <IconAlertTriangle size={12} aria-hidden="true" />
            Does nothing
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={
          roleName
            ? `Go back to what the ${roleName} role gives`
            : "Go back to what their role gives"
        }
        aria-label={`Undo the change to ${permissionLabel(permissionKey)}`}
        onClick={onRemove}
      >
        Undo
      </Button>
    </div>
  );
}
