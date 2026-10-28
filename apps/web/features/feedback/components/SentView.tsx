"use client";

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import { formatFeedbackNumber } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import type { UploadProgress } from "../lib/upload";

function UploadRow({ upload }: { upload: UploadProgress }) {
  return (
    <li className="space-y-1.5 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {upload.status === "done" ? (
          <IconCircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
        ) : upload.status === "failed" ? (
          <IconAlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
        ) : (
          <IconUpload className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-foreground">{upload.label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {upload.status === "done"
            ? "Attached"
            : upload.status === "failed"
              ? "Not attached"
              : upload.status === "waiting"
                ? "Waiting"
                : `${Math.round(upload.progress * 100)}%`}
        </span>
      </div>
      {upload.status === "uploading" ? (
        <div className="h-1 overflow-hidden rounded-sm bg-muted" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${upload.progress * 100}%` }} />
        </div>
      ) : null}
      {upload.status === "failed" && upload.error ? (
        <p className="text-xs text-destructive">{upload.error}</p>
      ) : null}
    </li>
  );
}

/** Shown once the item is saved; its files keep uploading even if the panel is closed. */
export function SentView({
  number,
  uploads,
  onRetry,
  onAnother,
  onClose,
}: {
  number: number;
  uploads: UploadProgress[];
  onRetry: () => void;
  onAnother: () => void;
  onClose: () => void;
}) {
  const failed = uploads.filter((upload) => upload.status === "failed").length;
  const busy = uploads.some(
    (upload) => upload.status === "waiting" || upload.status === "uploading",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconCircleCheck className="size-7" aria-hidden />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Thank you, your feedback has been sent
            </h3>
            <p className="text-sm text-muted-foreground">
              Your reference is{" "}
              <span className="font-semibold text-foreground">{formatFeedbackNumber(number)}</span>.
              You can follow it under <strong>My feedback</strong>.
            </p>
          </div>
        </div>

        {uploads.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {busy ? "Attaching your files…" : "Your files"}
            </p>
            <ul className="space-y-2" aria-live="polite">
              {uploads.map((upload) => (
                <UploadRow key={upload.id} upload={upload} />
              ))}
            </ul>
            {busy ? (
              <p className="text-xs text-muted-foreground">
                You can close this panel. Keep this tab open until the files are attached.
              </p>
            ) : null}
            {failed > 0 && !busy ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                <p className="flex-1 text-sm text-destructive">
                  {failed} file{failed === 1 ? "" : "s"} couldn&apos;t be attached. Your
                  feedback was still sent.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  <IconRefresh className="size-3.5" aria-hidden />
                  Retry
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
        <Button
          type="button"
          variant="outline"
          className="max-sm:h-11 max-sm:flex-1"
          disabled={busy}
          onClick={onAnother}
        >
          Send another
        </Button>
        <Button type="button" className="max-sm:h-11 max-sm:flex-1" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
