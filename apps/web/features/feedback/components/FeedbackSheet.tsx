"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FEEDBACK_MAX_FILES, FEEDBACK_MAX_SECTION_CHARS } from "@skerp/validators";
import type { FeedbackCreated, FeedbackElement } from "@skerp/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@skerp/ui/components/tabs";
import { useBreadcrumbLabels } from "@/components/layout/breadcrumb-labels";
import { feedbackKeys } from "../feedback.keys";
import type { FeedbackFormValues } from "../form-values";
import { captureElement, pickElement } from "../lib/capture";
import { loadDraft, saveDraft } from "../lib/draft";
import {
  NO_ATTACHMENTS,
  releaseAttachments,
  releaseVoiceNote,
  type PageAttachments,
  type PendingFile,
  type VoiceNote,
} from "../lib/files";
import { describePage } from "../lib/page-context";
import { sectionFor } from "../lib/page-sections";
import { markFeedbackSeen, readSeenAt } from "../lib/seen";
import type { VoiceNote } from "../lib/voice-note";
import { FeedbackForm } from "./FeedbackForm";
import { MyFeedbackList } from "./MyFeedbackList";
import { SentView } from "./SentView";

type View = "give" | "mine";

/** A sent item whose files are still being (or failed to be) attached. */
type Delivery = {
  id: string;
  number: number;
  jobs: UploadJob[];
  uploads: UploadProgress[];
};

// Radix sets data-state="active"; the shared Tabs' `data-active:` styles don't match it.
const VIEW_TAB_CLASS =
  "px-3 max-sm:h-10 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground";

