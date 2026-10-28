# Jira: Role-based Training + In-app Feedback

> Paste-ready Jira content. **Two epics**, one shared phase plan.
> Each `### A1 …` / `### B1 …` block is one Jira Story: copy its Summary, Description and Acceptance Criteria.
> Replace `ERP-?` with real keys once created. Story points are relative (Fibonacci).
>
> Labels to apply: `training` or `feedback`, plus `phase-0` … `phase-6`.
> Every Epic B issue also gets **`remove-before-prod`**.

---

## Background

SK ERP covers the whole freight business: Masters → Order → Approval → LR Group / LR → Trip / Vehicle
Journey → rail leg (VP Schedule, MR/RR, VP Loading, Rake, GRN, DC) → Delivery / Ack → LR to Bill → Bill →
Receipt → Vendor Payments → Ledger, plus Workshop and Cash Planning. That is ~60 server modules and five
seeded roles (Admin, Branch Manager, Operations, Accounts, Read-Only Auditor).

We have two problems right now:

1. **Users don't know what their role does in the overall flow**, what comes before their step and who
   picks it up after. → **Epic A: Role-based Training** (permanent feature).
2. **The ERP is in testing and testers have no structured way to say "this is wrong on this page."**
   Feedback arrives on WhatsApp/calls without page, steps or screenshots. → **Epic B: In-app Feedback**
   (temporary, must be removable before/after go-live without touching other modules).

---

## Phase plan

| Phase | Goal | Stories | Exit criteria |
| --- | --- | --- | --- |
| **0 · Foundations** | Skeletons, flags, data models, guardrails | B0, A1 | Both modules mount; flags work; isolation lint rule active |
| **1 · Collect feedback now** | Testers can report from every page; devs can triage + export | B1, B2, B3, B4, B5 | Feedback from any dashboard page lands in `/settings/feedback`; Excel export works |
| **2 · Know your role** | Every user sees their role, their part of the flow, and their training | A2, A3, A4, A11 | New user logs in → welcome → "My Role" → assigned track with saved progress |
| **3 · Admin control + richer feedback** | Admins manage training; feedback gets screenshots, Word export, reporter loop | A5, A6, B6, B7, B8 | Admin assigns tracks to roles + sees team progress; Word report with screenshots |
| **4 · Help on the screen** | Learn in context on the busiest screens | A7, A8 | `?` help on top-10 screens; tours on the 4 hardest forms |
| **5 · Practise & certify** | Safe sandbox + missions + quizzes | A9, A10 | Training environment live with nightly reset; track quizzes recorded |
| **6 · Go-live** | Switch feedback off, archive, remove | B9 | Prod flag off at go-live; removal PR merged after stabilisation window |

Phase 1 comes first because testing is happening now. Every week without the feedback form is feedback lost.
Phases 1 and 2 can run in parallel with two developers.

**Definition of Done (all stories):** `pnpm check-types`, `pnpm lint`, `pnpm build` pass. Follows
`llm-guideline/design.md` (tokens only, 6px radius, `Table`/`Skeleton`/`Pagination` primitives, one primary
button per view). Every non-personal route is permission-gated on the server. No `any`. Zod schemas live in
`@skerp/validators`.

---

# EPIC A: Role-based Training (ERP-?)

**Summary:** Role-based training and onboarding: show each user their role, their part of the business
flow, and a guided training path.

**Description**

Give every user a clear answer to: *What is my role? Which part of the business flow do I own? What can I do
in the system? What comes before me, and who picks up after me? How do I learn to do it?*

**Design principles**

- **Role-based, data-driven.** Tracks are assigned to roles by admins (a `roleId → trackKey` table). Code
  never checks role *names* (consistent with RBAC_PLAN: no name-match logic). Suggested tracks are
  derived from the role's permissions.
- **Capabilities come from permissions.** "What you can do" is computed from `user.permissions`, so it is
  always true to what the server will actually allow.
- **Content is code.** The stage/track catalog is typed TypeScript, reviewed in PRs and updated in the same PR
  that changes a flow.
- **Vertical slice.** `apps/server/src/modules/training/`, `apps/web/features/training/`,
  `packages/validators/src/training/`, catalog in `packages/types/src/training/`. Training only *reads*
  other modules' tables (for step verification); nothing imports from training.

**Data model (Prisma)**

```prisma
model TrainingRoleProfile {
  roleId           String   @id
  summary          String              // "You book customer orders and turn them into LRs…"
  responsibilities String[]
  updatedAt        DateTime @updatedAt
  role             Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
}

model TrainingRoleTrack {
  roleId    String
  trackKey  String                     // "ops", "rail", "accounts", …
  required  Boolean  @default(true)
  createdAt DateTime @default(now())
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([roleId, trackKey])
}

enum TrainingStepStatus { DONE SKIPPED }
enum TrainingCompletedBy { SELF SYSTEM }

model TrainingProgress {
  userId      String
  stepKey     String                   // "ops.book-order", "tour.lr-form", "welcome"
  status      TrainingStepStatus
  completedBy TrainingCompletedBy
  completedAt DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, stepKey])
}
```

**Catalog shape** (`packages/types/src/training/catalog.ts`, shared by server + web)

