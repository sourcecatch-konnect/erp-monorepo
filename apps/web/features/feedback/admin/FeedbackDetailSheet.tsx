"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { IconCircleCheck, IconCopy, IconExternalLink } from "@tabler/icons-react";
import {
  describeUserAgent,
  formatFeedbackNumber,
  type FeedbackDetail,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
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
  FeedbackCategoryBadge,
  FeedbackSeverityBadge,
  FeedbackStatusBadge,
} from "../components/badges";
import { CommentThread } from "../components/CommentThread";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { detailRows, feedbackAsJira } from "../lib/copy-as-jira";
import { TriageForm } from "./TriageForm";

const TRIAGE_FORM_ID = "feedback-triage-form";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function FieldList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-3 rounded-md border border-border bg-card p-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TechnicalDetails({ item }: { item: FeedbackDetail }) {
  const { context } = item;
  const calls = context.recentApi ?? [];
  const errors = context.recentErrors ?? [];
  return (
    <details className="rounded-md border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Technical details
      </summary>
      <div className="mt-3 space-y-4">
        <dl className="grid gap-2 text-sm">
          {(
            [
              ["Browser", describeUserAgent(context.userAgent)],
              ["App version", context.appVersion ?? "Not set"],
              ["Window / screen", `${context.viewport ?? "?"} / ${context.screen ?? "?"}`],
              ["Time zone", context.timezone ?? "?"],
              ["Breadcrumb", (context.breadcrumb ?? []).join(" › ") || "—"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Last API calls before sending
          </p>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call, index) => (
                  <TableRow key={`${call.at}-${index}`}>
                    <TableCell className="font-mono text-xs">
                      {call.method} {call.url}
                    </TableCell>
                    <TableCell
                      className={
                        call.status === null || call.status >= 400
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {call.status ?? "No response"}
                      {call.durationMs !== null ? ` · ${call.durationMs} ms` : ""}
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {call.message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {errors.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Browser errors</p>
            <ul className="space-y-1 text-sm text-destructive">
              {errors.map((error, index) => (
                <li key={`${error.at}-${index}`} className="break-words">
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function FeedbackDetailSheet({
  id,
  canManage,
  onClose,
}: {
  id: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const { data: item, isLoading, isError, error } = useQuery({
    queryKey: feedbackKeys.detail(id ?? ""),
    queryFn: () => feedbackApi.detail(id!),
    enabled: id !== null,
  });

  const copyAsJira = async () => {
    if (!item) return;
    const link = `${window.location.origin}/settings/feedback?id=${item.id}`;
    try {
      await navigator.clipboard.writeText(feedbackAsJira(item, link));
      toast.success("Copied. Paste it into the Jira description.");
    } catch {
      toast.error("Your browser blocked copying. Select the text and copy it manually.");
    }
  };

  return (
    <Sheet
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        {isLoading || !item ? (
          <div className="space-y-4 p-6">
            <SheetTitle className="sr-only">Feedback details</SheetTitle>
            {isError ? (
              <p className="text-sm text-destructive">
                We couldn&apos;t load this feedback: {error.message}
              </p>
            ) : (
              <>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            )}
          </div>
        ) : (
          <>
            <SheetHeader className="gap-2 border-b border-border px-6 py-4 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {formatFeedbackNumber(item.number)}
                </span>
                <FeedbackCategoryBadge category={item.category} />
                {item.severity ? <FeedbackSeverityBadge severity={item.severity} /> : null}
                <FeedbackStatusBadge status={item.status} />
                {item.reporterConfirmedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <IconCircleCheck className="size-3.5" aria-hidden />
                    Tester confirmed the fix
                  </span>
                ) : null}
              </div>
              <SheetTitle className="text-lg">{item.title}</SheetTitle>
              <SheetDescription>
                Reported by {item.reporterName} ({item.reporterRole}
                {item.reporterBranch ? `, ${item.reporterBranch}` : ""}) on{" "}
                {format(new Date(item.createdAt), "dd MMM yyyy, h:mm a")}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <Section title="Where it happened">
                <FieldList
                  rows={[
                    ["Page", `${item.pageTitle} (${item.moduleLabel})`],
                    [
                      "Address",
                      <Link
                        key="link"
                        href={item.pagePath}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {item.pagePath}
                        <IconExternalLink className="size-3.5" aria-hidden />
                      </Link>,
                    ],
                    ...(item.entityId
                      ? ([["Record", item.entityId]] as [string, string][])
                      : []),
                    ...(item.context.element
                      ? ([
                          [
                            "Pointed at",
                            item.context.element.text
                              ? `"${item.context.element.text}"`
                              : item.context.element.selector,
                          ],
                        ] as [string, string][])
                      : []),
                  ]}
                />
              </Section>

              <Section title="What they told us">
                <FieldList
                  rows={[
                    ...detailRows(item),
                    ...(item.description
                      ? ([["Anything else", item.description]] as [string, string][])
                      : []),
                  ]}
                />
              </Section>

              {item.screenshots.length > 0 ? (
                <Section title={`Pictures (${item.screenshots.length})`}>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {item.screenshots.map((shot, index) => (
                      <li key={shot.id}>
                        <a
                          href={shot.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-md border border-border transition-colors duration-150 hover:border-primary"
                        >
                          {/* Presigned storage URL — next/image can't optimise it. */}
                          <img
                            src={shot.url}
                            alt={`Picture ${index + 1} from the reporter`}
                            className="h-40 w-full object-cover object-top"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Click a picture to open it full size.
                  </p>
                </Section>
              ) : null}

              <TechnicalDetails item={item} />

              <Section title="Conversation with the reporter">
                <CommentThread
                  feedbackId={item.id}
                  canPost={canManage}
                  emptyText="No messages yet. Ask the reporter a question here; they see it under My feedback."
                />
              </Section>

              <Section title="Team notes">
                {canManage ? (
                  <TriageForm
                    item={item}
                    formId={TRIAGE_FORM_ID}
                    onSavingChange={setSaving}
                  />
                ) : (
                  <FieldList
                    rows={[
                      ["Assigned to", item.assignee ?? "—"],
                      ["Jira key", item.externalRef ?? "—"],
                      ["Developer notes", item.devNotes ?? "—"],
                    ]}
                  />
                )}
              </Section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={copyAsJira}>
                <IconCopy className="size-4" aria-hidden />
                Copy as Jira
              </Button>
              {canManage ? (
                <Button type="submit" form={TRIAGE_FORM_ID} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