/** Lazy-loaded by FeedbackLauncher on first open (default export for next/dynamic). */
export default function FeedbackSheet({
  open,
  onOpenChange,
  screenshotsEnabled,
  voiceNotesEnabled,
  updates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshotsEnabled: boolean;
  voiceNotesEnabled: boolean;
  /** Items with news since the user last looked at My feedback. */
  updates: number;
}) {
  const [view, setView] = useState<View>("new");
  // Pictures + the picked element live here, not in the form: the form
  // unmounts while the panel is hidden for "Point at the problem".
  const [shots, setShots] = useState<Screenshot[]>([]);
  // Voice notes are held here for the same reason as the pictures.
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [element, setElement] = useState<FeedbackElement | null>(null);
  const [picking, setPicking] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  // When My feedback was last opened before now, so new items stay marked.
  const [seenAtOnOpen, setSeenAtOnOpen] = useState(0);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const changeView = (next: View) => {
    if (next === "mine") {
      setSeenAtOnOpen(readSeenAt());
      markFeedbackSeen();
    }
    setView(next);
  };

  useEffect(() => {
    if (open) return;
    // Closing the panel while on My feedback counts as having seen it.
    if (viewRef.current === "mine") markFeedbackSeen();
    // A finished delivery is done with; failed ones stay so they can be retried.
    setDelivery((current) =>
      current && current.uploads.every((upload) => upload.status === "done") ? null : current,
    );
  }, [open]);

  const patchPage = (patch: (current: PageAttachments) => Partial<PageAttachments>) =>
    setByPage((all) => {
      const current = all[pathname] ?? NO_ATTACHMENTS;
      return { ...all, [pathname]: { ...current, ...patch(current) } };
    });

  const setFiles = (files: PendingFile[]) => patchPage(() => ({ files }));
  const setElement = (element: FeedbackElement | null) => patchPage(() => ({ element }));
  const setVoice = (voice: VoiceNote | null) =>
    patchPage((current) => {
      if (current.voice && current.voice !== voice) releaseVoiceNote(current.voice);
      return { voice };
    });

  const startPick = async () => {
    setPicking(true);
    // Wait for the panel's 200ms exit animation: until it ends, Radix keeps
    // pointer-events off the page and nothing could be pointed at.
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const picked = await pickElement();
      if (!picked) return;
      // The form is unmounted right now and reads its draft when it comes back.
      const section = sectionFor(picked.element)?.slice(0, FEEDBACK_MAX_SECTION_CHARS);
      if (section) {
        saveDraft(pathname, { ...loadDraft<FeedbackFormValues>(pathname), section });
      }
      const room = attachments.files.length < FEEDBACK_MAX_FILES;
      const shot = uploadsEnabled && room ? await captureElement(picked.element) : null;
      patchPage((current) => ({
        element: picked.info,
        files: shot ? [...current.files, { kind: "image", id: shot.id, shot }] : current.files,
      }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't take that picture.",
      );
    } finally {
      setPicking(false);
    }
  };

  const updateUpload = (feedbackId: string) => (id: string, patch: Partial<UploadProgress>) =>
    setDelivery((current) =>
      current && current.id === feedbackId
        ? {
          ...current,
          uploads: current.uploads.map((upload) =>
            upload.id === id ? { ...upload, ...patch } : upload,
          ),
        }
        : current,
    );

  const deliver = (feedbackId: string, jobs: UploadJob[]) =>
    runUploads(feedbackId, jobs, updateUpload(feedbackId)).then(() =>
      queryClient.invalidateQueries({ queryKey: feedbackKeys.mine }),
    );

  const onSent = (created: FeedbackCreated) => {
    const jobs = uploadsEnabled ? uploadJobs(attachments) : [];
    // Previews are no longer needed; the jobs keep the blobs themselves.
    releaseAttachments(attachments);
    setByPage((all) => {
      const rest = { ...all };
      delete rest[pathname];
      return rest;
    });
    setDelivery({ id: created.id, number: created.number, jobs, uploads: waitingProgress(jobs) });
    void queryClient.invalidateQueries({ queryKey: feedbackKeys.mine });
    if (jobs.length > 0) void deliver(created.id, jobs);
  };

  const retry = () => {
    if (!delivery) return;
    const failed = new Set(
      delivery.uploads.filter((upload) => upload.status === "failed").map((upload) => upload.id),
    );
    void deliver(
      delivery.id,
      delivery.jobs.filter((job) => failed.has(job.id)),
    );
  };

  return (
    <Sheet open={open && !picking} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-2xl data-[side=right]:xl:max-w-3xl"
      >
        <SheetHeader className="gap-1 border-b border-border px-6 py-4 pr-12">
          <SheetTitle className="text-lg">
            Send feedback to the ERP team
          </SheetTitle>
          <SheetDescription>
            Found a problem or have an idea? Tell us here. It goes straight to
            the people building the system.
          </SheetDescription>
          <Tabs
            value={view}
            onValueChange={(value) => changeView(value as View)}
            className="mt-3"
          >
            <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
              <TabsTrigger value="give" className={VIEW_TAB_CLASS}>
                Give feedback
              </TabsTrigger>
              <TabsTrigger value="mine" className={VIEW_TAB_CLASS}>
                My feedback
                {updates > 0 ? (
                  <span className="ml-1 text-xs font-semibold text-primary">
                    ({updates} new)
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        {view === "mine" ? (
          <MyFeedbackList seenAt={seenAtOnOpen} />
        ) : delivery ? (
          <SentView
            number={delivery.number}
            uploads={delivery.uploads}
            onRetry={retry}
            onAnother={() => setDelivery(null)}
            onClose={() => onOpenChange(false)}
            screenshotsEnabled={screenshotsEnabled}
            voiceNotesEnabled={voiceNotesEnabled}
            shots={shots}
            notes={notes}
            element={element}
            onShotsChange={setShots}
            onNotesChange={setNotes}
            onElementChange={setElement}
            onPick={startPick}
          />
        ) : (
          <FeedbackForm
            key={page.path}
            page={page}
            attachments={attachments}
            uploadsEnabled={uploadsEnabled}
            onFilesChange={setFiles}
            onVoiceChange={setVoice}
            onElementChange={setElement}
            onPoint={startPick}
            onSent={onSent}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
