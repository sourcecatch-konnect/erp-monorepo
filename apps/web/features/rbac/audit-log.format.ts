import { permissionLabel } from "@skerp/types";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import type { AuditActor, AuditLogEntry } from "./types";

/**
 * Turns a raw audit row (`action` + `before`/`after` JSON) into plain-language
 * copy for the audit log screen. Each known action has its own describer;
 * anything else falls back to a labelled field-by-field comparison, so a new
 * audit action never shows up as raw JSON.
 */

export type AuditItem = { label: string; title?: string };

export type AuditChange =
  | { kind: "field"; label: string; before: string; after: string }
  | {
      kind: "items";
      label: string;
      tone: "added" | "removed" | "neutral";
      items: AuditItem[];
    }
  | { kind: "note"; label: string; text: string };

export type AuditTone = "positive" | "negative" | "neutral";

export type AuditDescription = {
  /** What happened, e.g. "Role renamed". */
  activity: string;
  tone: AuditTone;
  /** The kind of record, e.g. "Role" or "Payment slip". */
  recordType: string;
  /** The record it happened to, e.g. "Branch Manager" or "VPS/25-26/0012". */
  recordName: string;
  /** One readable sentence; complete on its own for simple actions. */
  summary: string;
  /** The finer detail, shown on demand. */
  changes: AuditChange[];
};

/* ------------------------------------------------------------------ */
/* Known activity                                                      */
/* ------------------------------------------------------------------ */
// One list drives both the activity filter and the row labels, so the two
// never disagree. Add an entry here whenever the server records a new action.

export type AuditArea = {
  entity: string;
  /** Group heading in the filter, e.g. "Roles". */
  label: string;
  /** "All role changes" — the area-wide option in the filter. */
  allLabel: string;
  /** Singular record name shown next to it, e.g. "Role". */
  recordType: string;
  actions: { action: string; label: string }[];
};

export const AUDIT_AREAS: AuditArea[] = [
  {
    entity: "Role",
    label: "Roles",
    allLabel: "All role changes",
    recordType: "Role",
    actions: [
      { action: "role.create", label: "Role created" },
      { action: "role.update", label: "Role renamed" },
      { action: "role.delete", label: "Role deleted" },
      { action: "role.permissions.update", label: "Role permissions changed" },
    ],
  },
  {
    entity: "User",
    label: "User access",
    allLabel: "All user access changes",
    recordType: "User",
    actions: [
      { action: "user.role.update", label: "User role changed" },
      { action: "user.branches.update", label: "User branch access changed" },
      { action: "user.permissions.update", label: "User permissions changed" },
      { action: "user.status.update", label: "User activated or deactivated" },
      { action: "user.delete", label: "User deleted" },
    ],
  },
  {
    entity: "VendorPaymentSlip",
    label: "Vendor payments",
    allLabel: "All vendor payment activity",
    recordType: "Payment slip",
    actions: [
      { action: "vendor_payment.submit", label: "Payment slip submitted" },
      { action: "vendor_payment.approve", label: "Payment slip approved" },
      { action: "vendor_payment.reject", label: "Payment slip rejected" },
      { action: "vendor_payment.disburse", label: "Payment made" },
      { action: "vendor_payment.cancel", label: "Payment slip cancelled" },
    ],
  },
  {
    entity: "VehicleTrip",
    label: "Trips",
    allLabel: "All trip corrections",
    recordType: "Trip",
    actions: [
      { action: "trip.correct_in_transit", label: "In-transit trip corrected" },
      { action: "trip.correct_closed", label: "Closed trip corrected" },
    ],
  },
  {
    entity: "VehicleJourney",
    label: "Journeys",
    allLabel: "All journey activity",
    recordType: "Journey",
    actions: [
      {
        action: "vehicle_journey.reopen_settlement",
        label: "Journey settlement reopened",
      },
    ],
  },
];

const ACTIVITY_LABELS = new Map(
  AUDIT_AREAS.flatMap((area) =>
    area.actions.map((a) => [a.action, a.label] as const),
  ),
);
const RECORD_TYPES = new Map(
  AUDIT_AREAS.map((area) => [area.entity, area.recordType]),
);

/* ------------------------------------------------------------------ */
/* Value helpers                                                       */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const EM_DASH = "—";

const asRecord = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== ""
    ? value
    : typeof value === "number"
      ? String(value)
      : null;

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

const quote = (value: string) => `“${value}”`;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const lowerFirst = (value: string) =>
  value.charAt(0).toLowerCase() + value.slice(1);

