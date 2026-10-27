"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  IconCamera,
  IconHandFinger,
  IconPencil,
  IconPhotoPlus,
  IconTrash,
} from "@tabler/icons-react";
import { FEEDBACK_MAX_SCREENSHOTS } from "@skerp/validators";
import type { FeedbackElement } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { capturePage } from "../lib/capture";
import { fileToScreenshot, releaseScreenshot, type Screenshot } from "../lib/images";
import { AnnotateDialog } from "./AnnotateDialog";

/**
 * "Show us (optional)": point at the problem, take a picture of the page, or
 * add your own picture. Paste (Ctrl+V) also works anywhere in the form.
 */
export function ScreenshotSection({
  shots,
  element,
  onShotsChange,
  onElementChange,
  onPick,
}: {
  shots: Screenshot[];
  element: FeedbackElement | null;
  onShotsChange: (shots: Screenshot[]) => void;
  onElementChange: (element: FeedbackElement | null) => void;
  /** Hides the panel, lets the user click the page, then reopens it. */
  onPick: () => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [annotating, setAnnotating] = useState<Screenshot | null>(null);
  const full = shots.length >= FEEDBACK_MAX_SCREENSHOTS;

  const add = async (make: () => Promise<Screenshot>) => {
    if (full) return;
    setBusy(true);
    try {
      onShotsChange([...shots, await make()]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't make the picture. Try 'Add a picture' instead.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = (shot: Screenshot) => {
    releaseScreenshot(shot);
    onShotsChange(shots.filter((item) => item.id !== shot.id));
    if (shot.source === "element") onElementChange(null);
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Show us (optional)</h3>
        <p className="text-xs text-muted-foreground">
          A picture helps the team see the problem straight away. You can add up
          to {FEEDBACK_MAX_SCREENSHOTS}.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" disabled={full || busy} onClick={onPick}>
          <IconHandFinger className="size-4" aria-hidden />
          Point at the problem
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={full || busy}
          onClick={() => add(capturePage)}
        >
          <IconCamera className="size-4" aria-hidden />
          {busy ? "Taking picture…" : "Picture of this page"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={full || busy}
          onClick={() => fileInput.current?.click()}
        >
          <IconPhotoPlus className="size-4" aria-hidden />
          Add a picture
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void add(() => fileToScreenshot(file));
          }}
        />
      </div>

      {element ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You pointed at:{" "}
          <span className="font-medium text-foreground">
            {element.text ? `"${element.text}"` : `a ${element.tag} element`}
          </span>
        </p>
      ) : null}

      {shots.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-3">
          {shots.map((shot, index) => (
            <li key={shot.id} className="space-y-1.5 rounded-md border border-border bg-card p-2">
              {/* Local object URL — next/image can't optimise it. */}
              <img
                src={shot.url}
                alt={`Picture ${index + 1}`}
                className="h-24 w-full rounded-sm border border-border object-cover object-top"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAnnotating(shot)}
                >
                  <IconPencil className="size-3.5" aria-hidden />
                  Mark
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => remove(shot)}
                >
                  <IconTrash className="size-3.5" aria-hidden />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tip: you can also press <kbd className="rounded-sm border border-border bg-muted px-1">PrtScn</kbd>{" "}
          and then <kbd className="rounded-sm border border-border bg-muted px-1">Ctrl</kbd>+
          <kbd className="rounded-sm border border-border bg-muted px-1">V</kbd> here.
        </p>
      )}

      <AnnotateDialog
        shot={annotating}
        onClose={() => setAnnotating(null)}
        onSave={(next) => {
          if (!annotating) return;
          releaseScreenshot(annotating);
          onShotsChange(shots.map((item) => (item.id === annotating.id ? next : item)));
          setAnnotating(null);
        }}
      />
    </section>
  );
}
