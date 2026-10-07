"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UserAccessPageQuery } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  TableEmptyState,
  TablePaginationFooter,
  TableSearchInput,
} from "@/components/data-table";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import { UserAccessDrawer } from "./UserAccessDrawer";
import type { UserSummary } from "./types";

const COLUMN_COUNT = 6;

export function UsersAccessPage() {
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const pageParams: UserAccessPageQuery = {
    page,
    size,
    search: debouncedSearch.trim() || undefined,
  };

  const usersQuery = useQuery({
    queryKey: rbacKeys.usersPage(pageParams),
    queryFn: ({ signal }) => rbacApi.usersPage(pageParams, signal),
    // Keeps the footer's total steady while the next page loads; the rows
    // still switch to skeletons until the database returns them.
    placeholderData: keepPreviousData,
  });
  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const loadingRows = usersQuery.isPending || usersQuery.isPlaceholderData;

  // Saving access can move someone out of the current role search; don't
  // leave the table on a page that no longer exists.
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  useEffect(() => {
    if (usersQuery.isSuccess && !usersQuery.isPlaceholderData && page > lastPage)
      setPage(lastPage);
  }, [usersQuery.isSuccess, usersQuery.isPlaceholderData, page, lastPage]);

  const { data: roles } = useQuery({
    queryKey: rbacKeys.roles,
    queryFn: rbacApi.listRoles,
    staleTime: 10 * 60 * 1000,
  });

  const { data: branches } = useQuery({
    queryKey: rbacKeys.branches,
    queryFn: rbacApi.branches,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">User access</h1>
        <p className="text-sm text-muted-foreground">
          Choose what each person can do and which branches they work in.
        </p>
      </header>

      <TableSearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search by role, e.g. Accounts"
      />

      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isError ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-8">
                  <div role="alert" className="space-y-3 text-sm">
                    <p>Couldn&apos;t load users. Try again.</p>
                    <Button
                      variant="outline"
                      onClick={() => void usersQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loadingRows ? (
              Array.from({ length: users.length || 5 }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }, (__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableEmptyState
                colSpan={COLUMN_COUNT}
                message={
                  pageParams.search
                    ? `No users have a role matching "${pageParams.search}".`
                    : "No users."
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
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    {[u.firstName, u.middleName, u.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.role?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.branchScope === "ALL"
                      ? "All branches"
                      : `${u.userBranches.length || 0} branch${u.userBranches.length === 1 ? "" : "es"}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.status ? "Active" : "Inactive"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(u)}
                    >
                      Edit access
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!usersQuery.isError && total > 0 && (
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

      {selected && (
        <UserAccessDrawer
          userId={selected.id}
          roles={roles ?? []}
          branches={branches ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
