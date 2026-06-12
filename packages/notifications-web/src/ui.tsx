"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconAlertTriangle,
  IconArchive,
  IconBell,
  IconBrandWhatsapp,
  IconChecks,
  IconChevronDown,
  IconDeviceFloppy,
  IconExternalLink,
  IconFilter,
  IconFlask,
  IconInbox,
  IconMail,
  IconMessage2,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconTrash,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@skerp/ui/components/Card";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@skerp/ui/components/collapsible";
import { Input } from "@skerp/ui/components/input";
import { Label } from "@skerp/ui/components/lable";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Separator } from "@skerp/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@skerp/ui/components/sheet";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Switch } from "@skerp/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import { Textarea } from "@skerp/ui/components/textarea";
import type { InboxParams, NotificationApi } from "./api";
import { notificationKeys } from "./keys";
import { useNotificationSocket } from "./socket";
import type {
  InAppNotification,
  MetaTemplateStatus,
  NotificationChannel,
  NotificationMetadata,
  NotificationRule,
  NotificationSeverity,
  NotificationTemplate,
  UserOption,
} from "./types";

const channelLabels: Record<NotificationChannel, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

const channelIcon: Record<NotificationChannel, typeof IconBell> = {
  IN_APP: IconBell,
  EMAIL: IconMail,
  WHATSAPP: IconBrandWhatsapp,
};

type StatusTone = "info" | "success" | "warning" | "critical" | "neutral";

const toneDot: Record<StatusTone, string> = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  neutral: "bg-muted-foreground",
};

// Neutral chip + a solid colour dot — conveys state by colour AND text, stays
// high-contrast in light/dark, and reads as restrained rather than loud.
function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
      <span className={`size-1.5 rounded-full ${toneDot[tone]}`} />
      {label}
    </span>
  );
}

const severityTone: Record<NotificationSeverity, StatusTone> = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  CRITICAL: "critical",
};

