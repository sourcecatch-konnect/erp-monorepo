# OPUS UI Suggestions — SK ERP UX Roadmap

> Generated from a repo scan of `apps/web` (Claude / Opus session, July 2026).
> Suggestions only — nothing here is implemented. Every item respects the
> design-system non-negotiables in `llm-guideline/design.md` and the
> architecture invariants in `MASTER_MODULE_PLAN.md` (vertical slices,
> composition-not-dispatch, tokens-not-raw-colors, `@skerp/ui` primitives).
>
> Legend used throughout:
> **Impact** = how much daily-operator pain it removes. **Effort** = rough build size
> (S = hours, M = days, L = week+, XL = multi-week). **Deps** = what it builds on.

---

## 0. TL;DR — the ten moves that matter most

| # | Item | Impact | Effort | Why first |
|---|------|--------|--------|-----------|
| 1 | Real home dashboard (role-aware widgets) | ★★★★★ | L | `app/(dashboard)/dashboard/page.tsx` is still a placeholder — the front door of the ERP is empty |
| 2 | Global command palette (Ctrl+K) | ★★★★★ | M | Navigation + record jump + actions; `masterRegistry` already provides the nav index |
| 3 | Quick-create inside entity comboboxes | ★★★★★ | M | Operators abandon half-filled LRs to go create a missing customer/route today |
| 4 | Saved views + column filters on tables | ★★★★☆ | L | Ops staff live in list pages; search-only toolbar is not enough |
| 5 | Fix master categories in `registry.ts` | ★★★★☆ | S | All 23 masters are `category: "Location"`; the type literally only allows `"Location"` |
| 6 | Shared `StatusBadge` + record lifecycle timeline | ★★★★☆ | M | Four parallel `*-ui.tsx` status files exist (order, trip, tracking, LR) — unify |
| 7 | Draft autosave + unsaved-changes guard on big forms | ★★★★☆ | M | Losing a 12-line LR to a session refresh is how users learn to hate an ERP |
| 8 | Peek drawer (generalise `OrderQuickViewModal`) | ★★★★☆ | M | Triage from list pages without navigation |
| 9 | E-way bill expiry triage (countdown chips, bulk extend) | ★★★★☆ | M | Compliance misses have direct rupee cost |
| 10 | Print/PDF views for LR + Log Slip | ★★★★☆ | M | LRs are physical documents; there is no print surface today |

---

## 1. Current-state notes from the scan

What exists and is good:

- **App shell** (`components/layout/AppShell.tsx`): collapsible icon sidebar,
  breadcrumb, notification bell, fixed-height internal scroll region. Solid frame.
- **Masters framework** (`features/masters/_shared/`): `MasterListPage`,
  `MasterTable`, `MasterFormDialog`, `MasterDetailDialog`, shared field library.
  23 masters registered.
- **Transactional flows**: orders (with `OrderTimeline`, `OrderQuickViewModal`,
  `ApproveOrderModal`), lorry receipts (create wizard pieces: `LRForm`,
  `LRLineDialog`, `LRCreateSummary`, `SplitAtHubDialog`, `FinaliseDialog`,
  `EwayBillSection`), trips (`CreateTripDialog`, `CloseTripDialog`,
  `TripDetail`), vehicle journeys, VP schedule, MRRR, log slip.
- **Cash planning**: queue / ledger / receivables / reports split, `StatCard`,
  `CompactMoney`, dedicated skeletons.
- **Tracking**: `FleetMap`, `WagonList`, `WagonPanel`, socket hook
  (`useTrackingSocket`) — live data pipeline already works.
- **E-way bills**: dashboard, inbox, detail.
- **RBAC admin**: roles, access, audit log pages; `useCan` / `<Can>` gating.

Known rough edges spotted while scanning (small, fix opportunistically):

- `features/masters/registry.ts` — every entry is `category: "Location"` and
  `MasterCategory` is a single-member union. Grouping is dead on arrival.
- `MasterListPage.tsx` pagination hand-rolls Prev/Next icon buttons instead of
  the `Pagination` primitive from `@skerp/ui` (violates CLAUDE.md list of
  non-negotiable primitives).
- Button busy-labels use raw strings ("Deleting...", "Importing...") — fine,
  but a shared `<Button loading>` prop with spinner would standardise it.
