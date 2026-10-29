"use client";

import { IconDownload, IconFileText } from "@tabler/icons-react";
import type { FeedbackFile } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { formatBytes } from "../lib/files";
import { VoicePlayer } from "./VoicePlayer";

/**
 * What the reporter attached, read-only: the voice note, pictures (open full
 * size) and documents (download). Used by My feedback and the admin detail.
 */
export function FeedbackFiles({
  files,
  voiceSeconds,
  showSpeed = false,
}: {
  files: FeedbackFile[];
  voiceSeconds: number | null;
  showSpeed?: boolean;
}) {
  const voice = files.find((file) => file.kind === "voice");
  const pictures = files.filter((file) => file.kind === "image");
  const documents = files.filter((file) => file.kind === "document");
  if (files.length === 0) return null;

  return (
    <div className="space-y-4">
      {voice ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Voice note</p>
          <div className="rounded-md border border-border bg-card p-3">
            <VoicePlayer
              url={voice.url}
              durationSec={voiceSeconds}
              showSpeed={showSpeed}
              downloadName={voice.name}
            />
          </div>
        </div>
      ) : null}

      {pictures.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Pictures ({pictures.length})
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pictures.map((picture, index) => (
              <li key={picture.id}>
                <a
                  href={picture.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border border-border transition-colors duration-150 hover:border-primary"
                >
                  {/* Presigned storage URL — next/image can't optimise it. */}
                  <img
                    src={picture.url}
                    alt={`Picture ${index + 1} from the reporter`}
                    className="h-28 w-full object-cover object-top"
                  />
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Open a picture to see it full size.</p>
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Documents ({documents.length})
          </p>
          <ul className="space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <IconFileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{document.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(document.sizeBytes)}</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="max-sm:h-10">
                  <a href={document.url} download={document.name}>
                    <IconDownload className="size-3.5" aria-hidden />
                    Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
