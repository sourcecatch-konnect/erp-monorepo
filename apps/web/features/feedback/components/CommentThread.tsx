"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconCircleCheck,
} from "@tabler/icons-react";
import { feedbackCommentSchema } from "@skerp/validators";
import type { FeedbackComment, FeedbackCommentBody } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";

const EVENT_ICON = {
  STATUS_CHANGE: IconArrowsExchange,
  CONFIRMED_FIXED: IconCircleCheck,
  STILL_BROKEN: IconAlertTriangle,
} as const;

function CommentItem({ comment }: { comment: FeedbackComment }) {
  const when = format(new Date(comment.createdAt), "dd MMM, h:mm a");
  const who = `${comment.authorName} · ${comment.side === "TEAM" ? "ERP team" : "Reported by"}`;

  if (comment.kind !== "COMMENT") {
    const EventIcon = EVENT_ICON[comment.kind];
    return (
      <li className="flex items-start gap-2 text-sm text-muted-foreground">
        <EventIcon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            comment.kind === "STILL_BROKEN" ? "text-destructive" : "text-primary",
          )}
          aria-hidden
        />
        <span>
          <span className="text-foreground">{comment.body}</span>{" "}
          <span className="text-xs">({comment.authorName}, {when})</span>
        </span>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "rounded-md border px-3 py-2",
        comment.side === "TEAM" ? "border-primary/30 bg-primary/5" : "border-border bg-card",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {who} · {when}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
    </li>
  );
}

/** B8 — the conversation on one item, oldest first, with a reply box. */
export function CommentThread({
  feedbackId,
  canPost,
  emptyText,
}: {
  feedbackId: string;
  canPost: boolean;
  emptyText: string;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: feedbackKeys.comments(feedbackId),
    queryFn: () => feedbackApi.comments(feedbackId),
  });

  const methods = useForm<FeedbackCommentBody>({
    resolver: zodResolver(feedbackCommentSchema),
    defaultValues: { body: "" },
  });

  const send = useMutation({
    mutationFn: (body: FeedbackCommentBody) => feedbackApi.addComment(feedbackId, body),
    onSuccess: () => {
      methods.reset({ body: "" });
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
    onError: (error) => toast.error(`We couldn't send your message: ${error.message}`),
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}

      {canPost ? (
        <FormProvider {...methods}>
          <form
            onSubmit={(event) => {
              // The thread can sit inside another form (the triage form's sheet).
              event.stopPropagation();
              void methods.handleSubmit((values) => send.mutate(values))(event);
            }}
            className="space-y-2"
            noValidate
          >
            <TextAreaField<FeedbackCommentBody>
              name="body"
              label="Write a message"
              placeholder="Ask a question or add more detail."
              rows={2}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={send.isPending}>
                {send.isPending ? "Sending…" : "Send message"}
              </Button>
            </div>
          </form>
        </FormProvider>
      ) : null}
    </div>
  );
}