- Page-size select offers 10 / 25 / 30 — an odd set; 10 / 25 / 50 / 100 is the
  expected ladder.
- Dashboard page is a placeholder ("Modules will appear here…").

---

## 2. Cross-cutting advancements

These pay off in every module. Ordered roughly by leverage.

### 2.1 Command palette (Ctrl+K / Cmd+K) — the ERP power-user spine

**Impact ★★★★★ · Effort M · Deps: none (registry exists)**

Three modes in one dialog (cmdk or an equivalent built on `@skerp/ui` Dialog):

1. **Navigate** — every route + every master from `masterRegistry`, fuzzy
   matched, permission-filtered via `useCan`. Recently visited first.
2. **Go to record** — type/paste an LR number, order number, vehicle number,
   e-way bill number → jump straight to the detail page. Backed by one small
   `GET /search?q=` endpoint that fans out to indexed columns (docNo, vehicleNo,
   ewbNo, customer name). Debounced, permission-scoped, branch-scoped.
3. **Actions** — "Create LR", "Create Order", "Close trip…", "Switch branch".
   Each action is just a registered `{ label, icon, perm, run() }`.

Also register `?` to open a **keyboard shortcuts cheat sheet** and print the
active shortcut map. Suggested global map:

| Key | Action |
|-----|--------|
| `Ctrl+K` | Command palette |
| `?` | Shortcut cheat sheet |
| `g d` / `g o` / `g l` / `g t` | Go dashboard / orders / LRs / trips |
| `c` (on list pages) | Create new (same as primary button) |
| `/` (on list pages) | Focus search input |
| `↑/↓ + Enter` (tables) | Row focus + open |
| `e` (focused row) | Edit |

### 2.2 Home dashboard — replace the placeholder

**Impact ★★★★★ · Effort L · Deps: per-module count/summary endpoints**

A permission-gated widget grid (each widget wrapped in `<Can>`), so each role
sees only their world. Widget catalogue to build over time:

| Widget | Source | Role |
|--------|--------|------|
| Needs my attention (approvals, unfinalised LRs, unclosed trips) | orders/LR/trips | everyone |
| E-way bills expiring in 24h / 48h | ewaybill | ops |
| Trips in transit (count + mini `FleetMap`) | trips + tracking | ops / manager |
| Today's cash position (per account, from cash planning) | cash-planning | accounts |
| Payment queue pending approval | cash-planning | accounts |
| Branch throughput sparkline (LRs/day, 30d) | lorry-receipt | manager |
| Receivables ageing snapshot | cash-planning | accounts |
| Recent audit events (admin) | audit | admin |
| My drafts (autosaved forms, see 2.5) | local | everyone |

Rules: every number on a tile is a **link** to the pre-filtered list view that
produced it. Skeleton shimmer per tile while loading (never a page-level
spinner). Widgets are individually collapsible; layout persisted per user
(localStorage first, server prefs later).

### 2.3 Table platform upgrade (one shared investment)

**Impact ★★★★☆ · Effort L · Deps: `list.query.ts` already supports `filter[k]=v`**

Extend `MasterListPage` / `MasterTable` (and reuse in transactional list pages)
with, in priority order:

1. **URL-synced state** — page, size, sort, search, filters all in the query
   string. A filtered view becomes shareable, bookmarkable, refresh-proof, and
   back-button-friendly. This is the foundation for everything below.
2. **Column filters as chips** — per-column filter UI (select for enums/status,
   date-range for dates, async combobox for FK columns), rendered as removable
   chips above the table. Server already parses `filter[k]=v`.
3. **Saved views** — named bundles of (filters + sort + visible columns +
   density): "My pending LRs", "This week's trips". Per user. localStorage
   first; promote to a `user_view` table when cross-device matters.
4. **Density toggle** — comfortable / compact (py-1 rows, text-xs allowed for
   data cells at compact only if it stays ≥ 12px — otherwise keep text-sm).
5. **Column pinning + sticky header** — first column and actions column pinned;
   header sticks within the scroll region the AppShell already provides.
6. **Keyboard navigation** — roving row focus (↑/↓), Enter opens, `e` edits,
   Space toggles selection. Visible focus ring on the focused row.