function SeverityBadge({ severity }: { severity: NotificationSeverity }) {
  return <StatusPill tone={severityTone[severity]} label={severity} />;
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function ChannelChip({
  channel,
  active,
  onClick,
  disabled,
}: {
  channel: NotificationChannel;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = channelIcon[channel];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm transition-colors ${active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <Icon size={14} />
      {channelLabels[channel]}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof IconBell;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border px-6 py-12 text-center">
      <Icon size={28} className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

function NotificationRow({
  notification,
  onRead,
  onArchive,
}: {
  notification: InAppNotification;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const unread = !notification.readAt;

  return (
    <div className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className={`mt-1 size-2 rounded-full ${unread ? "bg-primary" : "bg-muted"}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">
            {notification.title}
          </p>
          <SeverityBadge severity={notification.severity} />
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {notification.body}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </span>
          {notification.linkUrl && (
            <a
              href={notification.linkUrl}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open <IconExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {unread && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Mark notification as read"
            onClick={() => onRead(notification.id)}
          >
            <IconChecks />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Archive notification"
          onClick={() => onArchive(notification.id)}
        >
          <IconArchive />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell({
  api,
  socketUrl,
  inboxHref = "/notifications",
  preferencesHref = "/notifications/preferences",
}: {
  api: NotificationApi;
  socketUrl: string;
  inboxHref?: string;
  preferencesHref?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const inboxParams = useMemo<InboxParams>(() => ({ page: 0, size: 10 }), []);

  const unread = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: api.unreadCount,
  });
  const inbox = useQuery({
    queryKey: notificationKeys.inbox(inboxParams),
    queryFn: () => api.listInbox(inboxParams),
    enabled: open,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: notificationKeys.all });
  }, [qc]);

  useNotificationSocket({
    socketUrl,
    onNotification: useCallback(
      (notification: InAppNotification) => {
        invalidate();
        if (
          notification.severity === "WARNING" ||
          notification.severity === "CRITICAL"
        ) {
          toast(notification.title, { description: notification.body });
        }
      },
      [invalidate],
    ),
  });

  const markRead = useMutation({
    mutationFn: api.markRead,
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: api.markAllRead,
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: api.archive,
    onSuccess: invalidate,
  });

  const count = unread.data?.count || 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Open notifications"
        >
          <IconBell />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border py-3 pl-4 pr-12">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>Notifications</SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => inbox.refetch()}
                aria-label="Refresh notifications"
              >
                <IconRefresh />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => markAllRead.mutate()}
              >
                Mark all read
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {inbox.isLoading &&
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-2 border-b border-border p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}

          {!inbox.isLoading && !inbox.data?.data.length && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}

          {inbox.data?.data.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onRead={(id) => markRead.mutate(id)}
              onArchive={(id) => archive.mutate(id)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <Button asChild variant="outline" size="sm">
            <a href={preferencesHref}>
              <IconSettings /> Preferences
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={inboxHref}>View all</a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function NotificationInboxPage({ api }: { api: NotificationApi }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severity, setSeverity] = useState<NotificationSeverity | "ALL">("ALL");
  const params = { page, size: 25, unread: unreadOnly, severity };

  const inbox = useQuery({
    queryKey: notificationKeys.inbox(params),
    queryFn: () => api.listInbox(params),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({
    mutationFn: api.markRead,
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: api.markAllRead,
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: api.archive,
    onSuccess: invalidate,
  });

  const total = inbox.data?.meta.total || 0;
  const maxPage = Math.max(0, Math.ceil(total / 25) - 1);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Review operational alerts and message history.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => markAllRead.mutate()}
        >
          <IconChecks /> Mark all read
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-4 rounded-sm border border-border bg-card p-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={unreadOnly}
            onCheckedChange={(value) => {
              setUnreadOnly(Boolean(value));
              setPage(0);
            }}
          />
          Unread only
        </label>
        <div className="flex items-center gap-2">
          <IconFilter size={15} className="text-muted-foreground" />
          <Select
            value={severity}
            onValueChange={(value) => {
              setSeverity(value as NotificationSeverity | "ALL");
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All severities</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {inbox.isLoading ? (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="space-y-2 border-b border-border p-4 last:border-b-0"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : !inbox.data?.data.length ? (
        <EmptyState
          icon={IconInbox}
          title="No notifications"
          hint="Nothing matches this view yet."
        />
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          {inbox.data.data.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onRead={(id) => markRead.mutate(id)}
              onArchive={(id) => archive.mutate(id)}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {total} notification{total === 1 ? "" : "s"}
          </span>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={page === 0}
                  className={page === 0 ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 0) setPage((value) => value - 1);
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground">
                  Page {page + 1} of {maxPage + 1}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={page >= maxPage}
                  className={
                    page >= maxPage ? "pointer-events-none opacity-50" : ""
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < maxPage) setPage((value) => value + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

export function NotificationPreferencesPanel({
  api,
}: {
  api: NotificationApi;
}) {
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: api.preferences,
  });
  const metadata = useQuery({
    queryKey: notificationKeys.metadata,
    queryFn: api.metadata,
  });
  const [mobile, setMobile] = useState("");
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!prefs.data) return;
    setMobile(prefs.data.user?.mobile || "");
    setEmailOptIn(Boolean(prefs.data.user?.emailOptIn));
    setWhatsappOptIn(Boolean(prefs.data.user?.whatsappOptIn));
    setSubscriptions(
      Object.fromEntries(
        prefs.data.subscriptions.map((sub) => [
          `${sub.eventType}:${sub.channel}`,
          sub.subscribed,
        ]),
      ),
    );
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.preferences });
      toast.success("Notification preferences saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const eventTypes = metadata.data?.eventTypes || [];
  const channels = metadata.data?.channels || [];
  const isCritical = (eventType: string) =>
    eventTypes.some((event) => event.eventType === eventType && event.critical);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Notification preferences
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose how SKERP should reach you for non-critical alerts.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; channels</CardTitle>
          <p className="text-sm text-muted-foreground">
            How SKERP reaches you. WhatsApp also needs a mobile number.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FieldLabel label="Mobile number">
            <Input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="919999999999"
            />
          </FieldLabel>
          <label className="flex items-center justify-between gap-2 rounded-sm border border-border px-3 text-sm md:mt-6">
            <span className="flex items-center gap-2">
              <IconMail size={16} className="text-muted-foreground" /> Email
            </span>
            <Switch checked={emailOptIn} onCheckedChange={setEmailOptIn} />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-sm border border-border px-3 text-sm md:mt-6">
            <span className="flex items-center gap-2">
              <IconBrandWhatsapp size={16} className="text-muted-foreground" />{" "}
              WhatsApp
            </span>
            <Switch
              checked={whatsappOptIn}
              onCheckedChange={setWhatsappOptIn}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border py-4">
          <CardTitle>Event subscriptions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick which events reach you on each channel. Critical alerts are
            always delivered.
          </p>
        </CardHeader>
        <div className="divide-y divide-border">
          {eventTypes.map((event) => (
            <div
              key={event.eventType}
              className="grid items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                  {event.eventType}
                </code>
                {isCritical(event.eventType) && (
                  <StatusPill tone="critical" label="Critical" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => {
                  const key = `${event.eventType}:${channel}`;
                  const checked = isCritical(event.eventType)
                    ? true
                    : (subscriptions[key] ?? true);
                  const Icon = channelIcon[channel];
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-1.5 text-sm ${isCritical(event.eventType)
                          ? "text-muted-foreground"
                          : ""
                        }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isCritical(event.eventType)}
                        onCheckedChange={(value) =>
                          setSubscriptions((current) => ({
                            ...current,
                            [key]: Boolean(value),
                          }))
                        }
                      />
                      <Icon size={14} />
                      {channelLabels[channel]}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Button
        type="button"
        disabled={save.isPending}
        onClick={() =>
          save.mutate({
            mobile: mobile.trim() || null,
            emailOptIn,
            whatsappOptIn,
            subscriptions: eventTypes.flatMap((event) =>
              channels.map((channel) => ({
                eventType: event.eventType,
                channel,
                subscribed: isCritical(event.eventType)
                  ? true
                  : (subscriptions[`${event.eventType}:${channel}`] ?? true),
              })),
            ),
          })
        }
      >
        <IconDeviceFloppy /> Save preferences
      </Button>
    </div>
  );
}

// A rule is "dirty" when the local draft diverges from the saved rule. Channel
// order is irrelevant to equality, so normalise it before comparing.
const sameRule = (a: NotificationRule, b: NotificationRule) =>
  JSON.stringify({ ...a, channels: [...a.channels].sort() }) ===
  JSON.stringify({ ...b, channels: [...b.channels].sort() });

// Compact, glanceable channel state for the collapsed row: lit = active.
function ChannelSummary({
  all,
  active,
}: {
  all: NotificationChannel[];
  active: NotificationChannel[];
}) {
  const activeLabels = active.map((channel) => channelLabels[channel]);
  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">
        {activeLabels.length
          ? `Channels: ${activeLabels.join(", ")}`
          : "No channels selected"}
      </span>
      {all.map((channel) => {
        const Icon = channelIcon[channel];
        const on = active.includes(channel);
        return (
          <span
            key={channel}
            aria-hidden
            title={`${channelLabels[channel]}: ${on ? "on" : "off"}`}
            className={`inline-flex size-6 items-center justify-center rounded-sm border ${on
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground/40"
              }`}
          >
            <Icon size={13} />
          </span>
        );
      })}
    </div>
  );
}

function RuleEditor({
  api,
  rule,
  metadata,
  templates,
}: {
  api: NotificationApi;
  rule: NotificationRule;
  metadata: NotificationMetadata;
  templates: NotificationTemplate[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(rule);
  useEffect(() => setDraft(rule), [rule]);

  const save = useMutation({
    mutationFn: api.updateRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.rules });
      toast.success("Rule saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const dirty = useMemo(() => !sameRule(draft, rule), [draft, rule]);
  const persist = (next: NotificationRule) =>
    save.mutate({ id: rule.id, body: next });

  const toggleChannel = (channel: NotificationChannel) => {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  };

  // The header switch is the headline action — toggle a rule live in one click,
  // no expand or Save needed. It persists the current draft immediately.
  const handleEnabledToggle = (enabled: boolean) => {
    const next = { ...draft, enabled };
    setDraft(next);
    persist(next);
  };

  const noChannels = draft.channels.length === 0;
  const eventTemplates = templates.filter(
    (template) => template.code === rule.eventType,
  );

  return (
    <Card className="gap-0 py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <IconChevronDown
                size={16}
                className="shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
              <span className="min-w-0 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {rule.name}
                  </span>
                  <SeverityBadge severity={draft.severity} />
                  {draft.critical && (
                    <StatusPill tone="critical" label="Critical" />
                  )}
                  {dirty && <StatusPill tone="warning" label="Unsaved" />}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <code className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {rule.eventType}
                  </code>
                  {rule.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {rule.description}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </CollapsibleTrigger>

          <ChannelSummary all={metadata.channels} active={draft.channels} />

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              {draft.enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={handleEnabledToggle}
              disabled={save.isPending}
              aria-label={`${draft.enabled ? "Disable" : "Enable"} ${rule.name}`}
            />
          </label>
        </div>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border px-4 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              <FieldLabel label="Severity">
                <Select
                  value={draft.severity}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      severity: value as NotificationSeverity,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metadata.severities.map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {severity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldLabel>
              <FieldLabel label="Recipients">
                <Select
                  value={draft.recipientResolverKey}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      recipientResolverKey: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metadata.recipientResolvers.map((resolver) => (
                      <SelectItem key={resolver.key} value={resolver.key}>
                        {resolver.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldLabel>
              <FieldLabel label="Template">
                <Select
                  value={draft.templateId || "none"}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      templateId: value === "none" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template</SelectItem>
                    {eventTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {channelLabels[template.channel]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldLabel>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Channels
              </span>
              <div
                role="group"
                aria-label="Delivery channels"
                className="flex flex-wrap gap-2"
              >
                {metadata.channels.map((channel) => (
                  <ChannelChip
                    key={channel}
                    channel={channel}
                    active={draft.channels.includes(channel)}
                    onClick={() => toggleChannel(channel)}
                  />
                ))}
              </div>
              {noChannels && (
                <p role="alert" className="text-xs text-destructive">
                  Select at least one channel to save this rule.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.critical}
                  onCheckedChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      critical: Boolean(value),
                    }))
                  }
                />
                <span>
                  Critical — always delivered, recipients can&apos;t opt out
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft(rule)}
                  disabled={!dirty || save.isPending}
                >
                  <IconRefresh /> Reset
                </Button>
                <Button
                  size="sm"
                  onClick={() => persist(draft)}
                  disabled={!dirty || save.isPending || noChannels}
                >
                  <IconDeviceFloppy /> Save rule
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

type RuleStatusFilter = "all" | "enabled" | "disabled";

function StatusFilter({
  value,
  onChange,
  counts,
}: {
  value: RuleStatusFilter;
  onChange: (value: RuleStatusFilter) => void;
  counts: Record<RuleStatusFilter, number>;
}) {
  const options: { key: RuleStatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "enabled", label: "Enabled" },
    { key: "disabled", label: "Disabled" },
  ];
  return (
    <div
      role="group"
      aria-label="Filter rules by status"
      className="inline-flex items-center gap-0.5 rounded-sm border border-border p-0.5"
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
          >
            {option.label}
            <span className={active ? "opacity-80" : "opacity-60"}>
              {counts[option.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RulesPage({ api }: { api: NotificationApi }) {
  const rules = useQuery({
    queryKey: notificationKeys.rules,
    queryFn: api.rules,
  });
  const templates = useQuery({
    queryKey: notificationKeys.templates,
    queryFn: api.templates,
  });
  const metadata = useQuery({
    queryKey: notificationKeys.metadata,
    queryFn: api.metadata,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RuleStatusFilter>("all");

  const all = rules.data ?? [];
  const counts = useMemo<Record<RuleStatusFilter, number>>(
    () => ({
      all: all.length,
      enabled: all.filter((rule) => rule.enabled).length,
      disabled: all.filter((rule) => !rule.enabled).length,
    }),
    [all],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all.filter((rule) => {
      if (status === "enabled" && !rule.enabled) return false;
      if (status === "disabled" && rule.enabled) return false;
      if (!query) return true;
      return (
        rule.name.toLowerCase().includes(query) ||
        rule.eventType.toLowerCase().includes(query) ||
        (rule.description?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [all, search, status]);

  if (rules.isLoading || templates.isLoading || metadata.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full max-w-md" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!all.length) {
    return (
      <EmptyState
        icon={IconWorld}
        title="No rules yet"
        hint="Notification rules appear here once seeded."
      />
    );
  }

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Label htmlFor="rule-search" className="sr-only">
            Search rules
          </Label>
          <IconSearch
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="rule-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or event…"
            className="pl-8"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconX size={15} />
            </button>
          )}
        </div>
        <StatusFilter value={status} onChange={setStatus} counts={counts} />
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {all.length}{" "}
        {all.length === 1 ? "rule" : "rules"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={IconFilter}
          title="No matching rules"
          hint={
            search
              ? `Nothing matches “${search}”. Try a different name or event type.`
              : "No rules match the current filter."
          }
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((rule) => (
            <RuleEditor
              key={rule.id}
              api={api}
              rule={rule}
              metadata={metadata.data!}
              templates={templates.data || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const metaStatusTone: Record<MetaTemplateStatus, StatusTone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "critical",
  DISABLED: "neutral",
};

function WhatsAppStatusBadge({
  status,
}: {
  status: MetaTemplateStatus | null;
}) {
  const value = status || "DRAFT";
  return <StatusPill tone={metaStatusTone[value]} label={value} />;
}

type EventGroup = { code: string; channels: NotificationTemplate[] };

const groupTemplatesByEvent = (
  templates: NotificationTemplate[],
): EventGroup[] => {
  const order = ["IN_APP", "EMAIL", "WHATSAPP"];
  const map = new Map<string, NotificationTemplate[]>();
  for (const template of templates) {
    const list = map.get(template.code) || [];
    list.push(template);
    map.set(template.code, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, channels]) => ({
      code,
      channels: channels.sort(
        (a, b) => order.indexOf(a.channel) - order.indexOf(b.channel),
      ),
    }));
};

function VariableChips({ variables }: { variables: string[] }) {
  if (!variables.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Variables:</span>
      {variables.map((variable) => (
        <code
          key={variable}
          className="rounded-sm bg-muted px-1.5 py-0.5"
        >{`{{${variable}}}`}</code>
      ))}
    </div>
  );
}

function InternalTemplateEditor({
  api,
  template,
  variables,
}: {
  api: NotificationApi;
  template: NotificationTemplate;
  variables: string[];
}) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState(template.subject || "");
  const [body, setBody] = useState(template.body);

  const save = useMutation({
    mutationFn: api.updateTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.templates });
      toast.success("Template saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <FieldLabel label="Subject">
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </FieldLabel>
      <FieldLabel label="Body">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
        />
      </FieldLabel>
      <VariableChips variables={variables} />
      <Button
        onClick={() =>
          save.mutate({
            id: template.id,
            body: { subject: subject || null, body },
          })
        }
        disabled={save.isPending || !body.trim()}
      >
        <IconDeviceFloppy /> Save template
      </Button>
    </div>
  );
}

function WhatsAppTemplateEditor({
  api,
  template,
  variables,
  configured,
}: {
  api: NotificationApi;
  template: NotificationTemplate;
  variables: string[];
  configured: boolean;
}) {
  const qc = useQueryClient();
  const [metaName, setMetaName] = useState(template.metaName || "");
  const [metaLanguage, setMetaLanguage] = useState(
    template.metaLanguage || "en_US",
  );
  const [metaFooter, setMetaFooter] = useState(template.metaFooter || "");
  const [body, setBody] = useState(template.body);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: notificationKeys.templates });
  const locked = Boolean(template.metaTemplateId); // name/language fixed after creation

  const saveDraft = useMutation({
    mutationFn: api.saveWhatsappDraft,
    onSuccess: () => {
      invalidate();
      toast.success("Draft saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const submit = useMutation({
    mutationFn: api.submitWhatsappTemplate,
    onSuccess: () => {
      invalidate();
      toast.success("Submitted to Meta for approval");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: api.deleteWhatsappTemplate,
    onSuccess: () => {
      invalidate();
      toast.success("Template removed from Meta");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const busy = saveDraft.isPending || submit.isPending || remove.isPending;
  const draftBody = {
    body,
    metaName: metaName || undefined,
    metaLanguage,
    metaFooter: metaFooter.trim() ? metaFooter.trim() : null,
  };

  const handleSubmit = async () => {
    // Persist the latest edits, then submit/resubmit to Meta.
    await saveDraft.mutateAsync({ id: template.id, body: draftBody });
    submit.mutate(template.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconBrandWhatsapp size={18} className="text-success" />
          <span className="text-sm font-medium">WhatsApp template</span>
          <WhatsAppStatusBadge status={template.metaStatus} />
        </div>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          UTILITY
        </span>
      </div>

      {template.metaStatus === "REJECTED" && template.metaRejectedReason && (
        <div className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Rejected by Meta: {template.metaRejectedReason}</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <FieldLabel label="Template name">
          <Input
            value={metaName}
            disabled={locked}
            onChange={(event) =>
              setMetaName(
                event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
              )
            }
            placeholder="order_confirmed"
          />
          {locked && (
            <span className="text-xs text-muted-foreground">
              Name is fixed once submitted to Meta.
            </span>
          )}
        </FieldLabel>
        <FieldLabel label="Language">
          <Select
            value={metaLanguage}
            onValueChange={setMetaLanguage}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en_US">English (US)</SelectItem>
              <SelectItem value="en_GB">English (UK)</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">Hindi</SelectItem>
            </SelectContent>
          </Select>
        </FieldLabel>
      </div>

      <FieldLabel label="Body">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
        />
      </FieldLabel>
      <VariableChips variables={variables} />

      <FieldLabel label="Footer (optional)">
        <Input
          value={metaFooter}
          maxLength={60}
          onChange={(event) => setMetaFooter(event.target.value)}
          placeholder="SKERP"
        />
      </FieldLabel>

      {!configured && (
        <div className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <IconAlertTriangle
            size={14}
            className="mt-0.5 shrink-0 text-warning"
          />
          <span>
            Meta WhatsApp isn&apos;t configured. Set the API base URL, business
            account ID and access token to submit or edit templates.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={busy || !body.trim()}
          onClick={() => saveDraft.mutate({ id: template.id, body: draftBody })}
        >
          Save draft
        </Button>
        <Button
          disabled={busy || !configured || !body.trim()}
          onClick={handleSubmit}
        >
          <IconSend /> {locked ? "Submit edit" : "Submit for approval"}
        </Button>
        {(template.metaTemplateId || template.metaStatus === "PENDING") && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy || !configured}
            onClick={() => remove.mutate(template.id)}
          >
            <IconTrash /> Delete
          </Button>
        )}
      </div>
      {locked && (
        <p className="text-xs text-muted-foreground">
          Editing an approved template resubmits it to Meta and returns it to
          Pending; WhatsApp sends are skipped until it&apos;s approved again.
        </p>
      )}
    </div>
  );
}

function TemplatesPage({ api }: { api: NotificationApi }) {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: notificationKeys.templates,
    queryFn: api.templates,
  });
  const metadata = useQuery({
    queryKey: notificationKeys.metadata,
    queryFn: api.metadata,
  });
  const config = useQuery({
    queryKey: notificationKeys.whatsappConfig,
    queryFn: api.whatsappConfig,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const autoSynced = useRef(false);

  const sync = useMutation({
    mutationFn: api.syncWhatsappTemplates,
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.templates, data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Pull live Meta statuses once when the tab opens, if configured.
  useEffect(() => {
    if (config.data?.configured && !autoSynced.current) {
      autoSynced.current = true;
      sync.mutate();
    }
  }, [config.data?.configured, sync]);

  const groups = useMemo(
    () => groupTemplatesByEvent(templates.data || []),
    [templates.data],
  );

  const selected =
    templates.data?.find((template) => template.id === selectedId) ||
    templates.data?.[0] ||
    null;
  const variables = selected
    ? metadata.data?.templateVariables[selected.code] || []
    : [];
  const configured = Boolean(config.data?.configured);

  if (templates.isLoading || metadata.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          One template per event. In-app and email use the body directly;
          WhatsApp is sent through a Meta-approved template.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!configured || sync.isPending}
          onClick={() => sync.mutate()}
        >
          <IconRefresh /> Refresh statuses
        </Button>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          <IconAlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-warning"
          />
          <span>
            Meta WhatsApp isn&apos;t configured, so WhatsApp templates
            can&apos;t be submitted or synced. In-app and email templates work
            normally.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="max-h-[70vh] self-start divide-y divide-border overflow-y-auto rounded-sm border border-border bg-card">
          {groups.map((group) => (
            <div key={group.code}>
              <div className="bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {group.code}
              </div>
              {group.channels.map((template) => {
                const Icon = channelIcon[template.channel];
                const active = selected?.id === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors ${active
                        ? "border-primary bg-primary/5 font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50"
                      }`}
                    onClick={() => setSelectedId(template.id)}
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        size={15}
                        className={active ? "text-primary" : ""}
                      />
                      {channelLabels[template.channel]}
                    </span>
                    {template.channel === "WHATSAPP" && (
                      <WhatsAppStatusBadge status={template.metaStatus} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {selected && (
          <Card className="self-start lg:sticky lg:top-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = channelIcon[selected.channel];
                  return <Icon size={18} className="text-muted-foreground" />;
                })()}
                <CardTitle>{selected.code}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                {channelLabels[selected.channel]} template
              </p>
            </CardHeader>
            <CardContent>
              {selected.channel === "WHATSAPP" ? (
                <WhatsAppTemplateEditor
                  key={selected.id}
                  api={api}
                  template={selected}
                  variables={variables}
                  configured={configured}
                />
              ) : (
                <InternalTemplateEditor
                  key={selected.id}
                  api={api}
                  template={selected}
                  variables={variables}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TestSendPage({
  api,
  loadUsers,
}: {
  api: NotificationApi;
  loadUsers?: () => Promise<UserOption[]>;
}) {
  const users = useQuery({
    queryKey: ["notification-user-options"],
    queryFn: loadUsers || (async () => []),
    enabled: Boolean(loadUsers),
  });
  const metadata = useQuery({
    queryKey: notificationKeys.metadata,
    queryFn: api.metadata,
  });
  const templates = useQuery({
    queryKey: notificationKeys.templates,
    queryFn: api.templates,
  });

  const [mode, setMode] = useState<"quick" | "event">("quick");
  const [recipientUserId, setRecipientUserId] = useState("");
  const [title, setTitle] = useState("SKERP test notification");
  const [message, setMessage] = useState(
    "This is a test notification from SKERP.",
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(["IN_APP"]);
  const [eventType, setEventType] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});

  const send = useMutation({
    mutationFn: api.testSend,
    onSuccess: () => toast.success("Test notification queued"),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const toggle = (channel: NotificationChannel) =>
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );

  const eventOptions = (metadata.data?.eventTypes || []).filter(
    (event) => event.eventType !== "notification_test",
  );
  const eventVariables = eventType
    ? metadata.data?.templateVariables[eventType] || []
    : [];
  const waTemplate = templates.data?.find(
    (template) =>
      template.code === eventType && template.channel === "WHATSAPP",
  );
  const waApproved = waTemplate?.metaStatus === "APPROVED";

  const canSend =
    Boolean(recipientUserId) &&
    channels.length > 0 &&
    !send.isPending &&
    (mode === "quick" || Boolean(eventType));

  const handleSend = () => {
    if (mode === "event") {
      send.mutate({ recipientUserId, channels, eventType, payload: vars });
    } else {
      send.mutate({ recipientUserId, channels, title, message });
    }
  };

  const modeTab = (value: "quick" | "event", label: string) => (
    <button
      type="button"
      className={`rounded-sm px-3 py-1 transition-colors ${mode === value
          ? "bg-card font-medium text-foreground shadow-sm"
          : "text-muted-foreground"
        }`}
      onClick={() => setMode(value)}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="inline-flex rounded-sm border border-border bg-muted/50 p-0.5 text-sm">
        {modeTab("quick", "Quick test")}
        {modeTab("event", "Event test")}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <FieldLabel label="Recipient">
            {loadUsers ? (
              <Select
                value={recipientUserId}
                onValueChange={setRecipientUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.data?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={recipientUserId}
                onChange={(event) => setRecipientUserId(event.target.value)}
                placeholder="User id"
              />
            )}
          </FieldLabel>

          {mode === "quick" ? (
            <>
              <FieldLabel label="Title">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Message">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                />
              </FieldLabel>
            </>
          ) : (
            <>
              <FieldLabel label="Event">
                <Select
                  value={eventType}
                  onValueChange={(value) => {
                    setEventType(value);
                    setVars({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventOptions.map((event) => (
                      <SelectItem key={event.eventType} value={event.eventType}>
                        {event.eventType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldLabel>
              {eventVariables.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {eventVariables.map((variable) => (
                    <FieldLabel key={variable} label={variable}>
                      <Input
                        value={vars[variable] || ""}
                        onChange={(event) =>
                          setVars((current) => ({
                            ...current,
                            [variable]: event.target.value,
                          }))
                        }
                        placeholder={`Sample ${variable}`}
                      />
                    </FieldLabel>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Channels
            </span>
            <div className="flex flex-wrap gap-2">
              {(["IN_APP", "EMAIL", "WHATSAPP"] as NotificationChannel[]).map(
                (channel) => {
                  const waBlocked =
                    mode === "event" && channel === "WHATSAPP" && !waApproved;
                  return (
                    <ChannelChip
                      key={channel}
                      channel={channel}
                      active={channels.includes(channel)}
                      disabled={waBlocked}
                      onClick={() => toggle(channel)}
                    />
                  );
                },
              )}
            </div>
          </div>

          {mode === "event" && eventType && !waApproved && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <IconAlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-warning"
              />
              <span>
                WhatsApp is unavailable for this event until its Meta template
                is approved
                {waTemplate?.metaStatus
                  ? ` (currently ${waTemplate.metaStatus})`
                  : ""}
                . Submit it from the Templates tab.
              </span>
            </p>
          )}

          <div className="border-t border-border pt-3">
            <Button disabled={!canSend} onClick={handleSend}>
              <IconSend /> Send test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function NotificationAdminSetupPage({
  api,
  loadUsers,
}: {
  api: NotificationApi;
  loadUsers?: () => Promise<UserOption[]>;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Notifications setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure ERP alert rules, message templates, and WhatsApp template
          approvals.
        </p>
      </header>
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5">
            <IconWorld size={15} /> Rules
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <IconMessage2 size={15} /> Templates
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-1.5">
            <IconFlask size={15} /> Test send
          </TabsTrigger>
        </TabsList>
        <Separator className="my-4" />
        <TabsContent value="rules">
          <RulesPage api={api} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesPage api={api} />
        </TabsContent>
        <TabsContent value="test">
          <TestSendPage api={api} loadUsers={loadUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { IconBell, IconMail };
