"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@skerp/ui/components/tabs";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<View>("new");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="gap-1 border-b border-border px-6 py-4 pr-12">
          <SheetTitle className="text-lg">Send feedback to the ERP team</SheetTitle>
          <SheetDescription>
            Found a problem or have an idea? Tell us here. It goes straight to
            the people building the system.
          </SheetDescription>
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as View)}
            className="mt-3"
          >
            <TabsList>
              <TabsTrigger value="new" className={VIEW_TAB_CLASS}>
                New feedback
              </TabsTrigger>
              <TabsTrigger value="mine" className={VIEW_TAB_CLASS}>
                My feedback
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        {view === "new" ? (
          <FeedbackForm onClose={() => onOpenChange(false)} />
        ) : (
          <MyFeedbackList />
        )}
      </SheetContent>
    </Sheet>
  );
}