7. **Row virtualization** — only when a view legitimately renders 200+ rows
   (tracking wagon list, audit log). TanStack Virtual pairs with TanStack Table.
8. **Bulk actions bar** — when rows are selected, a fixed bar slides up from the
   bottom of the table region: n selected · Delete · Export selected · (module
   verbs: Finalise, Extend, Approve). Replaces the toolbar-swap pattern.
9. **Export current view** — export respects active filters/columns, not just
   the whole table. Offer CSV now, XLSX later.
10. **Footer aggregates** — sum/avg row for money columns (freight, expenses)
    computed server-side for the filtered set, not just the visible page.

Also: replace the hand-rolled Prev/Next with the `Pagination` primitive, and
widen the page-size ladder to 10/25/50/100.

### 2.4 Entity pickers — async combobox + quick-create

**Impact ★★★★★ · Effort M · Deps: crud factory list endpoints (exist)**

One shared `EntityCombobox` field in `_shared/fields/`:

- Async search against the master's list endpoint (debounced, min 2 chars).
- **Recently used first** (per user, per entity type, localStorage).
- Rich option rows where it helps: vehicle shows regNo + type; customer shows
  name + city; route shows origin → destination.
- **"+ Create new '<query>'"** as the last option → opens that master's
  existing `MasterFormDialog` in a nested sheet, pre-filled with the typed
  text; on save, the new record is selected in place. The form never loses
  state. This single pattern removes the worst data-entry dead end in the app.
- Keyboard complete: type → arrows → Enter, no mouse required.

### 2.5 Form platform: drafts, guards, duplication, speed

**Impact ★★★★☆ · Effort M**

- **Draft autosave** for multi-line forms (LR create, order create, trip create):
  serialize `react-hook-form` values to localStorage keyed by form + user,
  debounced 1s. On revisit, offer "Resume draft from 14:32?" Clear on submit.
- **Unsaved-changes guard** — one hook (`useUnsavedGuard(formState.isDirty)`)
  intercepting route change + tab close.
- **Duplicate from existing** — an action on order/LR/trip detail pages that
  opens the create form pre-filled (minus doc numbers/dates). Most transactional
  entries are near-copies of a previous one.
- **Keyboard-first line entry** — Enter advances to next field; `Ctrl+Enter`
  submits; `Alt+N` adds a line. Excel refugees judge the whole ERP on this.
- **Inline field validation** on blur from the shared Zod schemas (they're
  already the resolver — surface errors before submit, next to the field).
