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
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative h-9 gap-2 rounded-xl border-violet-200 bg-violet-50 px-3.5 text-sm font-medium text-violet-700 shadow-sm transition-colors duration-150 hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300 dark:hover:bg-violet-400/20 dark:hover:text-violet-200 max-sm:size-11 max-sm:px-0"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <IconMessageReport
          className="size-4 shrink-0"
          stroke={1.8}
          aria-hidden
        />

        <span className="max-sm:sr-only">Give feedback</span>

        {updates > 0 ? (
          <>
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold leading-none text-white ring-2 ring-background"
            >
              {updates > 9 ? "9+" : updates}
            </span>

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
