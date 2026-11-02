"use client";

import { useEffect, useState } from "react";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconKey,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";
import type { EmployeePageQuery } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { Switch } from "@skerp/ui/components/switch";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { useAuth } from "@/features/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  TableEmptyState,
  TablePaginationFooter,
  TableSearchInput,
} from "@/components/data-table";
import {
  useDeleteEmployee,
  useEmployeesPage,
  useSetEmployeeStatus,
} from "../hooks/useEmployees";
import type { EmployeeCredentials, EmployeeListRow } from "../types";
import { CreateEmployeeDialog } from "./CreateEmployeeDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { CredentialsDialog } from "./CredentialsDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
import { EmployeeDetailSheet } from "./EmployeeDetailSheet";
import { RoleChip, UserAvatar, nameOf } from "./employee.ui";

const COLUMN_COUNT = 5;

/** User management screen — list, create, view, edit, reset password, activate, delete. */
export function EmployeeList() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const pageParams: EmployeePageQuery = {
    page,
    size,
    search: debouncedSearch.trim() || undefined,
  };
  const employeesQuery = useEmployeesPage(pageParams);
  const employees = employeesQuery.data?.items ?? [];
  const total = employeesQuery.data?.total ?? 0;
  const loadingRows =
    employeesQuery.isPending || employeesQuery.isPlaceholderData;

  // Deleting the last user on the last page would leave an empty page.
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  useEffect(() => {
    if (
      employeesQuery.isSuccess &&
      !employeesQuery.isPlaceholderData &&
      page > lastPage
    )
      setPage(lastPage);
  }, [
    employeesQuery.isSuccess,
    employeesQuery.isPlaceholderData,
    page,
    lastPage,
  ]);

  const statusMutation = useSetEmployeeStatus();
  const deleteMutation = useDeleteEmployee();

  const [createOpen, setCreateOpen] = useState(false);
  // Viewing and editing are separate surfaces, so they are separate state:
  // a read-only sheet and a form dialog, never the same component in a mode.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<EmployeeListRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListRow | null>(
    null,
  );
  const [credentials, setCredentials] = useState<EmployeeCredentials | null>(
    null,
  );

  const setStatus = (emp: EmployeeListRow, status: boolean) =>
    statusMutation.mutate(
      { id: emp.id, status },
      {
        onSuccess: () =>
          toast.success(
            status
              ? `${nameOf(emp)} can sign in again`
              : `${nameOf(emp)} has been deactivated`,
          ),
        onError: (err) => toast.error(err.message),
      },
    );

  const closeDelete = () => {
    if (deleteMutation.isPending) return;
    setDeleteTarget(null);
    deleteMutation.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Users
            </h1>
            {/* The count answers "how many people have logins?" without
                anyone having to page to the end of the table. */}
            {employeesQuery.isSuccess ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                <IconUsers className="size-3.5" aria-hidden />
                {total}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Create users, assign roles, and manage passwords.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus className="size-4" aria-hidden />
          Create user
        </Button>
      </div>

      <TableSearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search by name or email"
      />

      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="w-28">Can sign in</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="py-8">
                    <div role="alert" className="space-y-3 text-sm">
                      <p>Couldn&apos;t load users. Try again.</p>
                      <Button
                        variant="outline"
                        onClick={() => void employeesQuery.refetch()}
                      >
                        Try again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : loadingRows ? (
                Array.from({ length: employees.length || 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-9" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableEmptyState
                  colSpan={COLUMN_COUNT}
                  message={
                    pageParams.search
                      ? `No users match "${pageParams.search}".`
                      : "No users yet."
                  }
                  description={
                    pageParams.search
                      ? "Try part of their name or email."
                      : "Create the first one with Create user."
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
                employees.map((emp) => {
                  const isMe = emp.id === me?.id;
                  const name = nameOf(emp);
                  return (
                    <TableRow key={emp.id}>
                      {/* Name and email in one cell: they are one identity,
                          and splitting them cost a column that made every
                          row wrap on a laptop screen. */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar employee={emp} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-full truncate text-left text-sm font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              onClick={() => setDetailId(emp.id)}
                            >
                              {name}
                              {isMe ? (
                                <span className="font-normal text-muted-foreground">
                                  {" "}
                                  (you)
                                </span>
                              ) : null}
                            </button>
                            <p className="truncate text-xs text-muted-foreground">
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleChip name={emp.role.name} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {emp.branch.name}
                      </TableCell>
                      <TableCell>
                        <Switch
                          aria-label={`${name} can sign in`}
                          title={
                            isMe
                              ? "You can't deactivate your own account"
                              : undefined
                          }
                          checked={emp.status}
                          disabled={
                            isMe ||
                            (statusMutation.isPending &&
                              statusMutation.variables?.id === emp.id)
                          }
                          onCheckedChange={(value) => setStatus(emp, value)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              aria-label={`Actions for ${name}`}
                            >
                              <IconDotsVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDetailId(emp.id)}
                            >
                              <IconEye size={16} />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditId(emp.id)}>
                              <IconEdit size={16} />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setResetTarget(emp)}
                            >
                              <IconKey size={16} />
                              Reset password
                            </DropdownMenuItem>
                            {!isMe && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(emp)}
                                >
                                  <IconTrash size={16} />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!employeesQuery.isError && total > 0 && (
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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) closeDelete();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget ? nameOf(deleteTarget) : "user"}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes their account. Anyone who has created,
              approved or changed records can&apos;t be deleted. Deactivate them
              instead so they can&apos;t sign in.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p
              role="alert"
              className="rounded-sm border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
            >
              {deleteMutation.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={closeDelete}
            >
              Cancel
            </Button>
            {deleteMutation.isError && deleteTarget?.status ? (
              <Button
                disabled={statusMutation.isPending}
                onClick={() => {
                  setStatus(deleteTarget, false);
                  closeDelete();
                }}
              >
                Deactivate instead
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending || deleteMutation.isError}
                onClick={() =>
                  deleteTarget &&
                  deleteMutation.mutate(deleteTarget.id, {
                    onSuccess: () => {
                      toast.success(`${nameOf(deleteTarget)} deleted`);
                      setDeleteTarget(null);
                      deleteMutation.reset();
                    },
                  })
                }
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete user"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setCredentials}
      />
      <EmployeeDetailSheet
        employeeId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => {
          // Hand over to the form: one surface on screen at a time.
          setDetailId(null);
          setEditId(id);
        }}
        onResetPassword={(id) => {
          const row = employees.find((emp) => emp.id === id);
          if (!row) return;
          setDetailId(null);
          setResetTarget(row);
        }}
      />
      <EditEmployeeDialog employeeId={editId} onClose={() => setEditId(null)} />
      <ResetPasswordDialog
        employee={resetTarget}
        onClose={() => setResetTarget(null)}
        onReset={setCredentials}
      />
      <CredentialsDialog
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />
    </div>
  );
}
