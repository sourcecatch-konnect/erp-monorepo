"use client";

import { Fragment, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  addDays,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconFilterOff,
  IconHistory,
  IconListSearch,
  IconMinus,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@skerp/ui/components/avatar";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@skerp/ui/components/collapsible";
import { TableEmptyState, TablePaginationFooter } from "@/components/data-table";
import { useAuth } from "@/features/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { rbacApi } from "./rbac.service";
import { rbacKeys } from "./rbac.keys";
import {
  AUDIT_AREAS,
  actorInitials,
  actorName,
  describeAuditEntry,
  type AuditChange,
  type AuditItem,
  type AuditTone,
} from "./audit-log.format";
import type { AuditLogEntry, AuditLogQuery } from "./types";

const COLUMN_COUNT = 4;
const ALL = "all";

type Period = "any" | "today" | "7d" | "30d" | "custom";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom dates" },
];

type HistoryRecord = { entity: string; id: string; name: string; type: string };

type Filters = {
  /** ALL, `area:<entity>` or `action:<action>`. */
  activity: string;
  actorId: string;
  period: Period;
  /** yyyy-MM-dd, only used for the custom period. */
  fromDate: string;
  toDate: string;
  /** Drill-down into one record's history. */
  record: HistoryRecord | null;
  /** Filters to restore when leaving the record history. */
  back: Filters | null;
  /** Zero-based. */
  page: number;
  size: number;
};

const DEFAULT_FILTERS: Filters = {
  activity: ALL,
  actorId: ALL,
  period: "any",
  fromDate: "",
  toDate: "",
  record: null,
  back: null,
  page: 0,
  size: 20,
};

const activityParams = (activity: string): AuditLogQuery => {
  if (activity.startsWith("area:")) return { entity: activity.slice(5) };
  if (activity.startsWith("action:")) return { action: activity.slice(7) };
  return {};
};

/** Local-day boundaries, so "Today" means the viewer's today. */
const periodParams = (f: Filters): AuditLogQuery => {
  const today = startOfDay(new Date());
  if (f.period === "today") return { from: today.toISOString() };
  if (f.period === "7d") return { from: subDays(today, 6).toISOString() };
  if (f.period === "30d") return { from: subDays(today, 29).toISOString() };
  if (f.period === "custom") {
    return {
      ...(f.fromDate ? { from: parseISO(f.fromDate).toISOString() } : {}),
      ...(f.toDate ? { to: addDays(parseISO(f.toDate), 1).toISOString() } : {}),
    };
  }
  return {};
};

const toQuery = (f: Filters): AuditLogQuery => ({
  ...activityParams(f.activity),
  ...(f.record ? { entity: f.record.entity, entityId: f.record.id } : {}),
  ...(f.actorId !== ALL ? { actorId: f.actorId } : {}),
  ...periodParams(f),
  page: f.page + 1,
  size: f.size,
});

const dayLabel = (date: Date) =>
  isToday(date)
    ? "Today"
    : isYesterday(date)
      ? "Yesterday"
      : format(date, "EEEE, d MMM yyyy");

const groupByDay = (items: AuditLogEntry[]) => {
  const groups: { key: string; label: string; items: AuditLogEntry[] }[] = [];
  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(date), items: [item] });
  }
  return groups;
};

