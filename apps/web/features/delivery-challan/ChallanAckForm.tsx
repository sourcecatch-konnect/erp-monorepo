"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { upsertDeliveryChallanAckSchema } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import {
  challanAckApi,
  challanAckKeys,
  type ChallanAckView,
  type UpsertAckBody,
} from "./ack.service";

/**
 * Enter or amend the broker's claim for a delivery challan.
 *
 * The broker has no ERP login: he sends a bill and an email, and staff
 * transcribe it here. Everything on this form is *his* account — SK's own
 * side is the challan's Labour supervisor and the LR dates, neither of
 * which is entered here.
 *
 * Money is typed in rupees because that is what the broker's bill says;
 * it is converted to paise before validation, so the shared schema from
 * `@skerp/validators` stays the one authority on the field rules (the same
 * schema the server parses with).
 */

/** Rupees as typed → paise as stored. Blank stays blank: "not claimed" and
 *  "claimed nil" are different, and the schema keeps them apart. */
const toPaise = (rupees: string): string | null => {
  const trimmed = rupees.trim();
  if (!trimmed) return null;
  return String(Math.round(Number(trimmed) * 100));
};

/** Paise as stored → rupees for the input, so reopening shows what was typed. */
const toRupees = (paise: string | null | undefined): string =>
  paise === null || paise === undefined ? "" : String(Number(paise) / 100);

/** An ISO timestamp → the yyyy-mm-dd a date input wants. */
const toDateInput = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "";

const MONEY_FIELDS = [
  { key: "claimedDetentionPaise", label: "Detention amount" },
  { key: "parkingPaise", label: "Parking" },
  { key: "labourPaise", label: "Labour" },
  { key: "otherPaise", label: "Other expenses" },
  { key: "damagePaise", label: "Damage" },
] as const;

type MoneyKey = (typeof MONEY_FIELDS)[number]["key"];

type LineRow = {
  challanItemId: string;
  lrNumberSnapshot: string;
  totalQty: number;
  receivedQty: string;
  damageQty: string;
};

