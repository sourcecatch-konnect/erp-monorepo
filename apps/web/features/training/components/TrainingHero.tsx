"use client";

import {
  IconBuildingStore,
  IconFlame,
  IconUserCircle,
  type Icon,
} from "@tabler/icons-react";
import type { TrainingMe } from "@skerp/types";
import { ProgressRing } from "./ProgressRing";
import { TrainingIllustration } from "./TrainingIllustration";

function Badge({
  icon: BadgeIcon,
  tone,
  children,
}: {
  icon: Icon;
  tone: "primary" | "learn-1" | "learn-5";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-card/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
      <BadgeIcon
        className={
          tone === "primary"
            ? "size-3.5 text-primary"
            : tone === "learn-1"
              ? "size-3.5 text-learn-1"
              : "size-3.5 text-learn-5"
        }
        aria-hidden
      />
      {children}
    </span>
  );
}

/**
 * The top of "My role & training": who you are, and the two numbers that say
 * how far along you are. A greeting and a picture first, because this is the
 * one screen in the ERP that is about the person rather than the paperwork.
 */
export function TrainingHero({
  me,
  readiness,
  completed,
}: {
  me: TrainingMe;
  /** Required lessons finished, as a percentage. */
  readiness: number;
  /** Required tracks fully finished, as a percentage. */
  completed: number;
}) {
  const branches =
    me.branchScope === "ALL"
      ? "All branches"
      : me.branches.map((branch) => branch.name).join(", ") ||
        "No branch assigned";

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/10 via-learn-1-soft to-card p-5">
        <div className="relative z-[1] max-w-[42ch] sm:max-w-[48ch]">
          <p className="text-xs font-semibold uppercase tracking-tight text-primary">
            Training &amp; development
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Welcome, {me.user.firstName}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {me.profile?.summary ??
              "Your training here builds the skills you need for your role — what you do in the ERP, and where your work fits in the business."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge icon={IconUserCircle} tone="primary">
              {me.role.name}
            </Badge>
            <Badge icon={IconBuildingStore} tone="learn-1">
              {branches}
            </Badge>
            {me.homeBranch ? (
              <Badge icon={IconFlame} tone="learn-5">
                {me.homeBranch.name}
              </Badge>
            ) : null}
          </div>
        </div>

        <TrainingIllustration className="pointer-events-none absolute -bottom-2 right-0 hidden h-[88%] w-auto opacity-90 lg:block" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Your progress</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="flex items-center gap-3">
            <ProgressRing percent={readiness} label="Readiness" size={44} />
            <div className="min-w-0">
              <dt className="text-sm font-medium text-foreground">Readiness</dt>
              <dd className="text-xs text-muted-foreground">
                Lessons your role needs
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing
              percent={completed}
              label="Completed tracks"
              size={44}
            />
            <div className="min-w-0">
              <dt className="text-sm font-medium text-foreground">Completed</dt>
              <dd className="text-xs text-muted-foreground">
                Required tracks done
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}