export function AuditLogPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const update = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch, page: 0 }));

  const params = toQuery(filters);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: rbacKeys.auditLog(params),
    queryFn: () => rbacApi.auditLog(params),
    placeholderData: keepPreviousData,
  });

  const { data: actors = [] } = useQuery({
    queryKey: rbacKeys.auditActors,
    queryFn: () => rbacApi.auditActors(),
    staleTime: 5 * 60 * 1000,
  });

  const actorOptions = useMemo(
    () => [
      { label: "Anyone", value: ALL },
      ...actors.map((a) => ({
        label: a.id === user?.id ? `${actorName(a)} (you)` : actorName(a),
        value: a.id,
        hint: a.email,
      })),
    ],
    [actors, user?.id],
  );

  const groups = useMemo(() => groupByDay(data?.items ?? []), [data]);

  const hasFilters =
    filters.activity !== ALL ||
    filters.actorId !== ALL ||
    filters.period !== "any";

  const clearFilters = () =>
    setFilters((f) => ({
      ...DEFAULT_FILTERS,
      record: f.record,
      back: f.back,
      size: f.size,
    }));

  const openHistory = (record: HistoryRecord) =>
    setFilters((f) => ({
      ...DEFAULT_FILTERS,
      record,
      back: f.record ? f.back : f,
      size: f.size,
    }));

  const closeHistory = () =>
    setFilters((f) => f.back ?? { ...DEFAULT_FILTERS, size: f.size });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          A record of important changes: who made them, when, and what changed.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4">
        <FilterField label="Activity" htmlFor="audit-activity">
          <Select
            value={filters.activity}
            onValueChange={(activity) => update({ activity })}
          >
            <SelectTrigger id="audit-activity" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All activity</SelectItem>
              {AUDIT_AREAS.map((area) => (
                <SelectGroup key={area.entity}>
                  <SelectSeparator />
                  <SelectLabel>{area.label}</SelectLabel>
                  <SelectItem value={`area:${area.entity}`}>
                    {area.allLabel}
                  </SelectItem>
                  {area.actions.map((a) => (
                    <SelectItem key={a.action} value={`action:${a.action}`}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Changed by" htmlFor="audit-actor">
          <Combobox
            id="audit-actor"
            className="h-9 min-h-9 w-56 rounded-md"
            options={actorOptions}
            value={filters.actorId}
            onChange={(actorId) => update({ actorId: actorId || ALL })}
            placeholder="Anyone"
            searchPlaceholder="Search people…"
            emptyText="No one by that name"
          />
        </FilterField>

        <FilterField label="Period" htmlFor="audit-period">
          <Select
            value={filters.period}
            onValueChange={(period) => update({ period: period as Period })}
          >
            <SelectTrigger id="audit-period" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {filters.period === "custom" && (
          <>
            <FilterField label="From" htmlFor="audit-from">
              <Input
                id="audit-from"
                type="date"
                className="w-40"
                value={filters.fromDate}
                max={filters.toDate || undefined}
                onChange={(e) => update({ fromDate: e.target.value })}
              />
            </FilterField>
            <FilterField label="To" htmlFor="audit-to">
              <Input
                id="audit-to"
                type="date"
                className="w-40"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(e) => update({ toDate: e.target.value })}
              />
            </FilterField>
          </>
        )}

        {hasFilters && (
          <Button variant="ghost" size="lg" onClick={clearFilters}>
            <IconX aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      {filters.record && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <IconHistory aria-hidden size={16} className="shrink-0 text-primary" />
            <span>
              Showing every change to {filters.record.type.toLowerCase()}{" "}
              <span className="font-medium">{filters.record.name}</span>
            </span>
          </p>
          <Button variant="outline" onClick={closeHistory}>
            <IconArrowLeft aria-hidden />
            Back to all activity
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Time</TableHead>
              <TableHead>Changed by</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody
            aria-busy={isFetching}
            className={cn(
              "transition-opacity",
              isFetching && !isLoading && "opacity-60",
            )}
          >
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-64" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && isError && (
              <TableEmptyState
                colSpan={COLUMN_COUNT}
                icon={IconAlertTriangle}
                message="Couldn’t load the audit log"
                description="Check your connection and try again."
                action={
                  <Button variant="outline" onClick={() => refetch()}>
                    Try again
                  </Button>
                }
              />
            )}

            {!isLoading && !isError && groups.length === 0 && (
              <TableEmptyState
                colSpan={COLUMN_COUNT}
                icon={hasFilters ? IconFilterOff : IconListSearch}
                message={
                  hasFilters
                    ? "No changes match these filters"
                    : "Nothing has been recorded yet"
                }
                description={
                  hasFilters
                    ? "Try a different activity, person or period."
                    : "Changes to roles, user access, vendor payments, trips and journeys will appear here."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            )}

            {!isError &&
              groups.map((group) => (
                <Fragment key={group.key}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="bg-muted/40 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      {group.label}
                    </TableCell>
                  </TableRow>
                  {group.items.map((entry) => (
                    <AuditLogRow
                      key={entry.id}
                      entry={entry}
                      isMe={entry.actorId === user?.id}
                      canOpenHistory={!filters.record}
                      onOpenHistory={openHistory}
                    />
                  ))}
                </Fragment>
              ))}
          </TableBody>
        </Table>

        {data && data.total > 0 && (
          <TablePaginationFooter
            total={data.total}
            page={filters.page}
            size={filters.size}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onSizeChange={(size) => update({ size })}
          />
        )}
      </div>
    </div>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const TONE_DOT: Record<AuditTone, string> = {
  positive: "bg-success",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground/50",
};

function AuditLogRow({
  entry,
  isMe,
  canOpenHistory,
  onOpenHistory,
}: {
  entry: AuditLogEntry;
  isMe: boolean;
  canOpenHistory: boolean;
  onOpenHistory: (record: HistoryRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const described = describeAuditEntry(entry);

  return (
    <TableRow>
      <TableCell className="align-top text-muted-foreground">
        <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
          {format(new Date(entry.createdAt), "h:mm a")}
        </time>
      </TableCell>

      <TableCell className="align-top">
        <div className="flex items-center gap-2" title={entry.actor?.email}>
          <Avatar className="size-6">
            <AvatarFallback className="text-xs">
              {actorInitials(entry.actor)}
            </AvatarFallback>
          </Avatar>
          <span>{actorName(entry.actor)}</span>
          {isMe && <span className="text-muted-foreground">(you)</span>}
        </div>
      </TableCell>

      <TableCell className="align-top whitespace-normal">
        <div className="flex items-center gap-2 font-medium">
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", TONE_DOT[described.tone])}
          />
          {described.activity}
        </div>
        <div className="pl-4">
          {canOpenHistory ? (
            <button
              type="button"
              onClick={() =>
                onOpenHistory({
                  entity: entry.entity,
                  id: entry.entityId,
                  name: described.recordName,
                  type: described.recordType,
                })
              }
              title={`See every change to this ${described.recordType.toLowerCase()}`}
              className="rounded-sm text-left text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {described.recordName}
            </button>
          ) : (
            <span className="text-muted-foreground">{described.recordName}</span>
          )}
        </div>
      </TableCell>

      <TableCell className="min-w-80 align-top whitespace-normal">
        <Collapsible open={open} onOpenChange={setOpen}>
          <p className="max-w-xl">{described.summary}</p>
          {described.changes.length > 0 && (
            <>
              <CollapsibleTrigger className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <IconChevronRight
                  aria-hidden
                  className={cn("size-3.5 transition-transform", open && "rotate-90")}
                />
                {open ? "Hide details" : "Show details"}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AuditChangeList changes={described.changes} />
              </CollapsibleContent>
            </>
          )}
        </Collapsible>
      </TableCell>
    </TableRow>
  );
}

function AuditChangeList({ changes }: { changes: AuditChange[] }) {
  return (
    <dl className="mt-2 grid max-w-xl grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-sm border border-border bg-muted/30 p-3">
      {changes.map((change, i) => (
        <Fragment key={`${change.label}-${i}`}>
          <dt className="text-muted-foreground">
            {change.kind === "items" ? (
              <span className="inline-flex items-center gap-1">
                {change.tone === "added" && (
                  <IconPlus aria-hidden className="size-3.5 text-success" />
                )}
                {change.tone === "removed" && (
                  <IconMinus aria-hidden className="size-3.5 text-destructive" />
                )}
                {change.label} ({change.items.length})
              </span>
            ) : (
              change.label
            )}
          </dt>
          <dd className="min-w-0">
            {change.kind === "field" && (
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="sr-only">Changed from</span>
                <span className="text-muted-foreground line-through">
                  {change.before}
                </span>
                <IconArrowRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="sr-only">to</span>
                <span className="font-medium">{change.after}</span>
              </span>
            )}
            {change.kind === "items" && (
              <AuditItemChips items={change.items} tone={change.tone} />
            )}
            {change.kind === "note" && (
              <span className="break-words">{change.text}</span>
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

const CHIP_LIMIT = 8;

const CHIP_TONE: Record<"added" | "removed" | "neutral", string> = {
  added: "border-success/30 bg-success/10",
  removed: "border-destructive/30 bg-destructive/5",
  neutral: "border-border bg-card",
};

function AuditItemChips({
  items,
  tone,
}: {
  items: AuditItem[];
  tone: "added" | "removed" | "neutral";
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, CHIP_LIMIT);
  const hidden = items.length - visible.length;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {visible.map((item, i) => (
        <li
          key={`${item.title ?? item.label}-${i}`}
          title={item.title}
          className={cn(
            "rounded-sm border px-1.5 py-0.5 text-xs text-foreground",
            CHIP_TONE[tone],
          )}
        >
          {item.label}
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-sm px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            +{hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}
