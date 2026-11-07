"use client";

import { TrainingNav } from "./TrainingNav";

/**
 * The top of every training screen.
 *
 * The tab bar already names the page, so the heading names the *section* and
 * the tabs name the page — printing "How the business works" as both a tab and
 * an <h1> said the same thing twice and pushed the actual content down. The
 * caption sits under the tabs, next to the content it describes, so each
 * screen still explains itself in one line.
 */
export function TrainingPageHeader({ caption }: { caption: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Training
      </h1>
      <TrainingNav />
      <p className="max-w-[80ch] text-sm text-muted-foreground">{caption}</p>
    </header>
  );
}
