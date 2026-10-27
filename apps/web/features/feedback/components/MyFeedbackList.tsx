"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { IconChevronDown, IconInbox } from "@tabler/icons-react";
import { formatFeedbackNumber, type MyFeedbackItem } from "@skerp/types";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { isUpdatedSince } from "../lib/seen";
import { FeedbackCategoryBadge, FeedbackStatusBadge } from "./badges";
import { CommentThread } from "./CommentThread";
import { ConfirmFix } from "./ConfirmFix";

function MyFeedbackRow({
  item,
  updated,
  open,
  onToggle,
}: {
  item: MyFeedbackItem;
  updated: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `my-feedback-${item.id}`;
  return (
    <article
      className={cn(
        "rounded-md border bg-card",
        item.status === "FIXED" && !item.reporterConfirmedAt ? "border-primary/40" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors duration-150 hover:bg-muted"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {formatFeedbackNumber(item.number)}
            </span>
            <FeedbackCategoryBadge category={item.category} />
            <FeedbackStatusBadge status={item.status} />
            {updated ? (
              <span className="text-xs font-medium text-primary">New update</span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.pageTitle} · sent{" "}
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
        </div>
        <IconChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={panelId} className="space-y-4 border-t border-border p-4">
          <ConfirmFix item={item} />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Conversation with the team</p>
            <CommentThread
              feedbackId={item.id}
              canPost
              emptyText="No messages yet. The team will write here if they have a question."
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** What the signed-in user has sent, newest first, with its current status. */
export function MyFeedbackList({ seenAt }: { seenAt: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: feedbackApi.mine,
  });

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
      <p className="text-sm text-muted-foreground">
        Everything you have sent. Open one to see the team&apos;s replies, or to
        tell us whether a fix works.
      </p>

      {isLoading
        ? Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-md border border-border bg-card p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))
        : null}

      {isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          We couldn&apos;t load your feedback: {error.message}
        </p>
      ) : null}

      {data && data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <IconInbox className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            You haven&apos;t sent any feedback yet
          </p>
          <p className="text-sm text-muted-foreground">
            When you do, you can follow it here.
          </p>
        </div>
      ) : null}

      {data?.map((item) => (
        <MyFeedbackRow
          key={item.id}
          item={item}
          updated={isUpdatedSince(item, seenAt)}
          open={openId === item.id}
          onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
        />
      ))}
    </div>
  );
}