export function ChallanAckForm({
  challanId,
  view,
  open,
  onOpenChange,
}: {
  challanId: string;
  view: ChallanAckView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const existing = view.broker;

  const [reportingDate, setReportingDate] = React.useState("");
  const [unloadingDate, setUnloadingDate] = React.useState("");
  const [collectionDate, setCollectionDate] = React.useState("");
  const [detentionDays, setDetentionDays] = React.useState("");
  const [money, setMoney] = React.useState<Record<MoneyKey, string>>({
    claimedDetentionPaise: "",
    parkingPaise: "",
    labourPaise: "",
    otherPaise: "",
    damagePaise: "",
  });
  const [remarks, setRemarks] = React.useState("");
  const [lines, setLines] = React.useState<LineRow[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Reset from the server's copy every time the dialog opens, so an
  // abandoned edit never leaks into the next one.
  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setReportingDate(toDateInput(existing?.reportingDate));
    setUnloadingDate(toDateInput(existing?.unloadingDate));
    setCollectionDate(toDateInput(existing?.collectionDate));
    setDetentionDays(
      existing?.claimedDetentionDays === null ||
        existing?.claimedDetentionDays === undefined
        ? ""
        : String(existing.claimedDetentionDays),
    );
    setMoney({
      claimedDetentionPaise: toRupees(existing?.claimedDetentionPaise),
      parkingPaise: toRupees(existing?.parkingPaise),
      labourPaise: toRupees(existing?.labourPaise),
      otherPaise: toRupees(existing?.otherPaise),
      damagePaise: toRupees(existing?.damagePaise),
    });
    setRemarks(existing?.remarks ?? "");
    setLines(
      view.lines.map((line) => {
        const filed = existing?.items.find(
          (item) => item.challanItemId === line.id,
        );
        return {
          challanItemId: line.id,
          lrNumberSnapshot: line.lrNumberSnapshot,
          totalQty: filed?.totalQty ?? line.quantity,
          receivedQty: String(filed?.receivedQty ?? line.quantity),
          damageQty: String(filed?.damageQty ?? 0),
        };
      }),
    );
  }, [open, existing, view.lines]);

  const save = useMutation({
    mutationFn: (body: UpsertAckBody) => challanAckApi.upsert(challanId, body),
    onSuccess: () => {
      toast.success(
        existing ? "Broker's claim updated" : "Broker's claim recorded",
      );
      void queryClient.invalidateQueries({
        queryKey: challanAckKeys.view(challanId),
      });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the broker's claim",
      ),
  });

  const setLine = (index: number, patch: Partial<LineRow>) =>
    setLines((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const body: UpsertAckBody = {
      reportingDate: reportingDate || null,
      unloadingDate: unloadingDate || null,
      collectionDate: collectionDate || null,
      claimedDetentionDays: detentionDays.trim()
        ? Number(detentionDays)
        : null,
      claimedDetentionPaise: toPaise(money.claimedDetentionPaise),
      parkingPaise: toPaise(money.parkingPaise),
      labourPaise: toPaise(money.labourPaise),
      otherPaise: toPaise(money.otherPaise),
      damagePaise: toPaise(money.damagePaise),
      remarks: remarks.trim() || null,
      items: lines.map((line) => ({
        challanItemId: line.challanItemId,
        totalQty: line.totalQty,
        receivedQty: Number(line.receivedQty || 0),
        damageQty: Number(line.damageQty || 0),
      })),
      version: existing?.version,
    };

    // The shared schema is the authority — the same one the server parses
    // with — so the two cannot drift.
    const parsed = upsertDeliveryChallanAckSchema.safeParse(body);
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        flat[issue.path.join(".")] = issue.message;
      }
      setErrors(flat);
      toast.error("Check the highlighted fields");
      return;
    }

    setErrors({});
    save.mutate(body);
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="mt-1 text-xs text-destructive">{errors[key]}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Amend the broker's claim" : "Enter the broker's claim"}
          </DialogTitle>
          <DialogDescription>
            Transcribe what the broker sent on his bill or by email for challan{" "}
            {view.challanNumber}. He is paid the lower of his claim and his
            detention slab, so a figure here is a request, not a commitment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <section className="space-y-3">
            <p className="text-sm font-medium">Dates</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="ack-reporting">Reporting date</Label>
                <Input
                  id="ack-reporting"
                  type="date"
                  value={reportingDate}
                  onChange={(e) => setReportingDate(e.target.value)}
                />
                {fieldError("reportingDate")}
              </div>
              <div>
                <Label htmlFor="ack-unloading">Unloading date</Label>
                <Input
                  id="ack-unloading"
                  type="date"
                  value={unloadingDate}
                  onChange={(e) => setUnloadingDate(e.target.value)}
                />
                {fieldError("unloadingDate")}
              </div>
              <div>
                <Label htmlFor="ack-collection">Collection date</Label>
                <Input
                  id="ack-collection"
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                />
                {fieldError("collectionDate")}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Once this claim is approved, these dates — not the LR-derived
              ones — drive the detention window.
            </p>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">Claimed amounts</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="ack-detention-days">Detention days</Label>
                <Input
                  id="ack-detention-days"
                  type="number"
                  min={0}
                  step={1}
                  value={detentionDays}
                  onChange={(e) => setDetentionDays(e.target.value)}
                />
                {fieldError("claimedDetentionDays")}
              </div>
              {MONEY_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`ack-${field.key}`}>{field.label} (₹)</Label>
                  <Input
                    id={`ack-${field.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={money[field.key]}
                    onChange={(e) =>
                      setMoney((m) => ({ ...m, [field.key]: e.target.value }))
                    }
                  />
                  {fieldError(field.key)}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">Quantities per LR</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LR</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => {
                  const shortage = Math.max(
                    line.totalQty - Number(line.receivedQty || 0),
                    0,
                  );
                  return (
                    <TableRow key={line.challanItemId}>
                      <TableCell>{line.lrNumberSnapshot}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.totalQty}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          className="ml-auto h-8 w-24 text-right"
                          value={line.receivedQty}
                          onChange={(e) =>
                            setLine(index, { receivedQty: e.target.value })
                          }
                        />
                        {fieldError(`items.${index}.receivedQty`)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          className="ml-auto h-8 w-24 text-right"
                          value={line.damageQty}
                          onChange={(e) =>
                            setLine(index, { damageQty: e.target.value })
                          }
                        />
                        {fieldError(`items.${index}.damageQty`)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {shortage}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Shortage is derived as sent minus received — it is never typed,
              so it cannot drift from the quantities it comes from.
            </p>
          </section>

          <section>
            <Label htmlFor="ack-remarks">Remarks</Label>
            <Textarea
              id="ack-remarks"
              rows={2}
              maxLength={500}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Anything the broker noted on his bill"
            />
            {fieldError("remarks")}
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {existing ? "Save changes" : "Record claim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
