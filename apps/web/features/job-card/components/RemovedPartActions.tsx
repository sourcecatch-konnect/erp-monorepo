"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@skerp/ui/components/dialog";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import {
  jobCardApi,
  type JobCardRemovedPart,
  type RemovedPartAction,
} from "../api/job-card.service";

const labels: Record<RemovedPartAction, string> = {
  SEND_REPAIR: "Dispatch for repair",
  RECEIVE_REPAIR: "Receive repaired part",
  SUBMIT_VALUATION: "Submit valuation",
  APPROVE_STOCK: "Approve value and stock",
  REJECT: "Reject proposal",
  DECLARE_SCRAP: "Declare scrap",
  REQUEST_DISPOSAL: "Request disposal",
  APPROVE_DISPOSAL: "Confirm disposal",
};

export function RemovedPartActions({
  jobCardId,
  part,
}: {
  jobCardId: string;
  part: JobCardRemovedPart;
}) {
  const manage = useCan(PERMS.WORKSHOP.JOBCARD_MANAGE);
  const approve = useCan(PERMS.WORKSHOP.JOBCARD_RETURN_APPROVE);
  const client = useQueryClient();
  const [action, setAction] = React.useState<RemovedPartAction | null>(null);
  const [reason, setReason] = React.useState("");
  const [evidence, setEvidence] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [value, setValue] = React.useState("");
  const requestId = React.useRef("");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [historySize, setHistorySize] = React.useState(10);
  const debounced = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([part.id, debounced, historySize]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const history = useQuery({
    queryKey: [
      "job-card",
      "return-history",
      part.id,
      page,
      historySize,
      debounced,
    ],
    queryFn: ({ signal }) =>
      jobCardApi.removedPartEvents(
        jobCardId,
        part.id,
        { page, size: historySize, search: debounced || undefined },
        signal,
      ),
    enabled: historyOpen,
  });
  const valued =
    action !== null &&
    ["RECEIVE_REPAIR", "SUBMIT_VALUATION", "APPROVE_STOCK"].includes(action);
  const valid =
    reason.trim() &&
    evidence.trim() &&
    location.trim() &&
    (!valued || Number(value) > 0);
  const mutation = useMutation({
    mutationFn: () =>
      jobCardApi.removedPartAction(jobCardId, part.id, {
        clientRequestId: requestId.current,
        action: action!,
        version: part.version,
        reason: reason.trim(),
        evidence: evidence.trim(),
        custodyLocation: location.trim(),
        unitCostPaise: valued
          ? String(rupeesToPaise(Number(value)))
          : undefined,
      }),
    onSuccess: async () => {
      setAction(null);
      toast.success("Removed-part lifecycle updated");
      await Promise.all(
        ["job-card", "stock", "ledger"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update removed part",
      ),
  });
  const actions: RemovedPartAction[] = [];
  if (manage && part.lifecycleStatus === "HELD") {
    if (part.condition === "REPAIRABLE") actions.push("SEND_REPAIR");
    if (part.condition === "REUSABLE" || part.repairReceivedAt)
      actions.push("SUBMIT_VALUATION");
    actions.push(
      part.condition === "SCRAP" ? "REQUEST_DISPOSAL" : "DECLARE_SCRAP",
    );
  }
  if (manage && part.lifecycleStatus === "IN_REPAIR")
    actions.push("RECEIVE_REPAIR", "DECLARE_SCRAP");
  if (manage && part.lifecycleStatus === "SCRAP_HELD")
    actions.push("REQUEST_DISPOSAL");
  if (approve && part.lifecycleStatus === "PENDING_APPROVAL")
    actions.push("APPROVE_STOCK", "REJECT");
  if (approve && part.lifecycleStatus === "DISPOSAL_PENDING")
    actions.push("APPROVE_DISPOSAL", "REJECT");
  const open = (next: RemovedPartAction) => {
    requestId.current = crypto.randomUUID();
    setReason("");
    setEvidence("");
    setLocation(part.custodyLocation ?? "");
    setValue(
      part.unitCostPaise ? String(Number(part.unitCostPaise) / 100) : "",
    );
    setAction(next);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((next) => (
        <Button
          variant="outline"
          size="sm"
          key={next}
          onClick={() => open(next)}
        >
          {labels[next]}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
        History
      </Button>
      <Dialog
        open={action !== null}
        onOpenChange={(next) => {
          if (!next && !mutation.isPending) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action ? labels[action] : "Removed part"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action covers all {part.qty} units. Stock approval and disposal
            confirmation require a person other than the recorder and submitter.
            Disposal evidence must confirm the handover; sale proceeds and
            repair charges use their normal finance documents.
          </p>
          <label className="text-sm">
            Custody location / handover destination
            <Input
              value={location}
              maxLength={200}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <label className="text-sm">
            Inspection, repair receipt or disposal evidence reference
            <Input
              value={evidence}
              maxLength={500}
              onChange={(event) => setEvidence(event.target.value)}
            />
          </label>
          {valued && (
            <label className="text-sm">
              Recoverable value per unit (₹)
              <Input
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Confirm the supported recoverable value; the replacement issue
                cost is only a proposal.
              </p>
            </label>
          )}
          <Textarea
            aria-label="Lifecycle reason"
            placeholder="Reason"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Back
            </Button>
            <Button
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Removed-part history</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Search lifecycle history"
            placeholder="Search action or reason..."
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {history.isLoading && <p>Loading history...</p>}
          {history.isError && (
            <Button variant="outline" onClick={() => void history.refetch()}>
              Retry history
            </Button>
          )}
          {history.data?.data.map((event) => (
            <div
              key={event.id}
              className="space-y-1 rounded border p-3 text-sm"
            >
              <p className="font-medium">
                {labels[event.action as RemovedPartAction] ??
                  event.action.replaceAll("_", " ")}
              </p>
              <p>
                {event.fromStatus?.replaceAll("_", " ")} →{" "}
                {event.toStatus.replaceAll("_", " ")}
              </p>
              <p>{event.reason}</p>
              <p>{event.details.evidence}</p>
              <p>{event.details.custodyLocation}</p>
              {event.details.unitCostPaise && (
                <p>
                  Value per unit: {formatPaise(event.details.unitCostPaise)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {event.actorName ?? event.actorId} ·{" "}
                {new Date(event.createdAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </p>
            </div>
          ))}
          {history.data && (
            <TablePaginationFooter
              page={page}
              size={historySize}
              total={history.data.meta?.total ?? 0}
              onPageChange={(next) => setPaging({ key, page: next })}
              onSizeChange={setHistorySize}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
