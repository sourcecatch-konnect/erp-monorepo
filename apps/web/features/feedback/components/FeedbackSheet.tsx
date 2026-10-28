"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FeedbackElement } from "@skerp/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@skerp/ui/components/tabs";
import { captureElement, pickElement } from "../lib/capture";
import type { Screenshot } from "../lib/images";
import { markFeedbackSeen, readSeenAt } from "../lib/seen";
import type { VoiceNote } from "../lib/voice-note";
import { FeedbackForm } from "./FeedbackForm";
import { MyFeedbackList } from "./MyFeedbackList";

type View = "new" | "mine";

// Radix sets data-state="active"; the shared Tabs' `data-active:` styles don't match it.
const VIEW_TAB_CLASS =
  "px-3 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground";

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

  // Closing the panel while on My feedback counts as having seen it.
  useEffect(() => {
    if (!open && viewRef.current === "mine") markFeedbackSeen();
  }, [open]);

  const startPick = async () => {
    setPicking(true);
    // Wait for the panel's 200ms exit animation: until it ends, Radix keeps
    // pointer-events off the page and nothing could be pointed at.
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const picked = await pickElement();
      if (picked) {
        const shot = await captureElement(picked.element);
        setShots((current) => [...current, shot]);
        setElement(picked.info);
      }
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

  return (
    <Sheet open={open && !picking} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 data-[side=right]:sm:max-w-xl"
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
            <TabsList>
              <TabsTrigger value="new" className={VIEW_TAB_CLASS}>
                New feedback
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

        {view === "new" ? (
          <FeedbackForm
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
          <MyFeedbackList seenAt={seenAtOnOpen} />
        )}
      </SheetContent>
    </Sheet>
  );
}
