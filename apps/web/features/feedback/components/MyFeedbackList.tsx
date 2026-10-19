"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { IconInbox } from "@tabler/icons-react";
import { formatFeedbackNumber } from "@skerp/types";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { FeedbackCategoryBadge, FeedbackStatusBadge } from "./badges";

/** What the signed-in user has sent, newest first, with its current status. */
export function MyFeedbackList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: feedbackApi.mine,
  });

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
      <p className="text-sm text-muted-foreground">
        Everything you have sent. The team updates the status as they work on it.
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
        <article key={item.id} className="space-y-2 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {formatFeedbackNumber(item.number)}
              </span>
              <FeedbackCategoryBadge category={item.category} />
            </div>
            <FeedbackStatusBadge status={item.status} />
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.pageTitle} · sent{" "}
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
        </article>
      ))}
    </div>
  );
}
