"use client";

import type { AgreementWithRelations } from "@skerp/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { Button } from "@skerp/ui/components/button";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";

type AgreementDeleteDialogProps = {
  open: boolean;
  agreement: AgreementWithRelations | null;
  isDeleting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function AgreementDeleteDialog({
  open,
  agreement,
  isDeleting = false,
  onOpenChange,
  onConfirm,
}: AgreementDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="border-b bg-red-50 px-6 py-5">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-red-200 bg-white p-2 text-red-600 shadow-sm">
                <IconAlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <DialogTitle className="text-xl text-red-950">
                  Delete Agreement?
                </DialogTitle>

                <DialogDescription className="mt-1 text-red-700">
                  This action cannot be undone. The selected agreement will be
                  permanently deleted.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Selected Agreement
            </p>

            <p className="mt-1 text-sm font-semibold text-red-950">
              {agreement?.company?.name ?? "-"}
            </p>

            <p className="mt-1 text-sm text-red-700">
              Consigner: {agreement?.client?.name ?? "-"}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t bg-slate-50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="gap-2"
          >
            <IconTrash className="h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete Agreement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}