```ts
type TrainingStage = {
  key: StageKey;                 // "order.book", "order.approve", "rail.vp-loading", …
  title: string;
  href: string;                  // same hrefs as apps/web/config/navigation.ts
  permissions: PermissionKey[];  // user "owns" the stage if they hold any of these
  next: StageKey[];              // drives the process map + "who picks up after you"
};

type TrainingStep = {
  key: string;                   // "ops.book-order"
  title: string;
  href: string;
  requires: PermissionKey;       // hidden if the user lacks it
  verifier?: VerifierKey;        // "order.created" | "order.approved" | "lr.created" | …
};

type TrainingTrack = {
  key: TrackKey;
  title: string;
  suggestedFor: PermissionKey[]; // admin UI suggests this track for roles holding these
  steps: TrainingStep[];
};
```

Explanatory copy (paragraphs, examples, images) lives in `apps/web/features/training/content/`. The
glossary comes from `docs/CONTEXT.md` §2, and the stage stories from §4 and `docs/CURRENT_ORDER_LR_FLOW_GUIDE.md`.

**API** (`apps/server/src/modules/training/training.route.ts`, bespoke router)

| Method | Path | Gate | Purpose |
| --- | --- | --- | --- |
| GET | `/training/me` | auth | Role, branch scope + branches, profile, owned stages, capabilities, owners of adjacent stages, assigned tracks + progress |
| POST | `/training/progress` | auth | Mark a step DONE / SKIPPED (SELF) |
| POST | `/training/verify/:trackKey` | auth | Run verifiers for the track's steps, upsert SYSTEM completions |
| GET | `/training/admin/roles` | `admin.training.manage` | Profiles, assignments, permission-based suggestions |
| PUT | `/training/admin/roles/:roleId` | `admin.training.manage` | Save profile + track assignments |
| GET | `/training/admin/progress` | `admin.training.manage` | Per-user progress (filter role / branch / track) |
| GET | `/training/admin/progress/export.xlsx` | `admin.training.manage` | Excel export (exceljs) |

New permission: `admin.training.manage` in `packages/types/src/permissions.ts` + seed.

---

### A1 · Training foundation (Phase 0, 5 pts)

**Summary:** Scaffold training module: data model, catalog, permission, server + web skeletons.

**Description:** Create the vertical slice and the shared catalog so later stories only add content and UI.

**Tasks**
- Prisma models above + migration (`pnpm db:migrate`).
- `packages/types/src/training/catalog.ts` with stage + track types and the first stage list (below).
- `packages/validators/src/training/` (progress, role-profile, assignment schemas) + subpath export.
- `PERMS.ADMIN.TRAINING_MANAGE` + seed; Admin gets it via `*`.
- Server router mounted at `/training`; web feature folder + `/training` route (thin page).
- Nav: "Training" under the Overview section in `apps/web/config/navigation.ts`.

**Stage catalog (initial)**

| Stage | Owned via permission (any of) | Next |
| --- | --- | --- |
| Masters setup | `masters.*.create` | Order booking |
| Order booking | `order.create` | Order approval |
| Order approval | `order.approve`, `order.reject` | LR Group / LR |
| LR Group / LR + E-way bill | `lorry_receipt.create`, `ewaybill.create` | Trip, VP Schedule |
| Trip / Vehicle Journey, expenses, advances | `trip.create`, `vehicle_journey.create`, `trip_expense.create` | Trip close / Log Slip |
| Trip close / Log Slip | `trip.close`, `logslip.generate` | LR to Bill |
| VP Schedule → MR/RR → VP Loading | `vp_schedule.create`, `mrrr.create`, `vp_loading.create` | Rake at rail head |
| Rake & GRN at rail head / branch | `rake_at_rail_head.create`, `grn.create`, `rake_at_branch.create`, `rail_branch_grn.create` | Delivery Challan |
| Delivery Challan | `delivery_challan.create` | Delivery / Ack |
| Delivery / Acknowledgement | `lorry_receipt.deliver`, `lorry_receipt.acknowledge` | LR to Bill |
| LR to Bill → Bill | `billing.create`, `billing.finalise` | Receipt |
| Receipt | `receipt.create` | Ledger |
| Vendor payments | `accounts.payment.create`, `.approve`, `.disburse` | Ledger |
| Ledger / Day Book | `ledger.view`, `ledger.journal_create` | none |
| Workshop (side flow) | `workshop.*` | none |
| Cash planning (side flow) | `cashplanning.*` | none |

**Acceptance criteria**
- [ ] Migration applies cleanly on a fresh DB and on a copy of the current dev DB.
- [ ] `GET /training/me` returns the user's role, branch scope and owned stages (computed from permissions).
- [ ] `/training` renders for any authenticated user; `admin.training.manage` routes return 403 without the key.
- [ ] No module outside `training/` imports from it.

---

### A2 · "My Role" page (Phase 2, 8 pts)

**Summary:** Show each user their role, their part of the business, what they can do, and who they hand off to.

**Description:** As any user, I open **Training → My Role** and immediately understand my job in the ERP.

**Page sections**
1. **Header:** role name, admin-written summary, branch access (`ALL` or the list of assigned branches).
2. **Your part of the business:** compact process map with the user's owned stages highlighted.
3. **What you can do:** capabilities grouped by stage, as plain sentences ("Approve or reject orders",
   "Finalise bills"). Built from `user.permissions` + a label map in the catalog.
