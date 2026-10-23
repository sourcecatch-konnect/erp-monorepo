"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import type { EmployeeCredentials } from "../types";

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-muted px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigator.clipboard?.writeText(value)}
      >
        Copy
      </Button>
    </div>
  );
}

/** Shows an employee's credentials after a create or password reset. */
export function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: EmployeeCredentials | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(credentials)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login credentials</DialogTitle>
          <DialogDescription>
            {credentials?.emailSent
              ? "These credentials were emailed to the employee. You can also share them directly."
              : "Email delivery is not configured on the server — share these credentials with the employee directly."}
          </DialogDescription>
        </DialogHeader>

        {credentials && (
          <div className="space-y-2">
            <CopyRow label="Employee" value={credentials.name} />
            <CopyRow label="Email" value={credentials.email} />
            <CopyRow label="Password" value={credentials.password} />
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