- **Sticky action footer** on long forms: Cancel / Save Draft / Submit always
  visible (AppShell's fixed-height scroll region makes this reliable).
- **Error summary** on failed submit: a small list at the top ("3 issues") where
  each item scrolls to and focuses the offending field.

### 2.6 Status system + lifecycle timeline (one primitive)

**Impact ★★★★☆ · Effort M**

- Promote a single `StatusBadge` into `@skerp/ui`: `variant` semantic map
  (draft = muted, active/in-transit = primary, success = green token,
  warning = amber token, blocked/expired = destructive), icon + label,
  consistent size. Migrate the per-feature styling in `order-ui.tsx`,
  `trip-ui.tsx`, `tracking-ui.tsx`, `lorry-receipt-ui.tsx` onto it.
- Generalise `OrderTimeline` into a shared `LifecycleTimeline` (steps +
  timestamps + actor) used by LR (draft → finalised → split → delivered),
  trips (created → dispatched → in transit → closed), e-way bills
  (generated → active → extended → expired).
- Color is never the only signal (icon + label always) — accessibility rule.

### 2.7 Peek drawer (quick view without navigation)

**Impact ★★★★☆ · Effort M · Deps: existing detail queries**

`OrderQuickViewModal` proves the pattern — generalise it as a right-side
`Sheet` (from `@skerp/ui`) openable from any list row (keyboard: Space or a
dedicated "peek" icon):

- Header: doc number + `StatusBadge` + primary action button.
- Body: the same detail sections, condensed; `LifecycleTimeline` at the bottom.
- Footer: "Open full page →".
- List page keeps its scroll/filter state; `←/→` inside the drawer moves to the
  previous/next row's record. Triage of 30 records becomes a two-minute task.

### 2.8 Notifications, done properly

**Impact ★★★☆☆ · Effort M · Deps: notifications module exists**

- Every notification **deep-links** to the exact record (and, where relevant,
  the exact tab: e.g. LR → attachments tab).
- **Grouping**: "3 orders await your approval" as one expandable row, not three.
- Severity tiers: info (bell only) / action-needed (bell + badge count) /
  critical (toast too — e-way bill expiring, trip overdue).
- Real-time via the socket layer that tracking already uses — reuse the
  connection, add a notifications channel.
- Preferences page already exists — add per-type channel matrix (in-app /
  email / digest) and a daily-digest option.
- Mark-all-read, and unread state that syncs across tabs (BroadcastChannel).

### 2.9 Record activity feed (audit surfaced in place)

**Impact ★★★★☆ · Effort S–M · Deps: audit log module (exists)**

An `ActivityFeed` tab/section on every detail page showing that record's audit
trail: "Rahul changed rate ₹1,200 → ₹1,350 · yesterday 16:12". Filter by field.
This is a trust feature: disputes over "who changed this" end instantly. The
data already exists — this is mostly a scoped query + a timeline renderer.

### 2.10 Dark mode

**Impact ★★★☆☆ · Effort M**

Token discipline (`bg-card`, `text-foreground`, warm oklch neutrals) means the
app is 90% ready. Work: define the dark oklch ramp in `globals.css`, wire
`next-themes` (class strategy), add the toggle to `NavUser`, and audit the few
places using raw colors (maps, charts, status colors need dark-adjusted tokens).
Respect `prefers-color-scheme` as the default; persist explicit choice.

### 2.11 Branch context, made visible

**Impact ★★★☆☆ · Effort S–M**

Users with multi-branch scope should see and control which branch they're
"acting in": a compact branch switcher in the topbar (next to the bell), the
current branch shown on create forms (pre-filled, changeable when scope
allows), and list pages defaulting to the active branch with an "All my
branches" chip. Prevents the classic wrong-branch entry mistake.

### 2.12 Empty states, loading states, error states — a policy

**Impact ★★★☆☆ · Effort S (per screen)**

- **Empty**: icon + one sentence + the primary CTA ("No LRs yet — Create LR").
  For filtered-empty, say so: "No results for these filters — Clear filters".
- **Loading**: Skeleton shimmer only (already a design rule) — shaped like the
  content it replaces (N table rows, tile-shaped blocks on dashboard).
- **Error**: inline retry card ("Couldn't load trips — Retry"), never a blank
  screen or a toast-only failure. One shared `QueryBoundary` wrapper makes this
  uniform over TanStack Query states.

### 2.13 Performance & perceived speed

**Impact ★★★☆☆ · Effort ongoing**

- **Prefetch on hover/focus** of row links (TanStack Query `prefetchQuery`) —
  detail pages open instantly.
- **Optimistic updates** for small mutations (toggle active, delete row) with
  toast + Undo (undo = restore mutation), instead of spinner-wait.
- Keep list queries `placeholderData: keepPreviousData` so pagination doesn't
  flash skeletons on every page turn.
- Route-level `loading.tsx` already exists for the dashboard group — add
  module-shaped skeletons per heavy route.
- Bundle hygiene: maps and charts loaded via `next/dynamic` only on their pages.

### 2.14 Accessibility floor (do these everywhere, non-negotiable)

- Visible focus ring on every interactive element (buttons, rows, chips).
- Icon-only buttons always have `aria-label` (pagination buttons already do —
  keep the standard).
- Dialogs trap focus and return it to the trigger (Radix handles this — don't
  break it with custom overlays).
- Status conveyed by icon + text, never color alone.
- `prefers-reduced-motion` respected by shared transition classes.
- All form fields labelled (shared field components should guarantee this).
- Contrast ≥ 4.5:1 — re-verify after the dark ramp lands.

### 2.15 Mobile & field usage

**Impact ★★★★☆ (for field roles) · Effort L–XL**

Near term (responsive web):
- List pages collapse to **card lists** under `md`: primary line = doc no +
  status badge; secondary = 2–3 key fields; tap = peek drawer (which is
  naturally mobile-friendly).
- Forms go single-column; sticky submit bar; comboboxes open as bottom sheets.
- Map pages get a collapsible panel (tracking's `WagonPanel` over the map).

Later (PWA "field mode"):
- Installable, camera access: trip expense capture with receipt photo →
  attachments module; POD photo upload against an LR.
- QR/barcode: print QR on LRs and wagon labels; scanning opens the record.
- Offline queue for the two or three field mutations that matter (expense,
  POD), synced when back online.

### 2.16 Print & document output

**Impact ★★★★☆ · Effort M**

ERPs produce paper. Today there is no print surface.

- **LR print view**: a dedicated `/lorry-receipts/[id]/print` route with print
  CSS (A4/A5, consignor/consignee blocks, goods table, terms, signature
  boxes) — browser print first, server PDF (Playwright/Chromium render of the
  same route) when email-attachment needs arrive.
- Same pattern for **Log Slip**, **Trip close summary**, and **Cash planning
  day sheet**.
- A `DocumentHeader` shared piece (company block from Company master + branch
  address + doc number + QR of the doc number).
- "Print" actions on detail pages; bulk print from list selection later.

---

## 3. Module-wise suggestions

### 3.1 Masters (all 23)

- **Fix categories** (S): widen `MasterCategory` to real groups —
  `Location` (state, city, area, route, warehouse), `Fleet` (vehicle, vehicle
  type, wagon, driver, pump, spare-*), `Parties` (customer, company, branch,
  transport, labour, creditor), `Commercial` (goods, agreement, rate matrix,
  railway freight), `Finance` (cash account). Sidebar and masters landing
  group by it.
- **Masters landing page** (M): searchable card grid grouped by category, each
  card showing record count and last-updated; permission-filtered.
- **Import wizard** (M–L): upload CSV → column-mapping step with preview
  (auto-map by header, manual remap) → dry-run validation → per-row error
  report with "download failed rows as CSV". Opaque bulk-import failure is the
  #1 masters complaint in any ERP.
- **Inline row editing** (M) for trivial masters (state, city, area): click a
  cell, edit, Enter saves — skip the dialog round-trip. Keep the dialog for
  masters with 5+ fields.
- **Merge duplicates** (L, later): pick two customers → field-by-field survivor
  chooser → repoint FKs server-side. Data hygiene tool that pays for itself.
- **Reference-count column** ("used in 42 LRs") with a guard message on delete
  attempts instead of a raw FK error.

### 3.2 Orders

- Generalised **peek drawer** (from `OrderQuickViewModal`) as the default row
  click; full page for deep work.
- **Kanban by status** as an optional view toggle (list ⇄ board) for the
  approval pipeline; drag between columns runs the same status mutations with
  permission checks.
- `ApproveOrderModal`: show a compact **diff of what approval changes**
  (status, downstream effects like LR eligibility) so approvers act informed.
- **Order → LR linkage panel**: on order detail, show generated LRs with their
  statuses (`LRFromOrderPickerDialog` implies the linkage exists — surface it
  both directions).
- Bulk approve with per-row result report (n approved, m failed and why).

### 3.3 Lorry Receipts (the flagship flow)

- **Stepped create with sticky summary**: Parties → Goods/Lines → Charges →
  Review. `LRCreateSummary` becomes a pinned right rail (desktop) that live
  updates; steps are navigable back/forward without loss (drafts, §2.5).
- **Line grid instead of per-line dialog**: replace the `LRLineDialog`
  open-fill-close loop with an inline editable grid — Tab/Enter navigation,
  `Alt+N` adds a row, per-cell Zod errors. This is the single biggest speed
  win for the ops team.
- **Split-at-hub visualization**: `SplitAtHubDialog` gains a simple diagram —
  origin → **Jalgaon hub** → destination legs with per-leg vehicle/transport
  assignment. A picture prevents mis-splits better than four dropdowns.
- **E-way bill inline chips** per line (`EwayBillSection`): status + expiry
  countdown; amber under 24h, destructive when expired; click chip → e-way
  detail.
- **Finalise checklist** in `FinaliseDialog`: enumerate blocking conditions
  (missing e-way bill, unassigned vehicle, zero-rate line) as check items
  rather than failing on submit.
- **LR print view** (§2.16).
- **POD (proof of delivery) surface**: attachments exist — give LR detail a
  dedicated POD slot with photo thumbnails and a "POD received" status that
  feeds the customer-facing story later.
- LR list: filter chips for status/branch/customer/date; saved views ("Awaiting
  finalise", "At hub").

### 3.4 Trips / Vehicle Journeys / VP Schedule

- **Journey visualization on trip detail**: route polyline with waypoints and
  the vehicle's live position from the tracking feature (the socket + positions
  pipeline already exists — join it). Show planned vs actual.
- **Close-trip checklist** in `CloseTripDialog`: expenses reconciled, PODs
  attached, closing km ≥ opening km, log slip generated — each with its state
  and a jump-link to fix.
- **Expense capture with receipt photo** (attachments module) and a running
  trip P&L strip on detail: freight vs expenses vs margin.
- **Trip board view**: columns = lifecycle stages, cards = trips with vehicle +
  driver + route; managers get a wall-view of the fleet's day.
- VP Schedule: calendar/timeline rendering (vehicles as rows, journeys as
  bars) instead of a flat table — conflicts and idle gaps become visible.
- Driver/vehicle pickers show **availability state** inline ("on trip until
  Thu") to prevent double-assignment at entry time.

### 3.5 Tracking (Onelap/Traccar)

- **Marker clustering** at low zoom; train icon + rail overlay already per plan.
- **Trail playback**: a time slider replaying the last 24h/7d of a selected
  wagon/vehicle's positions.
- **Panel ⇄ map sync**: hover in `WagonList` highlights the marker; select
  centers the map; map click selects in the panel.
- **Geofence events → notifications**: arrival at hub/railhead/destination
  raises an in-app notification deep-linking to the trip.
- **Stale-data honesty**: show "last seen 43 min ago" prominently; grey-out
  markers older than a threshold instead of pretending they're live.
- **Share live link**: tokenized, expiring public URL for a single
  trip/vehicle's position — a customer-facing feature that costs one route.
- ETA estimate against the route distance (even naive avg-speed ETA beats none).

### 3.6 Cash Planning

- **Daily cash sheet view**: opening balance → planned outflows (queue) →
  expected inflows (receivables) → projected closing, per cash account and
  pooled. This is the report the owner actually reads each morning.
- **Queue drag-to-reorder priority** with immediate projected-balance recompute
  as items move.
- **Maker/checker visual flow**: pending items visibly distinct; approve/reject
  inline with reason; approval events in the record activity feed (§2.9).
- Sparkline trends on `StatCard`s (7/30-day) — follow the dataviz skill rules
  when charts land: shared palette, table-alternative for accessibility.
- Receivables ageing as horizontal stacked bands (0–30/31–60/61–90/90+) with
  click-through to the filtered ledger.
- BigInt-paise formatting stays centralized in `CompactMoney` — extend it with
  a full-precision tooltip on hover (₹12.4L → ₹12,40,315.00).

### 3.7 E-way Bills

- **Expiry-driven inbox**: default sort = time-to-expiry ascending; countdown
  chips (green > 48h, amber < 24h, destructive expired); "expiring today"
  dashboard tile (§2.2).
- **Bulk extend** from selection with per-row outcome report.
- Inbox triage actions inline (extend / link to LR / dismiss) without opening
  detail.
- On LR and trip detail, the linked e-way bills render as chips with live
  status (§3.3) — one source component.

### 3.8 Notifications

Covered in §2.8 — deep links, grouping, severity tiers, socket delivery,
digest option, cross-tab read-state.

### 3.9 RBAC / Settings

- **"View as role" simulator**: pick a role → the client renders nav + actions
  as that role would see them (client-gating via `useCan` makes this nearly
  free). Turns role setup from guesswork into verification.
- **Permission matrix**: resources × actions grid with search, category
  collapse, and a **role diff** view (Role A vs Role B, differences
  highlighted).
- Role detail shows **member list** and "last used" per permission (from audit)
  to spot over-granted roles.
- Guard rails in UI: editing a `isSystem` role is visibly locked; removing your
  own admin perm warns explicitly.

### 3.10 Audit Log

- Filterable timeline: actor, module, action, date-range, record id — all as
  chips (table platform, §2.3).
- **Diff rendering** for update events: field, old → new, in a compact table
  instead of raw JSON.
- Per-record embed (§2.9) shares the same renderer.
- Export filtered audit slice to CSV for compliance requests.

### 3.11 Employees / Profile

- Profile page already hosts photo upload — extend to: theme preference
  (§2.10), notification preferences link, active sessions list ("logged in on
  2 devices — sign out others"), and personal saved-views management (§2.3).

### 3.12 MRRR / Log Slip / Attachments

- Log Slip: print view (§2.16) is the main need; entry form follows the form
  platform rules (drafts, keyboard-first).
- Attachments: a shared `AttachmentPanel` (grid of thumbnails, drag-drop
  upload, camera on mobile, type/size validation messages inline) reused by
  LR (POD), trips (receipts), MRRR — one component, three modules.

---

## 4. New shared primitives this roadmap implies

Everything above reduces to a short list of additions to `@skerp/ui` +
`features/masters/_shared/` (build once, use everywhere — per the composition
rule, no config-driven dispatch):

| Primitive | Used by | §
|---|---|---|
| `CommandPalette` (+ action registry) | global | 2.1 |
| `StatusBadge` (semantic variants) | orders, LR, trips, ewaybill, tracking | 2.6 |
| `LifecycleTimeline` | orders, LR, trips, ewaybill | 2.6 |
| `EntityCombobox` (async + quick-create) | every transactional form | 2.4 |
| `PeekSheet` (record drawer shell) | all list pages | 2.7 |
| `FilterChips` + `SavedViews` (table platform) | all list pages | 2.3 |
| `BulkActionsBar` | all list pages | 2.3 |
| `QueryBoundary` (empty/error/loading policy) | everywhere | 2.12 |
| `ActivityFeed` | all detail pages | 2.9 |
| `AttachmentPanel` | LR, trips, MRRR | 3.12 |
| `DocumentHeader` + print routes | LR, log slip, cash sheet | 2.16 |
| `Button loading` prop (spinner standard) | everywhere | 1 |
| `useUnsavedGuard`, `useDraftAutosave` | big forms | 2.5 |

---

## 5. Suggested phasing

**Phase 1 — foundations (highest leverage per hour)**
Registry categories fix · Pagination primitive compliance · URL-synced table
state · `StatusBadge` · `EntityCombobox` with quick-create · unsaved-changes
guard · empty/error-state policy via `QueryBoundary`.

**Phase 2 — daily-driver features**
Command palette · home dashboard (first 4 widgets) · column filter chips +
saved views · peek drawer · draft autosave · e-way expiry triage · record
activity feed.

**Phase 3 — flow deepening**
LR line grid + stepped create + print view · trip close checklist + journey
map · cash day-sheet · import wizard · dark mode · notifications v2
(deep links, grouping, socket).

**Phase 4 — reach**
Mobile card layouts + PWA field mode (POD/expense photo, QR) · trip board /
VP timeline views · share-live-link · RBAC simulator · merge-duplicates ·
kanban views.

**No-boundaries tier (when the above is boring)**
- **Rate intelligence**: entering an LR rate shows the rate-matrix suggestion
  inline with variance highlighting ("₹200 above matrix for this route").
- **Anomaly nudges**: "this trip's diesel expense is 40% above route average."
- **Customer portal** (separate thin app): live LR status, POD download,
  e-way copies — turns ops data into a sales feature.
- **Natural-language query** over the list API ("unbilled LRs for Tata Steel
  this month") → translated to `filter[]` params, rendered in the normal table
  so every result is actionable.
- **Ambient ops wall**: a read-only fullscreen rotation (fleet map → cash
  position → expiring e-ways) for the office TV.

---

## 6. Guardrails (what NOT to do while building any of this)

Restating the repo's own rules because UI pushes are where they die:

- Tokens only — no `bg-white`, no hex, no `bg-blue-600`. One primary.
- Radius derives from 6px; no `rounded-xl`+; `rounded-full` only for circles.
- No hover scale/shadow tricks; `transition-colors` 150ms.
- Skeletons, never "Loading…" strings or cell spinners.
- New reusable UI goes to `@skerp/ui`, not forked into the app.
- Forms = react-hook-form + zodResolver + shared schema from
  `@skerp/validators` — no rules redefined in the app.
- No central dispatch: a new view mode (kanban, board, calendar) is composed
  per feature from shared primitives, not driven by a config map.
- Server remains the source of truth for permissions; `useCan` only hides UI.