const upperFirst = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** "a, b and c" */
const joinList = (parts: string[]) =>
  parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const ACRONYMS = new Set([
  "rbac",
  "lr",
  "grn",
  "mrrr",
  "gst",
  "fy",
  "km",
  "id",
  "pnl",
]);
/** Turn internal field names and status values into readable text. */
const humanize = (value: string) => {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.toLowerCase(),
    );
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

const permissionItems = (keys: string[]): AuditItem[] =>
  keys
    .map((key) => ({ label: permissionLabel(key), title: key }))
    .sort((a, b) => a.label.localeCompare(b.label));

const dateValue = (value: unknown) => {
  const s = str(value);
  return s ? formatDateTime(s) : EM_DASH;
};
const paiseValue = (value: unknown) =>
  formatPaise(
    typeof value === "number" || typeof value === "string" ? value : null,
  );
const kmValue = (value: unknown) =>
  typeof value === "number" ? `${value.toLocaleString("en-IN")} km` : EM_DASH;
const textValue = (value: unknown) => str(value) ?? EM_DASH;
const enumValue = (value: unknown) => {
  const s = str(value);
  return s ? humanize(s) : EM_DASH;
};

/* ------------------------------------------------------------------ */
/* Describers                                                          */
/* ------------------------------------------------------------------ */

type Ctx = {
  before: Json;
  after: Json;
  /** Display name for an id, when the server could resolve it. */
  ref: (id: string | null) => string | null;
};

type Described = Omit<
  AuditDescription,
  "activity" | "recordType" | "recordName"
>;

const reasonNote = (value: unknown, label = "Reason"): AuditChange[] => {
  const text = str(value);
  return text ? [{ kind: "note", label, text }] : [];
};

const itemsChange = (
  label: string,
  tone: "added" | "removed" | "neutral",
  items: AuditItem[],
): AuditChange[] =>
  items.length ? [{ kind: "items", label, tone, items }] : [];

/** ["gave 2 …", null, "took away 1 …"] → "Gave 2 … and took away 1 …" */
const sentence = (parts: (string | null)[]) =>
  upperFirst(joinList(parts.filter((p): p is string => p !== null)));

type FieldSpec = { key: string; label: string; format: (v: unknown) => string };

/** Field-level before → after rows, only for values that actually changed. */
const fieldChanges = (ctx: Ctx, specs: FieldSpec[]): AuditChange[] =>
  specs.flatMap(({ key, label, format }) => {
    if (!(key in ctx.after)) return [];
    const before = format(ctx.before[key]);
    const after = format(ctx.after[key]);
    return before === after
      ? []
      : [{ kind: "field" as const, label, before, after }];
  });

const changedSummary = (changes: AuditChange[]) => {
  const labels = changes
    .filter((c) => c.kind === "field")
    .map((c) => lowerFirst(c.label));
  return labels.length
    ? `Changed ${joinList(labels)}.`
    : "Saved without changing any values.";
};

const TRIP_FIELDS: FieldSpec[] = [
  { key: "startDateTime", label: "Start time", format: dateValue },
  { key: "arrivalDateTime", label: "Arrival time", format: dateValue },
  {
    key: "unloadingCompletedAt",
    label: "Unloading finished",
    format: dateValue,
  },
  { key: "endDateTime", label: "End time", format: dateValue },
  { key: "closingKm", label: "Closing KM", format: kmValue },
  { key: "onwardFreight", label: "Onward freight", format: paiseValue },
  { key: "closeReason", label: "Closing remark", format: textValue },
];

const describeTripCorrection = (ctx: Ctx): Described => {
  const fields = fieldChanges(ctx, TRIP_FIELDS);
  return {
    tone: "neutral",
    summary: changedSummary(fields),
    changes: [...fields, ...reasonNote(ctx.after.correctionReason)],
  };
};

