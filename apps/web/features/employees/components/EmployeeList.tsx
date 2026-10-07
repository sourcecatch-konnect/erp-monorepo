"use client";

import { useEffect, useState } from "react";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconKey,
  IconTrash,
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
import type {
  EmployeeCredentials,
  EmployeeDialogTarget,
  EmployeeListRow,
} from "../types";
import { CreateEmployeeDialog } from "./CreateEmployeeDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { CredentialsDialog } from "./CredentialsDialog";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";

const COLUMN_COUNT = 6;

const nameOf = (e: EmployeeListRow) =>
  [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");

/** User management screen - list, create, view/edit, reset password, activate/deactivate, delete. */
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
  const [detailTarget, setDetailTarget] = useState<EmployeeDialogTarget | null>(
    null,
  );
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">
            Create users, assign roles, and manage passwords.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create user</Button>
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
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Active</TableHead>
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
                    {Array.from({ length: COLUMN_COUNT }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
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
                      <TableCell className="font-medium text-foreground">
                        <button
                          type="button"
                          className="text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() =>
                            setDetailTarget({ id: emp.id, mode: "view" })
                          }
                        >
                          {name}
                          {isMe ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              (you)
                            </span>
                          ) : null}
                        </button>
                      </TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.role.name}</TableCell>
                      <TableCell>{emp.branch.name}</TableCell>
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
                              onClick={() =>
                                setDetailTarget({ id: emp.id, mode: "view" })
                              }
                            >
                              <IconEye size={16} />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDetailTarget({ id: emp.id, mode: "edit" })
                              }
                            >
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
      <EmployeeDetailDialog
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
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
