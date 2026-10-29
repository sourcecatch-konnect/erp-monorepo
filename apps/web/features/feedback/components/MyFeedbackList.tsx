"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  IconArrowLeft,
  IconChevronRight,
  IconInbox,
  IconMicrophone,
  IconPaperclip,
  IconPhoto,
} from "@tabler/icons-react";
import {
  formatFeedbackNumber,
  formatVoiceDuration,
  legacyDetailRows,
  type MyFeedbackItem,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { isUpdatedSince } from "../lib/seen";
import {
  FeedbackCategoryBadge,
  FeedbackImpactBadge,
  FeedbackStatusBadge,
} from "./badges";
import { CommentThread } from "./CommentThread";
import { ConfirmFix } from "./ConfirmFix";
import { FeedbackFiles } from "./FeedbackFiles";

function AttachmentIcons({ item }: { item: MyFeedbackItem }) {
  if (!item.voiceSeconds && !item.imageCount && !item.documentCount) return null;
  return (
    <span className="flex items-center gap-3 text-xs text-muted-foreground">
      {item.voiceSeconds ? (
        <span className="inline-flex items-center gap-1">
          <IconMicrophone className="size-3.5" aria-hidden />
          <span className="sr-only">Voice note</span>
          {formatVoiceDuration(item.voiceSeconds)}
        </span>
      ) : null}
      {item.imageCount ? (
        <span className="inline-flex items-center gap-1">
          <IconPhoto className="size-3.5" aria-hidden />
          {item.imageCount}
          <span className="sr-only"> picture{item.imageCount === 1 ? "" : "s"}</span>
        </span>
      ) : null}
      {item.documentCount ? (
        <span className="inline-flex items-center gap-1">
          <IconPaperclip className="size-3.5" aria-hidden />
          {item.documentCount}
          <span className="sr-only"> document{item.documentCount === 1 ? "" : "s"}</span>
        </span>
      ) : null}
    </span>
  );
}

function MyFeedbackCard({
  item,
  updated,
  onOpen,
}: {
  item: MyFeedbackItem;
  updated: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border bg-card p-4 text-left transition-colors duration-150 hover:bg-muted",
        item.status === "FIXED" && !item.reporterConfirmedAt ? "border-primary/40" : "border-border",
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {formatFeedbackNumber(item.number)}
          </span>
          <FeedbackCategoryBadge category={item.category} />
          <FeedbackImpactBadge impact={item.impact} withWord />
          <FeedbackStatusBadge status={item.status} />
          {updated ? <span className="text-xs font-medium text-primary">New update</span> : null}
        </div>
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs text-muted-foreground">
            {item.pageTitle} · sent{" "}
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
          <AttachmentIcons item={item} />
        </div>
      </div>
      <IconChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function MyFeedbackDetail({ item, onBack }: { item: MyFeedbackItem; onBack: () => void }) {
  const { data: detail, isLoading, isError, error } = useQuery({
    queryKey: feedbackKeys.detail(item.id),
    queryFn: () => feedbackApi.detail(item.id),
  });
  const oldAnswers = detail ? legacyDetailRows(detail.details) : [];

  return (
    <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 max-sm:h-10" onClick={onBack}>
        <IconArrowLeft className="size-4" aria-hidden />
        All my feedback
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {formatFeedbackNumber(item.number)}
          </span>
          <FeedbackCategoryBadge category={item.category} />
          <FeedbackImpactBadge impact={item.impact} withWord />
          <FeedbackStatusBadge status={item.status} />
        </div>
        <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
        <p className="text-xs text-muted-foreground">
          {item.pageTitle}
          {item.section ? ` · ${item.section}` : ""} · sent{" "}
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>

      <ConfirmFix item={item} />

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">We couldn&apos;t load this item: {error.message}</p>
      ) : detail ? (
        <div className="space-y-4">
          {detail.description ? (
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {detail.description}
            </p>
          ) : null}
          {detail.points.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
              {detail.points.map((point, index) => (
                <li key={index} className="break-words">
                  {point}
                </li>
              ))}
            </ol>
          ) : null}
          {oldAnswers.length > 0 ? (
            <dl className="grid gap-2 rounded-md border border-border bg-card p-3 text-sm">
              {oldAnswers.map(([label, value]) => (
                <div key={label} className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-wrap break-words text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <FeedbackFiles files={detail.files} voiceSeconds={detail.voiceSeconds} />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Conversation with the team</p>
        <CommentThread
          feedbackId={item.id}
          canPost
          emptyText="No messages yet. The team will write here if they have a question."
        />
      </div>
    </div>
  );
}

/** What the signed-in user has sent, newest first; open one for its files and replies. */
export function MyFeedbackList({ seenAt }: { seenAt: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: feedbackApi.mine,
  });

  const open = data?.find((item) => item.id === openId);
  if (open) return <MyFeedbackDetail item={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
      <p className="text-sm text-muted-foreground">
        Everything you have sent (your latest 50). Open one to listen to it again,
        see the team&apos;s replies, or tell us whether a fix works.
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
          <p className="text-sm text-muted-foreground">When you do, you can follow it here.</p>
        </div>
      ) : null}

      {data?.map((item) => (
        <MyFeedbackCard
          key={item.id}
          item={item}
          updated={isUpdatedSince(item, seenAt)}
          onOpen={() => setOpenId(item.id)}
        />
      ))}
    </div>
  );
}