const DESCRIBERS: Record<string, (ctx: Ctx) => Described> = {
  /* --- Roles ------------------------------------------------------ */
  "role.create": ({ after, ref }) => {
    const source = str(after.copiedFrom);
    return {
      tone: "positive",
      summary: source
        ? `Copied from ${quote(ref(source) ?? "a role that no longer exists")}, including all of its permissions.`
        : "New role. It starts with no permissions.",
      changes: [],
    };
  },

  "role.update": ({ before, after }) => ({
    tone: "neutral",
    summary: `Renamed from ${quote(str(before.name) ?? EM_DASH)} to ${quote(str(after.name) ?? EM_DASH)}.`,
    changes: [],
  }),

  "role.delete": ({ before }) => ({
    tone: "negative",
    summary: `The role ${quote(str(before.name) ?? EM_DASH)} was permanently deleted.`,
    changes: [],
  }),

  "role.permissions.update": ({ before, after }) => {
    const was = new Set(strings(before.permissionKeys));
    const now = new Set(strings(after.permissionKeys));
    const granted = [...now].filter((k) => !was.has(k));
    const removed = [...was].filter((k) => !now.has(k));

    return {
      tone: "neutral",
      summary:
        granted.length || removed.length
          ? `${sentence([
              granted.length
                ? `gave ${plural(granted.length, "new permission")}`
                : null,
              removed.length
                ? `took away ${plural(removed.length, "permission")}`
                : null,
            ])}. The role now has ${plural(now.size, "permission")}.`
          : "Saved without changing any permissions.",
      changes: [
        ...itemsChange("Granted", "added", permissionItems(granted)),
        ...itemsChange("Removed", "removed", permissionItems(removed)),
      ],
    };
  },

  /* --- User access ------------------------------------------------ */
  "user.role.update": ({ before, after, ref }) => {
    const roleName = (id: string | null) =>
      id ? quote(ref(id) ?? "a role that no longer exists") : null;
    const from = roleName(str(before.roleId));
    const to = roleName(str(after.roleId)) ?? quote(EM_DASH);
    return {
      tone: "neutral",
      summary: from
        ? `Role changed from ${from} to ${to}.`
        : `Given the role ${to}.`,
      changes: [],
    };
  },

  "user.branches.update": ({ before, after, ref }) => {
    const branchItems = (ids: string[]): AuditItem[] =>
      ids
        .map((id) => ({ label: ref(id) ?? "Deleted branch", title: id }))
        .sort((a, b) => a.label.localeCompare(b.label));

    if (str(after.branchScope) === "ALL") {
      return {
        tone: "neutral",
        summary: "Can now see and work in all branches.",
        changes: [],
      };
    }

    const was = new Set(strings(before.branchIds));
    const now = strings(after.branchIds);
    const added = now.filter((id) => !was.has(id));
    const removed = [...was].filter((id) => !now.includes(id));

    return {
      tone: "neutral",
      summary:
        added.length || removed.length
          ? `${sentence([
              added.length
                ? `added ${plural(added.length, "branch", "branches")}`
                : null,
              removed.length
                ? `removed ${plural(removed.length, "branch", "branches")}`
                : null,
            ])}. Now limited to ${plural(now.length, "branch", "branches")}.`
          : `Limited to ${plural(now.length, "specific branch", "specific branches")}.`,
      changes: [
        ...itemsChange("Added", "added", branchItems(added)),
        ...itemsChange("Removed", "removed", branchItems(removed)),
        ...itemsChange("Has access to", "neutral", branchItems(now)),
      ],
    };
  },

  "user.status.update": ({ after }) =>
    after.status === true
      ? {
          tone: "positive",
          summary: "Activated. They can sign in again.",
          changes: [],
        }
      : {
          tone: "negative",
          summary: "Deactivated. They can no longer sign in.",
          changes: [],
        },

  "user.delete": ({ before }) => ({
    tone: "negative",
    summary: `${quote(str(before.name) ?? EM_DASH)} (${str(before.email) ?? EM_DASH}) was permanently deleted.`,
    changes: [],
  }),

  "user.permissions.update": ({ before, after }) => {
    const effects = (value: unknown) =>
      new Map(
        (Array.isArray(value) ? value : []).flatMap((o) => {
          const r = asRecord(o);
          const key = str(r.key);
          const effect = str(r.effect);
          return key && effect ? [[key, effect] as const] : [];
        }),
      );
    const was = effects(before.overrides);
    const now = effects(after.overrides);

    const allowed = [...now]
      .filter(([k, e]) => e === "GRANT" && was.get(k) !== e)
      .map(([k]) => k);
    const blocked = [...now]
      .filter(([k, e]) => e === "DENY" && was.get(k) !== e)
      .map(([k]) => k);
    const reset = [...was.keys()].filter((k) => !now.has(k));

    return {
      tone: "neutral",
      summary:
        allowed.length || blocked.length || reset.length
          ? `${sentence([
              allowed.length
                ? `allowed ${plural(allowed.length, "extra permission")}`
                : null,
              blocked.length
                ? `blocked ${plural(blocked.length, "permission")}`
                : null,
              reset.length
                ? `put ${plural(reset.length, "permission")} back to the role’s default`
                : null,
            ])}.`
          : "Saved without changing any permissions.",
      changes: [
        ...itemsChange("Allowed", "added", permissionItems(allowed)),
        ...itemsChange("Blocked", "removed", permissionItems(blocked)),
        ...itemsChange(
          "Back to role default",
          "neutral",
          permissionItems(reset),
        ),
      ],
    };
  },

  /* --- Vendor payments -------------------------------------------- */
  "vendor_payment.submit": ({ after }) => ({
    tone: "neutral",
    summary:
      str(after.decision) === "AUTO_APPROVE"
        ? "Submitted and approved automatically — no manual approval was needed."
        : "Submitted and waiting for approval.",
    changes: [],
  }),

  "vendor_payment.approve": () => ({
    tone: "positive",
    summary: "Approved and ready to be paid.",
    changes: [],
  }),

  "vendor_payment.reject": ({ after }) => ({
    tone: "negative",
    summary: "Rejected and sent back to draft for correction.",
    changes: reasonNote(after.reason),
  }),

  "vendor_payment.disburse": ({ after }) => ({
    tone: "positive",
    summary: `Paid ${paiseValue(after.paidPaise)} to the vendor.`,
    changes: [],
  }),

  "vendor_payment.cancel": ({ after }) => ({
    tone: "negative",
    summary:
      after.wasApproved === true
        ? "Cancelled after approval. The accounting entry was reversed."
        : "Cancelled before it was approved.",
    changes: reasonNote(after.reason),
  }),

  /* --- Trips & journeys ------------------------------------------- */
  "trip.correct_in_transit": describeTripCorrection,
  "trip.correct_closed": describeTripCorrection,

  "vehicle_journey.reopen_settlement": (ctx) => {
    const fields = fieldChanges(ctx, [
      { key: "status", label: "Journey status", format: enumValue },
      {
        key: "settlementStatus",
        label: "Settlement status",
        format: enumValue,
      },
    ]);
    return {
      tone: "neutral",
      summary: "Reopened so the settlement can be reviewed again.",
      changes: [...fields, ...reasonNote(ctx.after.reason)],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Fallback for actions without a describer                            */
/* ------------------------------------------------------------------ */

const genericValue = (key: string, value: unknown, ctx: Ctx): string => {
  if (value === null || value === undefined || value === "") return EM_DASH;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/paise$/i.test(key)) return paiseValue(value);
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) return formatDateTime(value);
    if (/^[A-Z][A-Z0-9_]+$/.test(value)) return humanize(value);
    return ctx.ref(value) ?? value;
  }
  if (Array.isArray(value)) {
    if (value.some((v) => v !== null && typeof v === "object")) {
      return plural(value.length, "entry", "entries");
    }
    return value.length
      ? value.map((v) => genericValue(key, v, ctx)).join(", ")
      : "None";
  }
  return JSON.stringify(value);
};

