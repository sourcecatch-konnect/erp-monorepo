"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { RolePageQuery } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  TableEmptyState,
  TablePaginationFooter,
  TableSearchInput,
} from "@/components/data-table";
import { NewRoleDialog } from "./NewRoleDialog";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import type { RoleSummary } from "./types";

const COLUMN_COUNT = 5;

export function RolesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const pageParams: RolePageQuery = {
    page,
    size,
    search: debouncedSearch.trim() || undefined,
  };

  const rolesQuery = useQuery({
    queryKey: rbacKeys.rolesPage(pageParams),
    queryFn: ({ signal }) => rbacApi.rolesPage(pageParams, signal),
    // Keeps the footer's total steady while the next page loads; the rows
    // still switch to skeletons until the database returns them.
    placeholderData: keepPreviousData,
  });
  const roles = rolesQuery.data?.items ?? [];
  const total = rolesQuery.data?.total ?? 0;
  const loadingRows = rolesQuery.isPending || rolesQuery.isPlaceholderData;

  // Deleting the last role on the last page would leave an empty page.
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  useEffect(() => {
    if (
      rolesQuery.isSuccess &&
      !rolesQuery.isPlaceholderData &&
      page > lastPage
    )
      setPage(lastPage);
  }, [rolesQuery.isSuccess, rolesQuery.isPlaceholderData, page, lastPage]);

  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<RoleSummary | null>(null);
  const [name, setName] = useState("");

  const copyMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      rbacApi.copyRole(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.roles });
      setCopySource(null);
      setName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: rbacApi.deleteRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.roles }),
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Manage roles and their permission sets.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New role</Button>
      </header>

      <TableSearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search roles, e.g. Accounts"
      />

      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Type</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolesQuery.isError ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-8">
                  <div role="alert" className="space-y-3 text-sm">
                    <p>Couldn&apos;t load roles. Try again.</p>
                    <Button
                      variant="outline"
                      onClick={() => void rolesQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loadingRows ? (
              Array.from({ length: roles.length || 5 }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }, (__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : roles.length === 0 ? (
              <TableEmptyState
                colSpan={COLUMN_COUNT}
                message={
                  pageParams.search
                    ? `No roles match "${pageParams.search}".`
                    : "No roles yet."
                }
                description={
                  pageParams.search
                    ? "Try a shorter name, like part of the role name."
                    : "Create a role to decide what people can do."
                }
                action={
                  pageParams.search ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setPage(0);
                      }}
                    >
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link
                      className="hover:underline"
                      href={`/settings/roles/${r.id}`}
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r._count.users}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r._count.rolePermissions}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.isSystem ? "System" : "Custom"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/settings/roles/${r.id}`}>Edit</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCopySource(r);
                          setName(`${r.name} (copy)`);
                        }}
                      >
                        Copy
                      </Button>
                      {!r.isSystem && r._count.users === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete role "${r.name}"?`)) {
                              deleteMut.mutate(r.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!rolesQuery.isError && total > 0 && (
          <TablePaginationFooter
            total={total}
            page={page}
            size={size}
            onPageChange={setPage}
            onSizeChange={(next) => {
              setSize(next);
              setPage(0);
            }}
          />
        )}
      </div>

      <NewRoleDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog
        open={!!copySource}
        onOpenChange={(o) => !o && setCopySource(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy role &quot;{copySource?.name}&quot;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Creates a new role with the same permission set. You can edit it
            after.
          </p>
          <Input
            placeholder="New role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopySource(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                copySource &&
                copyMut.mutate({ id: copySource.id, name: name.trim() })
              }
              disabled={name.trim().length < 2 || copyMut.isPending}
            >
              {copyMut.isPending ? "Copying…" : "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
