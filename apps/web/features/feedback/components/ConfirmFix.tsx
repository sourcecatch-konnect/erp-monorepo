"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconCircleCheck, IconExternalLink } from "@tabler/icons-react";
import type { MyFeedbackItem } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";

/**
 * B8 — when the team marks an item Fixed, the person who reported it checks
 * the page and answers: it works, or it's still broken (which reopens it).
 */
export function ConfirmFix({ item }: { item: MyFeedbackItem }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const answer = useMutation({
    mutationFn: (outcome: "CONFIRMED_FIXED" | "STILL_BROKEN") =>
      feedbackApi.confirm(item.id, { outcome, comment: comment.trim() || undefined }),
    onSuccess: (_result, outcome) => {
      toast.success(
        outcome === "CONFIRMED_FIXED"
          ? "Thank you for checking."
          : "Thanks. We've sent it back to the team.",
      );
      setComment("");
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
    onError: (error) => toast.error(error.message),
  });

  if (item.status !== "FIXED") return null;

  if (item.reporterConfirmedAt) {
    return (
      <p className="flex items-center gap-2 text-sm text-primary">
        <IconCircleCheck className="size-4" aria-hidden />
        You confirmed this is fixed.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">The team says this is fixed</p>
        <p className="text-sm text-muted-foreground">
          Please try it on the page and tell us if it works now.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={item.pagePath}>
          <IconExternalLink className="size-3.5" aria-hidden />
          Open {item.pageTitle}
        </Link>
      </Button>
      <div className="grid gap-1.5">
        <label htmlFor={`confirm-${item.id}`} className="text-xs font-medium text-muted-foreground">
          Anything to add? (optional)
        </label>
        <Textarea
          id={`confirm-${item.id}`}
          rows={2}
          value={comment}
          maxLength={2000}
          onChange={(event) => setComment(event.target.value)}
          placeholder="e.g. Works now, thank you. / Still shows the same error."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={answer.isPending}
          onClick={() => answer.mutate("CONFIRMED_FIXED")}
        >
          Yes, it works now
        </Button>
        <Button
          variant="outline"
          disabled={answer.isPending}
          onClick={() => answer.mutate("STILL_BROKEN")}
        >
          No, it&apos;s still broken
        </Button>
      </div>
    </div>
  );
}
