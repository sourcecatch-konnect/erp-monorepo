"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import { UserAccessDrawer } from "./UserAccessDrawer";
import type { UserSummary } from "./types";

const COLUMN_COUNT = 6;

export function UsersAccessPage() {
  const [selected, setSelected] = useState<UserSummary | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: rbacKeys.users,
    queryFn: rbacApi.listUsers,
  });
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
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && users?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMN_COUNT}
                className="py-8 text-center text-muted-foreground"
              >
                No users.
              </TableCell>
            </TableRow>
          )}

          {users?.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                {[u.firstName, u.middleName, u.lastName]
                  .filter(Boolean)
                  .join(" ")}
              </TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
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
          ))}
        </TableBody>
      </Table>

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
