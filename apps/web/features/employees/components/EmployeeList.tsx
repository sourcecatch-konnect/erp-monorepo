"use client";

import { useState } from "react";
import { Button } from "@skerp/ui/components/button";
import { Switch } from "@skerp/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  useEmployees,
  useSetEmployeeStatus,
} from "../hooks/useEmployees";
import type { Employee, EmployeeCredentials } from "../types";
import { CreateEmployeeDialog } from "./CreateEmployeeDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { CredentialsDialog } from "./CredentialsDialog";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";

/** Employee management screen — list, create, reset password, activate/deactivate. */
export function EmployeeList() {
  const { data: employees, isLoading, isError, error } = useEmployees();
  const statusMutation = useSetEmployeeStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Employee | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [credentials, setCredentials] =
    useState<EmployeeCredentials | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Employees
          </h1>
          <p className="text-sm text-muted-foreground">
            Create and manage employee accounts and passwords.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create employee</Button>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-destructive">
                  {(error as Error)?.message ?? "Failed to load employees"}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && employees?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No employees yet. Create the first one.
                </TableCell>
              </TableRow>
            )}
            {employees?.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium text-foreground">
                  <button
                    type="button"
                    className="text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => setDetailTarget(emp)}
                  >
                    {emp.firstName} {emp.lastName}
                  </button>
                </TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.branch.name}</TableCell>
                <TableCell>
                  <Switch
                    checked={emp.status}
                    disabled={statusMutation.isPending}
                    onCheckedChange={(value) =>
                      statusMutation.mutate({ id: emp.id, status: value })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetTarget(emp)}
                  >
                    Reset password
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setCredentials}
      />
      <EmployeeDetailDialog
        employee={detailTarget}
        onClose={() => setDetailTarget(null)}
        onUpdated={setDetailTarget}
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
