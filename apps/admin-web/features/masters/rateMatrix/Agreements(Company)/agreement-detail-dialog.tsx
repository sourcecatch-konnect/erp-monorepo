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
import { IconFileDescription } from "@tabler/icons-react";


import { AgreementInfoItem } from "./agreement-info-item";
import { formatDate } from "./agreement.util";

type AgreementDetailsDialogProps = {
  open: boolean;
  agreement: AgreementWithRelations | null;
  onOpenChange: (open: boolean) => void;
};

export function AgreementDetailsDialog({
  open,
  agreement,
  onOpenChange,
}: AgreementDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="border-b bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <IconFileDescription className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <DialogTitle className="text-xl">
                  Agreement Details
                </DialogTitle>

                <DialogDescription className="mt-1">
                  Complete information for the selected company agreement.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {agreement ? (
          <div className="space-y-5 px-6 py-5">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company
              </p>

              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                {agreement.company?.name ?? "-"}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Consigner:{" "}
                <span className="font-medium text-slate-800">
                  {agreement.client?.name ?? "-"}
                </span>
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <AgreementInfoItem
                label="City"
                value={agreement.city?.name}
              />

              <AgreementInfoItem
                label="Branch"
                value={agreement.branch?.name}
              />

              <AgreementInfoItem
                label="Start Date"
                value={formatDate(agreement.startDate)}
              />

              <AgreementInfoItem
                label="Agreement Date"
                value={formatDate(agreement.agreementDate)}
              />

              <AgreementInfoItem
                label="Expiry Date"
                value={formatDate(agreement.expiryDate)}
              />

        
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t bg-slate-50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}