/** "roleId" → "Role", "amountPaise" → "Amount", "driverIds" → "Drivers" */
const genericLabel = (key: string) =>
  humanize(key.replace(/Ids$/, "s").replace(/(Id|Paise)$/, ""));

/** Plumbing the server records for its own sake — meaningless to a reader. */
const HIDDEN_KEYS = new Set([
  "clientRequestId",
  "requestId",
  "idempotencyKey",
  "version",
]);

const PAST_TENSE: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
  pay: "paid",
  submit: "submitted",
  disburse: "disbursed",
  close: "closed",
  reopen: "reopened",
  post: "posted",
  generate: "generated",
  issue: "issued",
  finalise: "finalised",
  reverse: "reversed",
  settle: "settled",
  assign: "assigned",
};
const POSITIVE_VERBS = new Set([
  "create",
  "approve",
  "pay",
  "disburse",
  "post",
  "settle",
  "issue",
]);
const NEGATIVE_VERBS = new Set(["delete", "cancel", "reject", "reverse"]);

/** "driver_finance.salary_run.pay" → "Salary run paid". Unknown verbs → the whole action. */
const genericActivity = (action: string) => {
  const parts = action.split(".");
  const verb = parts.at(-1) ?? "";
  const object = parts.at(-2);
  const past = PAST_TENSE[verb];
  return past && object ? humanize(`${object} ${past}`) : humanize(action);
};

const genericTone = (action: string): AuditTone => {
  const verb = action.split(".").at(-1) ?? "";
  return POSITIVE_VERBS.has(verb)
    ? "positive"
    : NEGATIVE_VERBS.has(verb)
      ? "negative"
      : "neutral";
};