4. **Before you / after you:** for each owned stage, the previous and next stage and *who* does them
   (role names holding that stage's permission, e.g. "Order approval: done by Branch Manager, Admin").
5. **Your training:** assigned tracks (required first) with progress bars and "Continue" buttons.

**Acceptance criteria**
- [ ] Operations, Accounts and Branch Manager test users each see different highlighted stages and capabilities.
- [ ] Capabilities never list an action the server would reject (derived from the same permission set).
- [ ] "Done by" role names are live: changing a role's permissions changes the page after cache invalidation.
- [ ] Works with `Skeleton` loading states, no "Loading…" strings; responsive down to tablet width.

---

### A3 · Process map + glossary (Phase 2, 8 pts)

**Summary:** Interactive end-to-end business flow map and searchable glossary.

**Description:** A diagram of the whole flow (stage catalog from A1). Clicking a stage opens a `Sheet` with:
what it is, who does it, what must exist first, which statuses it moves documents through, what comes next,
and a "Go to screen" link (shown only if the user has access). A filter switches between "All", "My role" and
any other role ("Show me Accounts").

Glossary: searchable list (LR, TBB, POD, VP, RR/MR, DC/WC, demurrage vs detention, RCM, GTA, Log Slip, …).
Add a small `<Term id="tbb">` tooltip component that other screens can use for inline definitions.

Show a mini version of the map + "Continue training" card on `/dashboard` (currently a placeholder).

**Acceptance criteria**
- [ ] All stages from A1 appear; road path and rail path are visually distinct; side flows (Workshop, Cash Planning) shown separately.
- [ ] "My role" filter highlights exactly the stages from `/training/me`.
- [ ] Glossary search matches term and description; at least 25 terms from `docs/CONTEXT.md` §2.
- [ ] Diagram uses design tokens (works in light and dark), no hard-coded colours.

---

### A4 · Role-based training tracks (Phase 2, 8 pts)

**Summary:** Step-by-step training tracks per role with saved progress.

**Description:** Each track is an ordered checklist. Each step has a short explanation, a "Do it" link to the
real screen, and Done / Skip. Progress is saved per user (`TrainingProgress`) and resumes where they left off.

**Initial tracks**

| Track | Suggested for (permission) | Steps (summary) |
| --- | --- | --- |
| ERP Basics (everyone) | none, always | Navigation & search, tables (filters, columns, export), attachments, notifications, profile, branch scope |
| Operations: book to deliver | `order.create` | Masters needed → book order → LR Group / LR → e-way bill → trip / vehicle journey → expense / advance → delivery |
| Branch Manager: approvals | `order.approve` | Approve / reject order → LR approve → trip close & Log Slip → approve trip expenses |
| Rail / VP operations | `vp_schedule.create` | VP Schedule → MR/RR → VP Loading → rake at rail head + GRN → rake at branch + GRN → Delivery Challan |
| Accounts: bill to cash | `billing.create` | LR to Bill → finalise bill → credit note → receipt + TDS allocation → payment slip → approval → disbursement → day book / ledger |
| Workshop | `workshop.po.manage` | PO → inward → job card → service bill → supplier replacement → stock |
| Auditor: finding things | `ledger.view` | Finding documents, ledgers, audit log, exports |
| Admin | `admin.rbac.manage` | Users, roles, access & branch scope, notifications, training admin |

**Default assignments (seed):** Admin → Basics + Admin (others optional). Branch Manager → Basics, Ops, BM
(Rail optional). Operations → Basics, Ops (Rail optional). Accounts → Basics, Accounts. Read-Only Auditor →
Basics, Auditor.

**Acceptance criteria**
- [ ] Steps whose `requires` permission the user lacks are hidden, not shown as locked.
- [ ] Progress survives logout / another device (server-side).
- [ ] Dashboard card shows "Continue: <track> · 3/8" for the first incomplete required track.
- [ ] Track content is reviewed by an ops person from each role before release.

---

### A5 · Admin: training settings + team progress (Phase 3, 5 pts)

**Summary:** Admin screen to describe roles, assign tracks, and monitor training progress.

**Description:** New page `/settings/training` (gated `admin.training.manage`) with three tabs:
- **Role profiles:** edit summary + responsibilities per role.
- **Track assignment:** per role, tick tracks as required / optional; suggested tracks (from permissions) are pre-marked.
- **Team progress:** table of users × required tracks (% complete, last activity), filters for role, branch
  and track. Export to Excel.

**Acceptance criteria**
- [ ] Changing a role's assignments updates affected users' "My Role" page.
- [ ] Progress table uses `Table` + `Pagination` primitives, server-side filtering via `list.query.ts`.
- [ ] Excel export matches the current filters.
- [ ] Settings nav entry hidden without `admin.training.manage`.

---

### A6 · Auto-verified steps (Phase 3, 5 pts)

**Summary:** Mark training steps complete automatically when the user has really done the action.

**Description:** `training.verifiers.ts` holds read-only checks keyed by `VerifierKey`, using existing
ownership columns. No hooks into other modules:

| Verifier | Check |
| --- | --- |
| `order.created` / `order.approved` | `Order.createdById` / `Order.approvedById` = user |
| `lr_group.created` / `lr.created` | `LRGroup.createdById` / `LorryReceipt.createdById` |
| `bill.created` / `receipt.created` | `Bill.createdById` / `Receipt.createdById` |
| `vp_loading.created`, `grn.created`, `delivery_challan.created` | `createdById` on each |
| `trip.closed`, `vendor_payment.*` | `AuditLog` (`actorId`, `entity`, `action`); these modules already write audit rows |

Verification runs when the user opens a track (`POST /training/verify/:trackKey`), not continuously.

**Acceptance criteria**
- [ ] Creating an Order as a test user, then opening the Ops track, ticks "Book an order" with completedBy = SYSTEM.
- [ ] Verifiers are single indexed `findFirst` queries; verify endpoint < 300 ms for a full track.
- [ ] Steps without a verifier still support manual Done.

---

### A7 · In-context help on screens (Phase 4, 8 pts)

**Summary:** `?` help panel, next-step hints and guided empty states on the busiest screens.

**Description**
- **`HelpSheet` primitive** in `packages/ui` (Sheet with sections: *What this screen is for · Where it sits in
  the flow · What happens next · Common mistakes · Related training*). Each feature passes its own content
  from `features/<feature>/help.ts`, so the content stays inside its own module.
- **Next-step hints:** after a status change, show the next action ("Order approved. Next: create the LR Group →").
- **`EmptyState` primitive** in `packages/ui`: empty lists explain prerequisites ("No orders yet. Orders need a
  Customer, Route and Rate Matrix").
- **First 10 screens:** Orders, LR Groups / LR, Trips, Vehicle Journeys, VP Loading, GRN at Rail Head,
  Delivery Challans, LR to Bill, Billing Register, Client Payment Receivable.

**Acceptance criteria**
- [ ] `?` button in the page header on all 10 screens; content reviewed by the owning team.
- [ ] Hints and empty states use tokens + shared primitives only.
- [ ] Help links to the matching training track step.

---

### A8 · Guided tours for complex forms (Phase 4, 5 pts)

**Summary:** Step-by-step spotlight tours on the four hardest forms.

**Description:** A `Tour` primitive in `packages/ui` built on the existing Popover (or a wrapped library styled
with tokens). Anchors use `data-tour="…"` attributes, never CSS classes. First tours: **LR form (tabs)**,
**VP Loading**, **LR to Bill**, **Trip close → Log Slip**. Auto-offered on first visit; "Replay tour" in the
help sheet. Seen state stored as `TrainingProgress` step `tour.<name>`.

**Acceptance criteria**
- [ ] Tours skip gracefully if an anchor is missing (e.g. hidden by permissions).
- [ ] Keyboard accessible (Esc closes, arrows move).
- [ ] Not shown again once completed or dismissed.

---

### A9 · Training environment + missions (Phase 5, 13 pts)

**Summary:** Separate sandbox deployment with demo data, nightly reset and scenario missions.

**Description:** A separate deployment (e.g. `training.<domain>`) with its **own DB, S3 bucket and Redis
prefix**, seeded with fictional demo data (customers, routes, rate matrix, vehicles, drivers, a rake). Reset
nightly. A permanent banner reads "Training environment: data resets every night."

**Do not** build this as a "training branch" inside production. Branch scoping hides data, but document
numbers, ledger postings, notifications (email / WhatsApp), e-way bill API and OneLap calls would still be real.

All outbound integrations must be disabled in the training environment (SES mail, Meta WhatsApp, e-way bill,
OneLap, Tally bridge). Verify each provider respects an env switch, and add one where missing.

**Missions:** scenario cards, for example "Book 3 trucks for Demo Appliances, Pune → Guwahati, 32HQ; get it approved;
create the LRs; attach a trip; finalise." Completion uses the A6 verifiers.

**Acceptance criteria**
- [ ] One command / pipeline job creates and resets the training DB from seed.
- [ ] No outbound email / WhatsApp / government API calls from the training environment (checked in logs).
- [ ] At least one mission per track from A4.
- [ ] Feedback widget (Epic B) is enabled in the training environment.

---

### A10 · Track quizzes & certification (Phase 5, 5 pts)

**Summary:** Short quiz per track; record pass / fail; show certification on My Role and admin progress.

**Description:** 5–10 multiple-choice questions per track in the catalog, pass mark 80%. New model
`TrainingQuizAttempt { id, userId, trackKey, score, passed, answers Json, createdAt }`. Quizzes are
informational only; they never block access to modules.

**Acceptance criteria**
- [ ] Attempts stored; best score shown; retries allowed.
- [ ] Admin progress table (A5) shows certified / not certified per required track.

---

### A11 · First-login welcome (Phase 2, 2 pts)

**Summary:** Welcome dialog on first login that introduces the user's role and starts their training.

**Description:** On first authenticated load, if `TrainingProgress` has no `welcome` step: a dialog saying
"Welcome, <name>. You're signed in as <role> at <branch>", with buttons **See my role** (primary) and **Later**.
Either choice records the `welcome` step.

**Acceptance criteria**
- [ ] Shown once per user, across devices.
- [ ] Not shown in the middle of a form (only on dashboard / training routes).

---

# EPIC B: In-app Feedback, testing phase (ERP-?) · `remove-before-prod`

> **v2 (B10–B17):** the five-tab form below was replaced by one short form with Impact, Points, voice
> notes and documents. See [FEEDBACK_V2_PLAN.md](./FEEDBACK_V2_PLAN.md).

**Summary:** Page-aware feedback form on every screen (Bug / Wrong flow / UI change / Hard to find /
Suggestion), with an admin inbox and Excel / Word export. Fully isolated and removable.

**Description**

While the ERP is in testing, every user can report a problem from the exact page where they hit it. The
form captures page, module, user, role, branch, app version and recent API errors automatically, so the
reporter only writes what went wrong. Admins and developers triage it in **Settings → Feedback** and export
it to **Excel** (tracking) or **Word** (developer report with screenshots).

When the ERP goes to production, feedback is switched off with one env var and later deleted with a single
removal PR. **No other module may depend on it.**

## Isolation contract (Epic-level acceptance criteria)

1. **All code lives in five folders:**
   `apps/server/src/modules/feedback/` · `apps/web/features/feedback/` ·
   `apps/web/app/(dashboard)/settings/feedback/` · `packages/validators/src/feedback/` ·
   `packages/types/src/feedback/`
   (Not `apps/web/components/feedback/`: that is the unrelated shared dialogs folder.)
2. **Touch points outside those folders.** This is the complete list, and the removal PR reverts exactly these:

   | File | Change |
   | --- | --- |
   | `apps/server/src/index.ts` | import + `if (FEEDBACK_ENABLED) app.use("/feedback", feedbackRoute)` |
   | `apps/web/components/layout/AppShell.tsx` | import + `<FeedbackLauncher />` next to `<NotificationBellButton />` |
   | `apps/web/config/navigation.ts` | one Settings entry (included only when the flag is on) |
   | `packages/types/src/permissions.ts` | separate `FeedbackPermissionKey` type + `PERMS.FEEDBACK` group |
   | `packages/validators` index + `package.json` | re-export + `./feedback` subpath |
   | `packages/types/src/index.ts` | re-export inferred types |
   | `apps/server/prisma/schema.prisma` | `Feedback` model + enums (+ migration) |
   | `apps/web/eslint.config.js`, `apps/server/eslint.config.js` | `no-restricted-imports` guards (below) |
   | `turbo.json`, `.env.example` | `FEEDBACK_ENABLED`, `NEXT_PUBLIC_FEEDBACK_ENABLED`, `NEXT_PUBLIC_APP_VERSION` |
   | `docs/TRAINING_ENVIRONMENT.md` | Feedback stays on in the training copy (A9) |

3. **One-way dependencies only.** Feedback may import shared things (`@/lib/api`, `@/features/auth`,
   `@skerp/ui`, `config/navigation`, `attachment.service`). Nothing imports feedback except the touch points.
   Enforced by ESLint `no-restricted-imports` on `@/features/feedback*` with an allow-list for `AppShell.tsx`
   and the settings route page.
4. **No database coupling.** `Feedback` has **no foreign keys into core tables**, and no core model gets a
   relation field. The reporter is stored as a snapshot (id, name, role, branch at submit time).
   Dropping the table touches nothing else.
5. **Fail-safe at runtime.**
   - The widget is lazy-loaded (`next/dynamic`, `ssr: false`) and wrapped in its own error boundary. If it
     crashes, it renders nothing and the page is unaffected.
   - The API-error trail uses an axios interceptor that feedback registers on the shared `api` instance and
     ejects on unmount. It only observes: it returns the same response and re-throws the same error, and
     `lib/api.ts` is **not edited**.
   - A failed submit shows a toast and keeps the draft; it never throws.
6. **Kill switch at two levels.**
   - Server `FEEDBACK_ENABLED` (runtime): router not mounted → every `/feedback/*` returns 404.
   - Web `NEXT_PUBLIC_FEEDBACK_ENABLED` (build-time): widget code not bundled.
   - The widget also probes `GET /feedback/status` and hides itself on 404, so flipping the server flag alone
     hides feedback without rebuilding the web app.
7. **Switching off keeps data.** Turning the flag off never deletes rows; archive exports first (B9).

## Feedback categories (tabs in the form)

Common fields on every tab: **Title*** (short), **Details** (optional free text), **Screenshot** (Phase 3).
Page context is captured automatically (next section).

| Tab | Enum | Category-specific fields (* = required) |
| --- | --- | --- |
| **Bug** | `BUG` | What were you doing (steps)* · What did you expect* · What happened instead* · Severity* (Blocker: can't continue / Major: workaround exists / Minor: cosmetic) · Happens: Always / Sometimes / Once |
| **Wrong flow** | `FLOW` | Which step or action* · What the system does now* · How SK actually works (correct process)* · Who should do this step (role) · Impact: Blocks work / Extra work / Wrong data / Wrong amount |
| **UI change** | `UI` | Which part of the screen* (text, or element picker in Phase 3) · Problem*: Hard to read / Too many clicks / Wrong label / Layout / Missing field / Other · Your suggestion* |
| **Hard to find** | `FINDABILITY` | What were you trying to find or do* · Where did you look / expect it* · Did you find it? Yes (where) / No |
| **Suggestion** | `SUGGESTION` | Your idea* · Why it helps / who benefits |

Zod: `feedbackCreateSchema = z.discriminatedUnion("category", [bug, flow, ui, findability, suggestion])`
merged with the common fields and `context`. The same schema is used by `zodResolver` on the web and `.parse()`
on the server.

## Auto-captured page context

| Field | Source |
| --- | --- |
| `pagePath`, `entityId` | `usePathname()`; dynamic segment (e.g. `/lorry-receipts/[id]`) |
| `moduleLabel`, `pageTitle` | Longest-prefix match of the path against `NAV_SECTIONS` → "Operations › VP Management › VP Loading" |
| `breadcrumb` | Labels from `components/layout/breadcrumb-labels.tsx` context (read-only) |
| Reporter snapshot | `useAuth()`: id, full name, role name, branch, branch scope |
| `appVersion` | `NEXT_PUBLIC_APP_VERSION` (git SHA injected at build) |
| Client | User agent, viewport, screen size, timezone, online state |
| `recentApi` | Last 10 API calls: method, path, status, duration, error code / message. **No bodies, headers or cookies.** |
| `recentErrors` | Last 5 `window.onerror` / `unhandledrejection` messages |
| `element` (Phase 3) | Element picker: CSS path, tag, visible text (≤120 chars), bounding box |

Context JSON is capped at 32 KB server-side.

## Data model (Prisma)

```prisma
enum FeedbackCategory { BUG FLOW UI FINDABILITY SUGGESTION }
enum FeedbackStatus   { NEW TRIAGED IN_PROGRESS FIXED WONT_FIX DUPLICATE }
enum FeedbackSeverity { BLOCKER MAJOR MINOR }

model Feedback {
  id             String            @id @default(cuid())
  number         Int               @unique @default(autoincrement())   // shown as FB-0042
  category       FeedbackCategory
  title          String
  description    String?
  details        Json                                                  // category fields, validated by Zod
  severity       FeedbackSeverity?
  status         FeedbackStatus    @default(NEW)

  pagePath       String
  pageTitle      String
  moduleLabel    String
  entityId       String?
  context        Json

  // Snapshot on purpose: no relation to User, so the table can be dropped cleanly.
  reporterId     String
  reporterName   String
  reporterRole   String
  reporterBranch String?

  assignee       String?
  devNotes       String?
  externalRef    String?                                               // Jira key, e.g. ERP-123
  duplicateOfId  String?
  resolvedAt     DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([status])
  @@index([category])
  @@index([moduleLabel, pagePath])
  @@index([reporterId])
  @@index([createdAt])
}
```

Screenshots (Phase 3) reuse `attachment.service.ts` (`createAttachment` / `completeUpload` /
`getDownloadUrl`) with `entityType = "Feedback"`. This is a one-way dependency: S3 keys land under
`attachments/Feedback/`, and the attachments module is not changed.

## API (`apps/server/src/modules/feedback/feedback.route.ts`)

A bespoke router, not `createCrudRouter`, because *create* is open to every authenticated user, while triage is
permission-gated with `can()`.

| Method | Path | Gate | Purpose |
| --- | --- | --- | --- |
| GET | `/feedback/status` | auth | `{ enabled: true }`; web hides the widget on 404 |
| POST | `/feedback` | auth | Submit. Rate limit 20 / user / hour |
| GET | `/feedback/mine` | auth | Reporter's own items + status |
| GET | `/feedback` | `feedback.view` | List: `?page&size&sort&search&filter[status]=…` via `list.query.ts` |
| GET | `/feedback/summary` | `feedback.view` | Counts by status, category, module, page |
| GET | `/feedback/:id` | `feedback.view` or owner | Detail |
| PATCH | `/feedback/:id` | `feedback.manage` | status, severity, assignee, devNotes, externalRef, duplicateOf |
| PATCH | `/feedback/bulk` | `feedback.manage` | Bulk status change |
| GET | `/feedback/export.xlsx` | `feedback.view` | Excel, same filters as list |
| GET | `/feedback/export.docx` | `feedback.view` | Word report (Phase 3) |
| POST | `/feedback/:id/screenshots` | owner | Presigned upload (Phase 3) |
| POST | `/feedback/:id/comments` | owner or `feedback.manage` | Dev ↔ tester thread (Phase 3) |

Permissions: `feedback.view`, `feedback.manage` (Admin gets them via `*`; assign to a QA / Developer role as needed).

---

### B0 · Feedback foundation + isolation guardrails (Phase 0, 3 pts)

**Summary:** Scaffold the feedback module behind feature flags with enforced isolation.

**Tasks**
- Env vars in `turbo.json` globalEnv + `.env.example`: `FEEDBACK_ENABLED`, `NEXT_PUBLIC_FEEDBACK_ENABLED`, `NEXT_PUBLIC_APP_VERSION`.
- `Feedback` model + enums + migration.
- Validators (`packages/validators/src/feedback/`) with the discriminated union; subpath export; types re-export.
- `PERMS.FEEDBACK.VIEW / MANAGE` in a **separate** type + seed.
- Conditional server mount; `GET /feedback/status`.
- ESLint `no-restricted-imports` rule with an allow-list.

**Acceptance criteria**
- [ ] `FEEDBACK_ENABLED=false` → `/feedback/status` returns 404; `true` → 200.
- [ ] Importing `@/features/feedback` from any other feature fails lint.
- [ ] `Feedback` has no relation to `User` or any other model.

---

### B1 · Feedback launcher + tabbed form (Phase 1, 5 pts)

**Summary:** "Feedback" button in the app header that opens a tabbed feedback form on every page.

**Description:** As a tester, on any page I click **Feedback** in the top bar, pick a tab (**Bug · Wrong flow ·
UI change · Hard to find · Suggestion**), fill a few fields and submit. The current page is shown read-only at
the top ("You're reporting on: Operations › Orders › ORD-0012") so I know it is attached.

- Opens in a right-side `Sheet` with `Tabs` from `@skerp/ui`. Fields per tab as in the category table.
- react-hook-form + `zodResolver(feedbackCreateSchema)`; field components from the shared field library.
- Draft kept in `localStorage` per page (wrapped in try/catch) if the sheet is closed before submit.
- Success toast: "Thanks, FB-0042 sent to the team."
- Mounted once in `AppShell.tsx`, so it is on every dashboard page automatically.

**Acceptance criteria**
- [ ] Available on every route under `(dashboard)` without editing any feature page.
- [ ] Switching tabs keeps the common fields (title / details) filled.
- [ ] Required fields validated per tab with the shared schema.
- [ ] Flag off → button absent, no feedback chunk requested in the network tab.
- [ ] One primary button (Submit), tokens only, keyboard accessible (Esc closes, focus trapped).

---

### B2 · Automatic page context capture (Phase 1, 5 pts)

**Summary:** Attach page, module, user, role, app version and recent API errors to each submission automatically.

**Description:** Implement the "Auto-captured page context" table (except `element`). The API trail comes from an
observe-only axios interceptor registered by the feedback feature (ring buffer of 10 entries). Show a
collapsible "Technical details we'll send" section in the form so the reporter can see what is shared.

**Acceptance criteria**
- [ ] Submitting from `/vp-management/vp-loading` stores `moduleLabel = "Operations › VP Management"`, `pageTitle = "VP Loading"`.
- [ ] After a failing API call (e.g. 400 on save), that call appears in `recentApi` with status and error message.
- [ ] No request/response bodies, auth headers or cookies are captured (code review + manual check).
- [ ] `lib/api.ts` is unchanged; interceptor is ejected on unmount.

---

### B3 · Feedback API (Phase 1, 5 pts)

**Summary:** Server endpoints to submit, list, view and triage feedback.

**Description:** Implement the API table (except Phase 3 rows). Validate with the shared schema; cap context at
32 KB; rate limit 20 / user / hour; list uses `list.query.ts` and the standard `ApiResponse` envelope via `sendOk`.

**Acceptance criteria**
- [ ] Any authenticated user can POST; `GET /feedback` without `feedback.view` → 403.
- [ ] Invalid category fields → `ValidationError` with field errors.
- [ ] Filters: status, category, severity, module, page, reporter role, branch, date range, free-text search.
- [ ] `PATCH` to `FIXED` / `WONT_FIX` sets `resolvedAt`.

---

### B4 · Admin feedback inbox (Phase 1, 8 pts)

**Summary:** Settings → Feedback page to review, filter and triage all feedback.

**Description:** New page `/settings/feedback` (gated `feedback.view`; editing needs `feedback.manage`).
- **Summary strip:** counts by status and category (click to filter); "Top pages" list (most open items per page).
- **Table** (`Table` + `Pagination` + `Skeleton`): FB #, Category, Severity, Status, Title, Module › Page,
  Reporter (role), Created. Column preferences via table-prefs.
- **Filters:** status, category, severity, module, page, role, branch, reporter, date range (`DateRangePicker`).
- **Detail drawer** (`?id=` deep link): all structured fields, context, API trail, triage controls (status,
  severity, assignee, Jira key, dev notes, mark duplicate), **Open page** link, and **Copy as Jira**, which
  copies a ready-to-paste bug description (title, steps, expected / actual, page, environment) to the clipboard.
- **Bulk:** select rows → set status / export selected.

**Acceptance criteria**
- [ ] Nav entry under Settings visible only with `feedback.view` and only when the flag is on.
- [ ] Triage changes persist and show in the reporter's "My feedback" (B8) once that ships.
- [ ] "Copy as Jira" output pastes cleanly into a Jira description.
- [ ] Page loads < 1 s with 2,000 feedback rows (server-side pagination).

---

### B5 · Excel export (Phase 1, 3 pts)

**Summary:** Export filtered feedback to Excel for developers and test leads.

**Description:** `GET /feedback/export.xlsx` using **exceljs** (already a server dependency). The same filters
as the list apply.
- **Sheet "Feedback":** FB #, Created, Category, Severity, Status, Title, Module, Page, Path, Entity, category
  fields flattened into columns (Steps, Expected, Actual, Current flow, Correct flow, Element, Problem,
  Suggestion, Looked where, Found?), Reporter, Role, Branch, App version, Browser, Assignee, Jira key, Dev
  notes, Link (deep link to admin detail via `WEB_URL`).
- **Sheet "By page":** Module, Page, Open, Bug, Flow, UI, Findability, Suggestion, Total (sorted desc).
- **Sheet "By status":** category × status pivot.
- Frozen header row, auto-filter, sensible column widths. Filename `skerp-feedback-YYYY-MM-DD.xlsx`.

**Acceptance criteria**
- [ ] Opens without warnings in Excel and LibreOffice.
- [ ] Row count equals the filtered list total.
- [ ] Export button on the admin page respects the current filters.

---

### B6 · Screenshots, element picker, annotation (Phase 3, 8 pts)

**Summary:** Let reporters attach a screenshot and point at the exact element that is wrong.

**Description**
- **Capture screen** button: lazy-loaded DOM-to-image capture of the current page; reporter can also paste or upload an image.
- **Point at the problem:** element picker (hover outline, click to select) → stores `element` context and
  highlights it in the screenshot.
- **Annotate:** draw boxes / arrows on the screenshot before sending.
- Upload via `attachment.service.ts` (`entityType = "Feedback"`), max 3 images, 5 MB each, standard antivirus flow.

**Acceptance criteria**
- [ ] Screenshot visible in the admin detail drawer.
- [ ] Picker works on tables, forms and dialogs; Esc cancels.
- [ ] Sensitive inputs (password fields) are masked in captures.

---

### B7 · Word export (developer report) (Phase 3, 5 pts)

**Summary:** Export filtered feedback as a Word report grouped by module and page, with screenshots.

**Description:** `GET /feedback/export.docx` using the `docx` npm package (new server dependency).
- Cover: title, date, filters applied, counts by category / status.
- Sections: **Module → Page → items.** Each item: "FB-0042 · Bug · Major · New", title, reporter / role / date,
  structured fields as label / value, embedded screenshots (scaled to page width), technical context table.
- Option: one item per page vs compact.

**Acceptance criteria**
- [ ] Opens in Word and Google Docs; screenshots embedded, not linked.
- [ ] Report for 200 items with screenshots generates in < 30 s (stream / limit total image size).

---

### B8 · "My feedback" + reporter loop (Phase 3, 5 pts)

**Summary:** Reporters see the status of what they sent, confirm fixes, and talk to developers.

**Description**
- **My feedback** tab in the feedback sheet: my items with status; a dot on the Feedback button when any item changed status.
- When an item is `FIXED`, the reporter can choose **Confirmed fixed** or **Still broken** (reopens to `TRIAGED`).
- Comment thread per item (`FeedbackComment { id, feedbackId, authorId, authorName, body, createdAt }`,
  FK only to `Feedback`, cascade delete).
- Self-contained: no dependency on the notifications module.

**Acceptance criteria**
- [ ] Reporter sees status changes without admin access.
- [ ] "Still broken" reopens the item and notes it in the thread.
- [ ] Users can only read their own items via `/feedback/mine`.

---

### B9 · Production switch-off + removal (Phase 6, 2 pts)

**Summary:** Turn feedback off at go-live, archive the data, then remove the module cleanly.

**Runbook:** the step-by-step version, with the exact file list and SQL, is
`docs/FEEDBACK_GO_LIVE.md`. Summary:
1. **Archive:** `pnpm exec tsx src/modules/feedback/feedback.archive.ts` writes Excel, Word (300 items per
   file), a lossless JSON and every attached file; store it with the release docs.
2. **Switch off (go-live day):** `FEEDBACK_ENABLED=false` on the server (feedback disappears immediately via
   the status probe), and `NEXT_PUBLIC_FEEDBACK_ENABLED=false` in the next web build.
3. **Remove (after a stabilisation window, e.g. 30 days):** one PR that
   - deletes the five feedback folders;
   - reverts every touch point in the isolation-contract table;
   - adds a migration dropping `Feedback`, `FeedbackComment` and the feedback enums;
   - deletes `PermissionDef` rows `feedback.*` (`RolePermission` cascades on delete);
   - deletes `Attachment` rows with `entityType = 'Feedback'` and the S3 prefix `attachments/Feedback/`.
4. **Verify:** `pnpm check-types`, `pnpm lint`, `pnpm build` pass; `grep -ri feedback apps packages` returns
   only unrelated matches; smoke-test Order → LR → Trip → Bill → Receipt.

**Acceptance criteria**
- [ ] Removal PR touches only the listed files + the five folders.
- [ ] No other module's behaviour changes (smoke test passes).

---

## Open questions (decide before Phase 1)

1. **Who triages feedback?** Create a "QA / Developer" role with `feedback.view` + `feedback.manage`, or Admin only?
2. **Visibility:** should testers see each other's feedback (to avoid duplicates), or only their own? (Default above: own only.)
3. **Jira link:** is "Copy as Jira" enough, or do we want a "Create Jira issue" button via the Jira API later?
4. **Training environment:** domain, hosting, and who owns the nightly reset.
5. **Go-live date**, which fixes when B9 step 2 happens.
6. **Track content owners:** one ops person per role to review the training text (A4, A7).

## Out of scope

- Feedback on the login / forgot-password pages (outside `AppShell`).
- Customer-facing portal training.
- Video production (record short screen captures separately and link them from track steps).
