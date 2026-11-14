"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completedRepairSchema,
  repairInspectionSchema,
  repairReleaseSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import { toast } from "sonner";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  jobCardApi,
  type JobCard,
  type CompletedRepair,
  type RepairControlAction,
} from "../api/job-card.service";

const checks = ["brakes", "steering", "tyres", "lights", "leaks"] as const;
const emptyChecks = () => ({
  brakes: "",
  steering: "",
  tyres: "",
  lights: "",
  leaks: "",
  reference: "",
  notes: "",
});
export function RepairControlPanel({
  card,
  onCompletionChange,
}: {
  card?: JobCard;
  onCompletionChange?: (value: CompletedRepair | null) => void;
}) {
  const control = card?.repairControl;
  const canManage = useCan(PERMS.WORKSHOP.JOBCARD_MANAGE);
  const canRelease = useCan(PERMS.WORKSHOP.JOBCARD_FINALISE);
  const client = useQueryClient();
  const [reason, setReason] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [inspection, setInspection] = React.useState(emptyChecks);
  const [release, setRelease] = React.useState(emptyChecks);
  const [roadworthy, setRoadworthy] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [size, setSize] = React.useState(10);
  const debounced = useDebouncedValue(search.trim(), 400);
  const key = JSON.stringify([card?.id, debounced, size]);
  const [paging, setPaging] = React.useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  if (paging.key !== key) setPaging({ key, page: 0 });
  const request = React.useRef<{ payload: string; id: string } | null>(null);
  React.useEffect(() => {
    if (control) {
      setReason(control.maintenanceReason);
      setIntent(control.replacementIntent);
      setInspection(control.inspection);
      if (control.status === "IN_PROGRESS") {
        setRelease(emptyChecks());
        setRoadworthy(false);
      }
    }
  }, [control]);
  const parsed = React.useMemo(
    () =>
      completedRepairSchema.safeParse({
        maintenanceReason: reason,
        replacementIntent: intent,
        inspection,
        release: { ...release, roadworthyConfirmed: roadworthy },
      }),
    [reason, intent, inspection, release, roadworthy],
  );
  React.useEffect(() => {
    onCompletionChange?.(parsed.success ? parsed.data : null);
  }, [parsed, onCompletionChange]);
  const history = useQuery({
    queryKey: ["job-card", "repair-history", card?.id, page, size, debounced],
    queryFn: ({ signal }) =>
      jobCardApi.repairEvents(
        card!.id,
        { page, size, search: debounced || undefined },
        signal,
      ),
    enabled: Boolean(card) && historyOpen,
  });
  const mutation = useMutation({
    mutationFn: (action: RepairControlAction["action"]) => {
      const payload = {
        version: control?.version ?? 0,
        action,
        reason,
        replacementIntent: action === "START" ? intent : undefined,
        inspection:
          action === "START"
            ? repairInspectionSchema.parse(inspection)
            : undefined,
        release:
          action !== "START"
            ? repairReleaseSchema.parse({
                ...release,
                roadworthyConfirmed: roadworthy,
              })
            : undefined,
      };
      const signature = JSON.stringify(payload);
      // Keep the attempt ID after failure; a changed payload must be reconciled after an uncertain response.
      request.current ??= { payload: signature, id: crypto.randomUUID() };
      return jobCardApi.repairAction(card!.id, {
        ...payload,
        clientRequestId: request.current.id,
      });
    },
    onSuccess: async (updated) => {
      request.current = null;
      client.setQueryData(["job-card", "detail", updated.id], updated);
      toast.success("Repair controls updated");
      await Promise.all(
        ["job-card", "vehicle-journey", "vehicles", "trip"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update repair controls",
      ),
  });
  const editable = !card || card.status === "DRAFT";
  return (
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="font-semibold">Repair inspection and vehicle clearance</h2>
      <p className="text-sm text-muted-foreground">
        Draft planning has no vehicle hold. Starting work blocks new dispatch;
        clearance preserves any existing trip status. Every active repair on the
        vehicle must be cleared.
      </p>
      {control && (
        <p className="text-sm">
          Physical repair:{" "}
          <strong>{control.status.replaceAll("_", " ")}</strong> · Started{" "}
          {new Date(control.startedAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}
          {control.clearedAt && (
            <>
              {" "}
              · Cleared{" "}
              {new Date(control.clearedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
            </>
          )}
        </p>
      )}
      {editable ? (
        <>
          <label className="block text-sm">
            Maintenance reason / action reason
            <Textarea
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            Replacement intent (or state no replacement)
            <Textarea
              value={intent}
              maxLength={2000}
              onChange={(event) => setIntent(event.target.value)}
            />
          </label>
          {(
            [
              {
                label: "Initial inspection",
                values: inspection,
                set: setInspection,
                initial: true,
              },
              {
                label: "Clearance inspection",
                values: release,
                set: setRelease,
                initial: false,
              },
            ] as const
          ).map((group) => (
            <div className="space-y-2" key={group.label}>
              <h3 className="text-sm font-medium">{group.label}</h3>
              <div className="grid gap-2 sm:grid-cols-5">
                {checks.map((check) => (
                  <label key={check} className="text-sm capitalize">
                    {check}
                    <select
                      className="block h-9 w-full rounded-md border bg-background px-2"
                      value={group.values[check]}
                      onChange={(event) =>
                        group.set((old) => ({
                          ...old,
                          [check]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select...</option>
                      <option value="PASS">Pass</option>
                      {group.initial && (
                        <option value="ATTENTION">Needs attention</option>
                      )}
                      <option value="NA">Not applicable</option>
                    </select>
                  </label>
                ))}
              </div>
              <Input
                aria-label={`${group.label} reference`}
                placeholder="Technician / inspection reference"
                maxLength={200}
                value={group.values.reference}
                onChange={(event) =>
                  group.set((old) => ({
                    ...old,
                    reference: event.target.value,
                  }))
                }
              />
              <Textarea
                aria-label={`${group.label} findings`}
                placeholder="Findings / resolution notes (required for initial attention items)"
                value={group.values.notes}
                maxLength={2000}
                onChange={(event) =>
                  group.set((old) => ({ ...old, notes: event.target.value }))
                }
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roadworthy}
              onChange={(event) => setRoadworthy(event.target.checked)}
            />
            I confirm the vehicle is roadworthy and inspection findings are
            resolved.
          </label>
          {card && (
            <div className="flex flex-wrap gap-2">
              {control?.status !== "IN_PROGRESS" && canManage && (
                <Button
                  variant="outline"
                  disabled={
                    mutation.isPending ||
                    !reason.trim() ||
                    !intent.trim() ||
                    !repairInspectionSchema.safeParse(inspection).success
                  }
                  onClick={() => mutation.mutate("START")}
                >
                  Start physical repair / hold vehicle
                </Button>
              )}
              {control?.status === "IN_PROGRESS" && canRelease && (
                <>
                  <Button
                    disabled={
                      mutation.isPending ||
                      !reason.trim() ||
                      !repairReleaseSchema.safeParse({
                        ...release,
                        roadworthyConfirmed: roadworthy,
                      }).success
                    }
                    onClick={() => mutation.mutate("RELEASE")}
                  >
                    Record clearance
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      mutation.isPending ||
                      !reason.trim() ||
                      !repairReleaseSchema.safeParse({
                        ...release,
                        roadworthyConfirmed: roadworthy,
                      }).success
                    }
                    onClick={() => mutation.mutate("CANCEL")}
                  >
                    Cancel repair with clearance
                  </Button>
                </>
              )}
            </div>
          )}
          {!card && (
            <p className="text-xs text-muted-foreground">
              Save creates a planning draft. Direct create-and-finalise requires
              both inspections above; it records already completed work and
              preserves holds from other repairs.
            </p>
          )}
        </>
      ) : (
        control && (
          <div className="text-sm">
            <p>{control.maintenanceReason}</p>
            <p>Replacement intent: {control.replacementIntent}</p>
            <p>
              Initial inspection: {control.inspection.reference} ·{" "}
              {control.inspection.notes}
            </p>
            <p>
              Release: {control.release?.reference} · {control.release?.notes}
            </p>
            <p>
              {checks
                .map(
                  (check) =>
                    `${check}: ${control.inspection[check]} → ${control.release?.[check] ?? "pending"}`,
                )
                .join("; ")}
            </p>
          </div>
        )
      )}
      {card && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          Repair history
        </Button>
      )}
      {historyOpen && (
        <div className="space-y-2">
          <Input
            aria-label="Search repair history"
            placeholder="Search action or recorder ID..."
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {history.isError && (
            <Button variant="outline" onClick={() => void history.refetch()}>
              Retry history
            </Button>
          )}
          {history.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading repair history...
            </p>
          )}
          {history.data?.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No repair events match this search.
            </p>
          )}
          {history.data?.data.map((event) => (
            <div className="rounded border p-2 text-sm" key={event.id}>
              <p>
                {event.action.replaceAll("_", " ")} ·{" "}
                {new Date(event.createdAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </p>
              <p>{event.details.reason ?? event.details.maintenanceReason}</p>
              <p>{event.details.replacementIntent}</p>
              {event.details.inspection && (
                <p>
                  Initial inspection: {event.details.inspection.reference} ·{" "}
                  {event.details.inspection.notes} ·{" "}
                  {checks
                    .map(
                      (check) =>
                        `${check}: ${event.details.inspection![check]}`,
                    )
                    .join("; ")}
                </p>
              )}
              {event.details.release && (
                <p>
                  Clearance: {event.details.release.reference} ·{" "}
                  {event.details.release.notes} ·{" "}
                  {checks
                    .map(
                      (check) => `${check}: ${event.details.release![check]}`,
                    )
                    .join("; ")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Recorded by {event.actorName ?? event.actorId}
              </p>
            </div>
          ))}
          {history.data && (
            <TablePaginationFooter
              page={page}
              size={size}
              total={history.data.meta?.total ?? 0}
              onPageChange={(next) => setPaging({ key, page: next })}
              onSizeChange={setSize}
            />
          )}
        </div>
      )}
    </section>
  );
}
