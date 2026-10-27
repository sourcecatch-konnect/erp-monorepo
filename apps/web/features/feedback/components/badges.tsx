import {
  IconCircleCheck,
  IconCircleDot,
  IconCircleX,
  IconCopy,
  IconEye,
  IconProgress,
  type Icon,
} from "@tabler/icons-react";
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "@skerp/validators";
import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackStatus,
} from "@skerp/types";
import { cn } from "@skerp/ui/lib/util";
import { CATEGORY_META } from "../categories";

const BADGE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium";

// Meaning is carried by icon + text, not colour alone (design.md §9).
const STATUS_STYLE: Record<FeedbackStatus, { icon: Icon; className: string }> = {
  NEW: { icon: IconCircleDot, className: "border-primary/30 bg-primary/10 text-primary" },
  TRIAGED: { icon: IconEye, className: "border-border bg-muted text-foreground" },
  IN_PROGRESS: { icon: IconProgress, className: "border-primary/30 bg-primary/5 text-primary" },
  FIXED: { icon: IconCircleCheck, className: "border-border bg-card text-foreground" },
  WONT_FIX: { icon: IconCircleX, className: "border-border bg-muted text-muted-foreground" },
  DUPLICATE: { icon: IconCopy, className: "border-border bg-muted text-muted-foreground" },
};

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const { icon: StatusIcon, className } = STATUS_STYLE[status];
  return (
    <span className={cn(BADGE, className)}>
      <StatusIcon className="size-3.5" aria-hidden />
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  );
}

export function FeedbackCategoryBadge({
  category,
}: {
  category: FeedbackCategory;
}) {
  const CategoryIcon = CATEGORY_META[category].icon;
  return (
    <span className={cn(BADGE, "border-border bg-card text-foreground")}>
      <CategoryIcon className="size-3.5 text-muted-foreground" aria-hidden />
      {FEEDBACK_CATEGORY_LABELS[category]}
    </span>
  );
}

const SEVERITY_STYLE: Record<FeedbackSeverity, string> = {
  BLOCKER: "border-destructive/30 bg-destructive/10 text-destructive",
  MAJOR: "border-border bg-muted text-foreground",
  MINOR: "border-border bg-card text-muted-foreground",
};

export function FeedbackSeverityBadge({
  severity,
}: {
  severity: FeedbackSeverity | null;
}) {
  if (!severity) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn(BADGE, SEVERITY_STYLE[severity])}>
      {FEEDBACK_SEVERITY_LABELS[severity]}
    </span>
  );
}
