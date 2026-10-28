"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { IconMessageReport } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { FEEDBACK_ENABLED } from "../feedback.flag";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";
import { installActivityRecorder } from "../lib/activity-recorder";
import { useFeedbackUpdates } from "../lib/seen";

// Only fetched the first time someone opens feedback.
const FeedbackSheet = dynamic(() => import("./FeedbackSheet"), { ssr: false });

/** If anything inside feedback crashes, hide it — never take the page down. */
class FeedbackErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[feedback] widget crashed and was hidden:", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function EnabledLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 404 when the server flag is off → stay hidden.
  const status = useQuery({
    queryKey: feedbackKeys.status,
    queryFn: feedbackApi.status,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const enabled = status.data?.enabled === true;
  const updates = useFeedbackUpdates(enabled);

  // Record from the first render, not once the probe answers: a page's first
  // API calls (often the failing ones) happen before /feedback/status returns.
  // Stops again if the server says feedback is off.
  useEffect(
    () => (status.isError ? undefined : installActivityRecorder()),
    [status.isError],
  );

  if (!enabled) return null;

  return (
    <>
      <Button
        variant="outline"
        aria-haspopup="dialog"
        className="relative max-sm:size-11 max-sm:px-0"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <IconMessageReport className="size-4" aria-hidden />
        {/* Icon only on phones: the top bar is narrow there. */}
        <span className="max-sm:sr-only">Feedback</span>
        {updates > 0 ? (
          <>
            <span
              aria-hidden
              className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background"
            />
            <span className="sr-only">
              , {updates} update{updates === 1 ? "" : "s"} on your feedback
            </span>
          </>
        ) : null}
      </Button>
      {mounted ? (
        <FeedbackSheet
          open={open}
          onOpenChange={setOpen}
          uploadsEnabled={status.data?.uploads === true}
          updates={updates}
        />
      ) : null}
    </>
  );
}

/**
 * Top-bar entry point, mounted once in AppShell so it is on every page.
 * Renders nothing unless NEXT_PUBLIC_FEEDBACK_ENABLED=true and the server
 * reports feedback as enabled.
 */
export function FeedbackLauncher() {
  if (!FEEDBACK_ENABLED) return null;
  return (
    <FeedbackErrorBoundary>
      <EnabledLauncher />
    </FeedbackErrorBoundary>
  );
}
