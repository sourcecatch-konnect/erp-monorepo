"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconListCheck,
  IconRoute,
  IconSchool,
  IconUserCircle,
} from "@tabler/icons-react";
import { TRAINING_WELCOME_STEP } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { useStepProgress, useTrainingMe } from "../hooks/useTraining";

const POINTS = [
  {
    icon: IconUserCircle,
    title: "See your part of the work",
    text: "Which business steps are yours, and who does the next one.",
  },
  {
    icon: IconRoute,
    title: "Learn how the business works",
    text: "Follow an order from booking all the way to payment.",
  },
  {
    icon: IconListCheck,
    title: "Take a short training",
    text: "A few steps for your role, at your own pace. Your progress is saved.",
  },
] as const;

/**
 * A11 — shown once per user (stored server-side, so not again on another
 * device). Mounted on the dashboard only, never over a form.
 */
export function TrainingWelcome() {
  const router = useRouter();
  const { data: me } = useTrainingMe();
  const progress = useStepProgress();
  const [dismissed, setDismissed] = useState(false);

  const seen = me?.progress.some((entry) => entry.stepKey === TRAINING_WELCOME_STEP);
  const open = me !== undefined && !seen && !dismissed;

  const finish = (seeRole: boolean) => {
    setDismissed(true);
    progress.mutate({
      stepKey: TRAINING_WELCOME_STEP,
      status: seeRole ? "DONE" : "SKIPPED",
    });
    if (seeRole) router.push("/training");
  };

  if (!me) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-2">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconSchool className="size-6" aria-hidden />
          </span>
          <DialogTitle className="text-lg">
            Welcome to SK ERP, {me.user.firstName}
          </DialogTitle>
          <DialogDescription className="text-sm">
            You are signed in as{" "}
            <span className="font-semibold text-foreground">{me.role.name}</span>
            {me.homeBranch ? (
              <>
                {" "}at <span className="font-semibold text-foreground">{me.homeBranch.name}</span>
              </>
            ) : null}
            . Here is how to get started.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {POINTS.map(({ icon: PointIcon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <PointIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          You can open Training from the menu on the left at any time.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)}>
            Later
          </Button>
          <Button onClick={() => finish(true)}>See my role</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