const idItems = (ids: string[], ctx: Ctx): AuditItem[] =>
  ids
    .map((id) => {
      const name = ctx.ref(id);
      return name ? { label: name } : { label: `#${id.slice(-6)}`, title: id };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

const INLINE_ITEMS = 3;
const INLINE_LENGTH = 140;

/** One change as a short "Label: value" fact for the summary line. */
const fact = (change: AuditChange) => {
  if (change.kind === "note") return `${change.label}: ${change.text}`;
  if (change.kind === "field")
    return `${change.label}: ${change.before} → ${change.after}`;
  const names = change.items.map((i) => i.label);
  const shown =
    names.length > INLINE_ITEMS
      ? [...names.slice(0, 2), `${names.length - 2} more`]
      : names;
  return `${change.label}: ${joinList(shown)}`;
};

const describeGeneric = (action: string, ctx: Ctx): Described => {
  const keys = [
    ...new Set([...Object.keys(ctx.before), ...Object.keys(ctx.after)]),
  ].filter((key) => !HIDDEN_KEYS.has(key));

  const changes = keys.flatMap((key): AuditChange[] => {
    const isReason = /reason$/i.test(key);
    const label = isReason ? "Reason" : genericLabel(key);
    const inBefore = key in ctx.before;
    const inAfter = key in ctx.after;

    // Lists of ids (driverIds, branchIds, …) read best as name chips.
    if (/Ids$/.test(key)) {
      if (inBefore && inAfter) {
        const was = new Set(strings(ctx.before[key]));
        const now = strings(ctx.after[key]);
        return [
          ...itemsChange(
            `${label} added`,
            "added",
            idItems(
              now.filter((id) => !was.has(id)),
              ctx,
            ),
          ),
          ...itemsChange(
            `${label} removed`,
            "removed",
            idItems(
              [...was].filter((id) => !now.includes(id)),
              ctx,
            ),
          ),
        ];
      }
      return itemsChange(
        label,
        "neutral",
        idItems(strings(inAfter ? ctx.after[key] : ctx.before[key]), ctx),
      );
    }

    // Recorded on one side only (or a free-text reason): a plain fact, not a change.
    if (isReason || !inBefore || !inAfter) {
      const text = genericValue(
        key,
        inAfter ? ctx.after[key] : ctx.before[key],
        ctx,
      );
      return [{ kind: "note", label, text }];
    }
    const before = genericValue(key, ctx.before[key], ctx);
    const after = genericValue(key, ctx.after[key], ctx);
    return before === after ? [] : [{ kind: "field", label, before, after }];
  });

  if (changes.length === 0) {
    return {
      tone: genericTone(action),
      summary: "No further details were recorded.",
      changes,
    };
  }

  // Lead with the facts themselves, as many as fit on a line.
  const facts = changes.map(fact);
  const shown: string[] = [];
  let length = 0;
  for (const f of facts) {
    if (shown.length > 0 && length + f.length > INLINE_LENGTH) break;
    shown.push(f);
    length += f.length + 3;
  }
  const rest = facts.length - shown.length;
  const summary = rest
    ? `${shown.join(" · ")} · and ${plural(rest, "more detail")}`
    : shown.join(" · ");

  // Everything already fits in the summary → nothing to expand.
  const complete =
    rest === 0 &&
    changes.every((c) => c.kind !== "items" || c.items.length <= INLINE_ITEMS);

  return {
    tone: genericTone(action),
    summary,
    changes: complete ? [] : changes,
  };
};

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export const describeAuditEntry = (entry: AuditLogEntry): AuditDescription => {
  const refs = entry.refs ?? {};
  const ctx: Ctx = {
    before: asRecord(entry.before),
    after: asRecord(entry.after),
    ref: (id) => (id ? (refs[id] ?? null) : null),
  };

  const describer = DESCRIBERS[entry.action];
  const described = describer
    ? describer(ctx)
    : describeGeneric(entry.action, ctx);

  return {
    ...described,
    activity:
      ACTIVITY_LABELS.get(entry.action) ?? genericActivity(entry.action),
    recordType: RECORD_TYPES.get(entry.entity) ?? humanize(entry.entity),
    // Current name first; a deleted role still carries its name in the payload.
    recordName:
      refs[entry.entityId] ??
      str(ctx.before.name) ??
      str(ctx.after.name) ??
      `#${entry.entityId.slice(-6)}`,
  };
};

export const actorName = (actor: AuditActor | null) =>
  actor ? `${actor.firstName} ${actor.lastName}`.trim() : "Unknown user";

export const actorInitials = (actor: AuditActor | null) =>
  actor
    ? `${actor.firstName.charAt(0)}${actor.lastName.charAt(0)}`.toUpperCase()
    : "?";
