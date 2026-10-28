# In-app Feedback v2: simple form, voice notes, documents

> **Status (2026-10-28):** B10–B17 implemented on `ERP74/Onboarding`, not committed yet. The migration
> is written but **not applied** to any database. Still to do: apply the migration, then the manual
> device checks in §10.
>
> Implementation plan for the second version of in-app feedback (Epic B, `remove-before-prod`).
> Stories continue the Epic B numbering from [TRAINING_FEEDBACK_JIRA.md](./TRAINING_FEEDBACK_JIRA.md)
> (B0–B9) and start at **B10**. Each `### B1x` block can be pasted into Jira as one story.
> The go-live switch-off and removal in [FEEDBACK_GO_LIVE.md](./FEEDBACK_GO_LIVE.md) still applies.

**Labels:** `feedback`, `remove-before-prod`.

---

## 1. Summary

Version 1 of in-app feedback works: there's a Feedback button on every page, a form with five
category-specific tabs, pictures, auto-captured page context, a "My feedback" tab and an admin inbox
under Settings → Feedback.

Testers find the v1 form too long. A bug needs a title, three text boxes and a severity before it can
be sent. Many testers would rather **speak** than type, and they want to attach the files they work
with (PDFs, Excel sheets).

v2 replaces the five tabs with **one short form that is the same on every page**. It adds **voice
notes** and **documents**, works on **phones, tablets and desktops**, and gives the admin inbox its
**own sidebar entry**.

The rest of v1 stays as it is: the launcher, page detection, reporter snapshot, conversation, fix
confirmation, rate limit, exports and the isolation contract.

### What changes at a glance

| Area | v1 (today) | v2 |
| --- | --- | --- |
| Form | 5 tabs (Bug / Wrong flow / UI / Hard to find / Suggestion), each with its own required fields | One form: Type, Impact, Page section, text, Points, Voice, Files |
| Title | Typed by the reporter (required) | Made by the server from the text, the first point, or the type and page |
| Types | 5 | 7: Bug, Improvement, Missing feature, Confusing, Data issue, Training/Help issue, Other |
| Severity | Bug only, Blocker / Major / Minor | **Impact** on every item: Low / Medium / High / Critical |
| Attachments | Up to 3 pictures, 5 MB | Up to **6** images or documents (12 MB each) **+ 1 voice note** (3 min) |
| Popup tabs | New feedback / My feedback | **Give feedback / My feedback** |
| Phones | Usable, not designed for | Full-screen popup, one column, pinned footer, large touch targets |
| Admin entry | Settings → Feedback (inside the Settings group) | **Own sidebar item "Feedback"** in Administration (same URL) |

---

## 2. Decisions

These are settled. Change them here before work starts, not halfway through.

| # | Decision | Why |
| --- | --- | --- |
| D1 | **One form for every page.** It stays mounted once in `AppShell`, and the page is read from the URL at submit time. No page registers anything. | Same as v1. Adding a screen never needs feedback work. |
| D2 | The popup has **two tabs only: Give feedback and My feedback**. The developer inbox is **not** in the popup. | Testers don't need the inbox. Developers use the full-page inbox. |
| D3 | The admin inbox gets **its own sidebar item, "Feedback"**, in the Administration section, next to Settings. It is gated by `feedback.view`. The **URL stays `/settings/feedback`**. | Reports aren't a setting. Keeping the URL means the `?id=` links already in Excel exports and Jira tickets keep working. The sidebar's active check is an exact match, so Settings won't highlight as well. |
| D4 | The **Feedback button stays in the top bar**. On phones it shows only the icon. | A floating corner button would cover the sticky Save bars that many pages pin to the bottom. |
| D5 | **Types:** `BUG`, `IMPROVEMENT`, `MISSING_FEATURE`, `CONFUSING`, `DATA_ISSUE`, `TRAINING_HELP`, `OTHER`. No default, so the reporter must choose. | A pre-selected type skews the data. |
| D6 | **Impact:** `LOW`, `MEDIUM` (default), `HIGH`, `CRITICAL`. It replaces `severity`. The reporter sets it and the team can change it in triage. | One scale for every type. |
| D7 | **Required:** a Type, plus **at least one** of: the text, a point, a voice note. A voice note alone is enough. Pictures alone are not. | Removing the typing barrier is the main goal. A picture without words is usually ambiguous. |
| D8 | **Existing reports are migrated, not deleted.** Bug→Bug, Hard to find→Confusing, Wrong flow / UI change / Suggestion→Improvement. Blocker→Critical, Major→High, Minor→Low, no severity→Medium. The old answers stay in `details` and are shown as "Answers from the old form". | Nothing that testers already reported is lost. |
| D9 | **Files:** images (re-encoded to JPEG, max 1600 px wide), **PDF, .docx, .xlsx**. **No** `.doc`, `.xls`, `.docm`, `.xlsm` or `.csv`. | Antivirus scanning isn't connected (`completeUpload` marks files clean straight away). The old binary Office formats and the macro-enabled ones can carry macros, and CSV can carry formula injection. Re-encoding images also removes GPS/EXIF data from phone photos. |
| D10 | **Voice:** one note per item, up to **180 s**, up to **10 MB**, recorded in the browser (`MediaRecorder`). No transcription in v2. | It covers the use case. Transcription can be added later without schema changes. |
| D11 | **Per-call upload limits** come from an optional `limits` argument on `createAttachment`. The global `ATTACHMENT_*` env limits for other modules don't change. | Feedback needs 12 MB, audio and Office files. Other modules must not get them. |
| D12 | **One title line, no eyebrow.** The reference design's uppercase "ERP REVIEW SYSTEM" line is dropped. We keep its layout but use our tokens: blue primary, 6 px radius, `@skerp/ui` Select (not native `<select>`). | `llm-guideline/design.md`. |
| D13 | **Unsent voice notes and files are kept in memory per page** (lost on reload). Text drafts stay in `localStorage` per page, as today. | Closing the popup by mistake loses nothing. Each page has its own draft. Blobs are too big for `localStorage`. |

---

## 3. User experience

### 3.1 The button

- Lives in the `AppShell` top bar, left of the notification bell. It's already mounted there by `FeedbackLauncher`.
- At `sm` and up: outline button with icon and the label "Feedback". Below `sm`: icon only, 44 × 44 px, with `aria-label="Feedback"`.
- Keeps the dot that shows when items under My feedback have news (`useFeedbackUpdates`).
- Still hidden unless `NEXT_PUBLIC_FEEDBACK_ENABLED=true` (build) and `GET /feedback/status` answers (server `FEEDBACK_ENABLED=true`).

### 3.2 The popup

```
Desktop / tablet (right-hand panel)                Phone (full screen)
┌──────────────────────────────────────────┐       ┌───────────────────────────┐
│ Feedback & Review                     ✕  │       │ Feedback & Review      ✕  │
│ Order Board · Operations                 │       │ Order Board · Operations  │
│ [ Give feedback ] [ My feedback (2 new) ]│       │ [Give feedback][My feedb.]│
├──────────────────────────────────────────┤       ├───────────────────────────┤
│ Type *               Impact              │       │ Type *                    │
│ [Choose a type   ▾]  [Medium          ▾] │       │ [Choose a type        ▾]  │
│                                          │       │ Impact                    │
│ Page section (optional)                  │       │ [Medium               ▾]  │
│ [Whole screen                         ▾] │       │ Page section (optional)   │
│                                          │       │ [Whole screen         ▾]  │
│ What should we know?                     │       │ What should we know?      │
│ [                                      ] │       │ [                       ] │
│ [                                      ] │       │ Points                    │
│ Points                                   │       │ [Point 1             ] ✕  │
│ [Point 1                            ] ✕  │       │ [+ Add point]             │
│ [+ Add point]                            │       │ Voice feedback            │
│ ┌ Voice feedback ──┐ ┌ Images & docs ───┐│       │ [🎤 Record voice]         │
│ │ [🎤 Record voice] │ │ [Choose files]   ││       │ Images & documents        │
│ │                  │ │ [Picture of page]││       │ [Choose files]            │
│ └──────────────────┘ └──────────────────┘│       │ [Picture of this page]    │
│ ▸ What we attach automatically           │       │ ▸ What we attach auto…    │
├──────────────────────────────────────────┤       ├───────────────────────────┤
│                  [Cancel] [Submit feedback]│     │ [Cancel] [Submit feedback]│
└──────────────────────────────────────────┘       └───────────────────────────┘
```

- **Header:** title "Feedback & Review". Subtitle: page title · module from `describePage()`, plus the record label when one is open (e.g. "LR Detail · LR-2026-0042").
- **Tabs:** `Give feedback` | `My feedback`. The second shows "(n new)" when there's news.
- **Body** scrolls on its own. The **footer** (Cancel, Submit feedback) is always visible.
- The "What we attach automatically" disclosure from v1 stays at the bottom of the form, collapsed.

### 3.3 Give feedback: fields

| Field | Control | Required | Rules |
| --- | --- | --- | --- |
| **Type** | `SelectField` with the 7 types. Each option shows a short hint (see 3.9). | Yes | No default. Error: "Choose a type". |
| **Impact** | `SelectField`: Low / Medium / High / Critical | Yes | Default Medium. |
| **Page section** | `SectionField` (new). Options: **Whole screen** (default), then the headings found on the current page, then **Point at it on screen…** | No | Stored as text, max 120 chars. See 3.4. |
| **What should we know?** | `TextAreaField`, 4 rows, grows to 10 | See D7 | Max 4000 chars. Placeholder "Describe the issue, confusion or improvement…". |
| **Points** | `PointsField` (new): a list of single-line inputs, "+ Add point", ✕ per row | See D7 | Max 10 points, 300 chars each. Enter in a point adds the next one and focuses it. Backspace in an empty point removes it. Empty points are dropped on submit. |
| **Voice feedback** | `VoiceRecorder` (new), see 3.5 | See D7 | 1 note, max 180 s. |
| **Images & documents** | `AttachmentsSection` (replaces `ScreenshotSection`), see 3.6 | No | 6 files total, 12 MB each. |

**"Nothing to send" check (D7):** if the text is empty, no point has text and there is no voice note,
the form shows one error under "What should we know?":

> Tell us what happened: type it, add a point, or record your voice.

### 3.4 Page section

`lib/page-sections.ts` scans the page when the popup opens:

- It looks inside `<main>` (the `AppShell` work area) for `h1, h2, h3, [data-slot="card-title"]`.
- It keeps only visible elements (`checkVisibility()`, falling back to `offsetParent !== null`).
- It trims the text to 80 chars, removes duplicates, and keeps the first 20 in page order.
- Nothing has to be added to feature pages.

Choosing **Point at it on screen…** runs the v1 element picker (`pickElement` + `captureElement`):

- The popup hides while the user clicks the part of the screen.
- The section is set to the nearest heading above the picked element, or the element's own text.
- A marked picture of that part is added to Images & documents.
- `context.element` is stored, as in v1.

### 3.5 Voice recorder

```
idle ──Record──▶ asking permission ──allowed──▶ recording ──Stop / 180 s / tab hidden──▶ recorded
  ▲                    │                                                                     │
  │                  denied / no mic / not https ──▶ error (with message)                    │
  └──────────────────────────────────────── Delete / Re-record ◀─────────────────────────────┘
```

| State | What the user sees |
| --- | --- |
| idle | `[🎤 Record voice]`, plus the hint "Speak in any language. Up to 3 minutes." |
| recording | A red dot, the timer `0:42 / 3:00`, a live level bar (so they can see the mic hears them), `[■ Stop]` |
| recorded | A play/pause button, the length `1:42`, `[Re-record]`, `[Delete]` |
| error | One line saying what to do (see 3.9). The Record button stays available to retry. |

Rules:

- `getUserMedia` is called **only when Record is clicked**, never on open.
- Format: the first type `MediaRecorder.isTypeSupported` accepts, in this order: `audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg;codecs=opus`. Chrome, Edge, Firefox and Android give WebM; Safari and iOS give MP4/AAC.
- The finished `Blob` is built with the **base** type, without the codec part (`audio/webm`, not `audio/webm;codecs=opus`). The presigned PUT checks `Content-Type` exactly (see §9).
- Recording stops automatically at 180 s. It also stops when the tab is hidden (`visibilitychange`), because iOS stops the mic anyway. Whatever was recorded is kept.
- The `MediaStream` tracks are **always** stopped: on Stop, on Delete, and on unmount. Otherwise the browser's microphone indicator stays on.
- The length shown comes from our own timer (`durationSec`), not from `<audio>.duration`. Chrome's WebM files have no duration in the header.
- When the voice note exists, the form value `hasVoiceNote` is set to `true`. It feeds the D7 check.
- The button is hidden, with a one-line reason, when `window.isSecureContext` is false, when `navigator.mediaDevices` is missing, or when `MediaRecorder` is missing.

### 3.6 Images & documents

- **Choose files**: `<input type="file" multiple accept="image/*,.pdf,.docx,.xlsx">`. On phones this offers the camera and the photo library.
- **Picture of this page**: v1's `capturePage()`.
- **Paste** (Ctrl+V) anywhere in the form adds an image, as in v1.
- **Drag and drop** onto the card on devices with a precise pointer (`@media (pointer: fine)`).
- Images go through v1's `fileToScreenshot` (JPEG, ≤1600 px wide), so they keep the **Mark** (annotate) button.
- Documents are uploaded as they are. They show as a chip: file icon, name, size, ✕.
- Each file's type is worked out from `file.type`. If that's empty (Windows sometimes leaves it empty for `.docx`/`.xlsx`), it comes from the extension. Anything not on the D9 list is refused with a toast saying which file and why.
- A counter reads "4 of 6 files". The buttons are disabled at 6.
- Helper text: "Up to 6 files, 12 MB each. Images, PDF, Word (.docx), Excel (.xlsx)."
- When storage isn't set up (`/feedback/status` → `uploads: false`), the Voice and Files cards are replaced by one line: "Attachments aren't set up on this server yet."

### 3.7 Sending

1. `POST /feedback` with the form, the page, the context, and `context.attachmentsPlanned = { voice, images, documents }`.
2. On `201`, every voice note and file is uploaded, **2 at a time**: request → `PUT` to storage (with progress) → complete. Each file shows its own progress bar.
3. Confirmation screen: "Thank you. Your reference is **FB-0042**. You can follow it under My feedback."
   - If any upload failed, it says "2 files couldn't be attached" and shows a **[Retry]** button. Retry uploads only the failed ones to the same item. The blobs are kept until all uploads succeed or the user closes the popup.
4. On success, the text draft for that page and that page's in-memory files are cleared, and the `mine` query is invalidated.

If step 1 fails, nothing is cleared and the error is shown above the footer (as in v1).

### 3.8 My feedback

- A list of cards, newest first, limited to the latest 50 (as today). Cards suit the narrow panel better than a table.
- Each card shows: **FB-0042**, the type badge, the impact badge, the status badge, the page title, the date, and icons for a voice note or files. A "New" marker appears if it changed since last seen (`seen.ts`).
- Tapping a card opens its detail **inside the popup**, with a back arrow:
  - text, points, section
  - voice player
  - picture thumbnails (tap to open full size)
  - document chips (download)
  - the conversation (`CommentThread`)
  - `ConfirmFix` when the status is Fixed
- Only the caller's own items are listed (`GET /feedback/mine`). No permission is needed.

### 3.9 Wording

| Where | Text |
| --- | --- |
| Type hints | Bug: "Something is broken or shows an error" · Improvement: "It works, but could be better" · Missing feature: "Something we need isn't there" · Confusing: "Hard to understand or to find" · Data issue: "Wrong, missing or duplicate data" · Training/Help issue: "Help text or training is wrong or missing" · Other: "Anything else" |
| Impact hints | Low: "Small annoyance" · Medium: "Slows me down" · High: "Wrong result or a lot of extra work" · Critical: "I can't do my work" |
| Mic blocked | "Your microphone is blocked. Allow it from the icon next to the address bar, then try again." |
| No mic | "We couldn't find a microphone on this device." |
| Not https | "Voice recording only works on a secure (https) address." |
| File refused | "\"rates.xls\" can't be attached. Use PDF, .docx, .xlsx or an image." |
| File too big | "\"scan.pdf\" is larger than 12 MB." |
| Upload failed | "2 files couldn't be attached. Your feedback was still sent." + [Retry] |

### 3.10 Responsive rules

| Width | Button | Popup | Form grid | Notes |
| --- | --- | --- | --- | --- |
| < 640 px (phones) | Icon only, 44 × 44 | Full screen (`w-full`) | 1 column | Footer pinned with `pb-[env(safe-area-inset-bottom)]`. Tabs fill the width (`grid-cols-2`). Touch targets ≥ 44 px. |
| 640–1023 px (tablets) | Icon + label | Right panel, `sm:max-w-xl` | Type \| Impact side by side; Voice and Files stacked | |
| 1024–1279 px | Icon + label | `lg:max-w-2xl` | 2 columns (Type \| Impact, Voice \| Files) | |
| ≥ 1280 px | Icon + label | `xl:max-w-3xl` | 2 columns | Close to the reference screenshot. |

The columns follow the **panel's** width, not the window's (container queries: `@md:` for Type \| Impact,
`@xl:` for Voice \| Files), so the cards never get squeezed.

- **iOS zoom on focus:** iOS Safari zooms into any text field with a font size under 16 px. `@skerp/ui` `Textarea` already uses `text-base md:text-sm`, but **`Input` uses `text-sm`**. Change `Input` to `text-base md:text-sm` in `packages/ui` (the same as Textarea and the shadcn default). This affects every form on phones only, and only for the better. Do it as its own commit.
- The body uses `overflow-y-auto overscroll-contain`, so scrolling the form doesn't scroll the page behind it.
- The `@skerp/ui` Select popovers are portalled and work inside the Sheet on touch devices. Check them on iOS.
- **Test widths:** 360, 390, 768, 1024, 1440 and 1920 px. Also landscape on a phone.

---

## 4. Admin side

### 4.1 Sidebar

In `apps/web/config/navigation.ts`:

- Remove the `Feedback` entry from the **Settings** group.
- Add a **top-level leaf** to the **Administration** section, after Settings:

```ts
// remove-before-prod: in-app feedback (testing phase only).
...(process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === "true"
  ? [
      {
        title: "Feedback",
        href: "/settings/feedback",
        icon: IconMessageReport,
        permission: PERMS.FEEDBACK.VIEW,
      },
    ]
  : []),
```

The route `app/(dashboard)/settings/feedback/page.tsx` stays unchanged.

### 4.2 List

| FB # | Type | What was reported | Reported by | Impact | Status | Files | Reported on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FB-0042 | Bug | **Save does nothing on LR form**<br>*LR Detail · Operations › Lorry Receipts* · *Section: Freight* | Pradeep Sharma<br>*Branch Manager, Pune* | High | New | 🎤 1:42 · 🖼 2 · 📄 1 | 27 Oct 2026, 12:02 PM |

- "What was reported" = the title the server made, plus page · module, plus the section when there is one.
- "Reported by" = the name, role and branch saved when the item was sent. A role change later doesn't alter it.
- "Files" = a voice note with its length, and the picture and document counts.
- The table scrolls sideways on narrow screens. The filters wrap.

### 4.3 Filters and summary

- Filters: Status (incl. "Open"), **Type** (7), **Impact** (replaces Severity), Module, Page, Role, date range, search.
- Search also matches `description`, as well as title, page, reporter and FB number.
- Summary cards (Open / New / Fixed / All) and "Pages with most feedback" stay as they are. The per-type counts pick up the new types automatically from `FEEDBACK_CATEGORIES`.

### 4.4 Detail panel

In order:

1. **Where it happened:** page, address (link that opens the page), record, **section**, what they pointed at.
2. **Reported by:** name, role, branch, date, browser, app version.
3. **What they told us:** the text, then the points as a numbered list.
4. **Voice note:** `<audio controls>` with 1× / 1.5× / 2× speed buttons, the length (`voiceSeconds`), and Download.
5. **Pictures:** thumbnails that open full size.
6. **Documents:** name, size, Download. Downloads always use `Content-Disposition: attachment` through `presignDownload(key, filename)`, so files never open inline from storage.
7. **Missing files warning**, when `context.attachmentsPlanned` is more than what arrived: "The reporter attached 3 files but only 2 arrived."
8. **Answers from the old form**, for migrated v1 items only. Shows `details` with labels from `LEGACY_DETAIL_LABELS`.
9. **Technical details:** recent API errors and client errors (as v1).
10. **Conversation**, then **team notes / triage** (as v1).

The voice player, picture grid and document list are one shared component, `components/FeedbackFiles.tsx`. My feedback uses it too.

### 4.5 Triage

`TriageForm` replaces Severity with **Impact** (required, the four values). Status, assignee, Jira key, dev notes and bulk status work as before.

### 4.6 Exports and archive

| Output | Change |
| --- | --- |
| Excel (`feedback.export.ts`) | Columns: replace Severity with **Impact**; add **Section**, **Points** (numbered, one per line), **Voice note** (e.g. "1:42"), **Pictures** (count), **Documents** (file names); rename the old "Details" column to **Old form answers** (empty for v2 items). Pivot sheets pick up the new types from the constants. |
| Word (`feedback.docx.ts`) | Embed **images only**. List documents by name. Show the voice note as "Voice note (1:42), listen in the ERP" with the item link. Points become a numbered list. |
| Copy as Jira (`copy-as-jira.ts`) | Type · Impact · Status line, section, text, points as bullets, "Voice note attached (1:42)", the file list, and the item link. |
| Archive (`feedback.archive.ts`) | Already saves every clean attachment, using the extension from `originalName`. The server must store voice and document names with the right extension (`voice-note-102s.webm`, `voice-note-102s.m4a`, the user's own `.pdf`/`.docx`/`.xlsx` name). Add `section`, `points`, `impact` and `voiceSeconds` to the JSON/XLSX it writes. |

---

## 5. Data model

### 5.1 Prisma (`apps/server/prisma/schema.prisma`, feedback block only)

```prisma
enum FeedbackCategory {
  BUG
  IMPROVEMENT
  MISSING_FEATURE
  CONFUSING
  DATA_ISSUE
  TRAINING_HELP
  OTHER
}

enum FeedbackImpact {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// FeedbackSeverity is removed.

model Feedback {
  id          String           @id @default(cuid())
  number      Int              @unique @default(autoincrement())
  category    FeedbackCategory
  impact      FeedbackImpact   @default(MEDIUM)
  /// Made by the server: first line of the text, else the first point, else "<Type> on <Page>".
  title       String
  description String?
  /// Short points, in the order the reporter wrote them.
  points      String[]         @default([])
  /// Part of the page the feedback is about ("Whole screen" is stored as null).
  section     String?
  /// v1 form answers (category-specific). Empty object for v2 items.
  details     Json             @default("{}")
  /// Length of the voice note, set when its upload completes.
  voiceSeconds Int?
  status      FeedbackStatus   @default(NEW)
  // … pagePath, pageTitle, moduleLabel, entityId, context, reporter*, triage fields,
  //   timestamps and comments: unchanged …

  @@index([status])
  @@index([category])
  @@index([impact])
  @@index([moduleLabel, pagePath])
  @@index([reporterId])
  @@index([createdAt])
}
```

The column stays named `category` (and the enum `FeedbackCategory`), so filters (`filter[category]`),
the summary and exports keep their keys. The UI calls it **Type**.

### 5.2 Migration

Create it with `pnpm exec prisma migrate dev --create-only --name feedback_v2_form` (from `apps/server`). Then
**replace** the generated SQL. Prisma's version casts old values straight to the new enum, so it fails on
any row that uses a removed value, and it doesn't fill `impact` from `severity`:

```sql
-- Feedback v2 (B10). Back up first: run feedback.archive.ts.

-- 1. New types, mapping the old ones.
ALTER TYPE "FeedbackCategory" RENAME TO "FeedbackCategory_v1";
CREATE TYPE "FeedbackCategory" AS ENUM
  ('BUG', 'IMPROVEMENT', 'MISSING_FEATURE', 'CONFUSING', 'DATA_ISSUE', 'TRAINING_HELP', 'OTHER');
ALTER TABLE "Feedback"
  ALTER COLUMN "category" TYPE "FeedbackCategory"
  USING (
    CASE "category"::text
      WHEN 'BUG'         THEN 'BUG'
      WHEN 'FINDABILITY' THEN 'CONFUSING'
      ELSE 'IMPROVEMENT'            -- FLOW, UI, SUGGESTION
    END
  )::"FeedbackCategory";
DROP TYPE "FeedbackCategory_v1";

-- 2. Impact replaces severity.
CREATE TYPE "FeedbackImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
ALTER TABLE "Feedback" ADD COLUMN "impact" "FeedbackImpact" NOT NULL DEFAULT 'MEDIUM';
UPDATE "Feedback" SET "impact" = CASE "severity"::text
    WHEN 'BLOCKER' THEN 'CRITICAL'
    WHEN 'MAJOR'   THEN 'HIGH'
    WHEN 'MINOR'   THEN 'LOW'
    ELSE 'MEDIUM'
  END::"FeedbackImpact";
ALTER TABLE "Feedback" DROP COLUMN "severity";
DROP TYPE "FeedbackSeverity";

-- 3. New fields.
ALTER TABLE "Feedback" ADD COLUMN "points" TEXT[] DEFAULT ARRAY[]::TEXT[]; -- same shape Prisma generates for String[]
ALTER TABLE "Feedback" ADD COLUMN "section" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "voiceSeconds" INTEGER;
ALTER TABLE "Feedback" ALTER COLUMN "details" SET DEFAULT '{}';
CREATE INDEX "Feedback_impact_idx" ON "Feedback"("impact");
```

The migration is in `apps/server/prisma/migrations/20261028000000_feedback_v2_form/`. Its end state was
checked against `prisma migrate diff` (old schema → new schema): same columns, defaults and index
names, so there's no drift. Apply it with `pnpm db:migrate` (dev) or `pnpm --filter @skerp/server db:deploy`,
then `pnpm db:generate`. `FeedbackComment` and `Attachment` don't change.

---

## 6. Shared schemas (`packages/validators/src/feedback/feedback.schema.ts`)

Remove: the five per-category schemas, `FEEDBACK_DETAIL_FIELDS`, the v1 choice lists (`FEEDBACK_FREQUENCIES`,
the flow-impact list, `FEEDBACK_UI_PROBLEMS`, `FEEDBACK_FOUND`), `FEEDBACK_SEVERITIES` and
`feedbackScreenshotRequestSchema`. Keep their labels only in one flat `LEGACY_DETAIL_LABELS`
(key → label, plus the choice-value labels), which is used to display migrated items.

Add (sketch):

```ts
export const FEEDBACK_CATEGORIES = [
  "BUG", "IMPROVEMENT", "MISSING_FEATURE", "CONFUSING",
  "DATA_ISSUE", "TRAINING_HELP", "OTHER",
] as const;
export const FEEDBACK_IMPACTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const FEEDBACK_MAX_POINTS = 10;
export const FEEDBACK_MAX_POINT_CHARS = 300;
export const FEEDBACK_MAX_FILES = 6;                       // images + documents
export const FEEDBACK_MAX_FILE_BYTES = 12 * 1024 * 1024;
export const FEEDBACK_MAX_VOICE_SECONDS = 180;
export const FEEDBACK_MAX_VOICE_BYTES = 10 * 1024 * 1024;

export const FEEDBACK_IMAGE_MIMES = ["image/jpeg", "image/png"] as const;
export const FEEDBACK_DOCUMENT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
] as const;
export const FEEDBACK_VOICE_MIMES = ["audio/webm", "audio/mp4", "audio/ogg"] as const;

export const feedbackFormSchema = z
  .object({
    category: z.enum(FEEDBACK_CATEGORIES, { errorMap: () => ({ message: "Choose a type" }) }),
    impact: z.enum(FEEDBACK_IMPACTS),
    section: z.string().trim().max(120).optional(),
    description: z.string().trim().max(4000, "Please keep this under 4000 characters").optional(),
    points: z
      .array(z.string().trim().max(FEEDBACK_MAX_POINT_CHARS, "Please keep each point under 300 characters"))
      .max(FEEDBACK_MAX_POINTS)
      .transform((points) => points.filter((point) => point.length > 0)),
    hasVoiceNote: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.description && value.points.length === 0 && !value.hasVoiceNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Tell us what happened: type it, add a point, or record your voice.",
      });
    }
  });

// Add to the existing feedbackContextSchema object (v1 fields unchanged):
  attachmentsPlanned: z
    .object({
      voice: z.boolean(),
      images: z.number().int().min(0).max(FEEDBACK_MAX_FILES),
      documents: z.number().int().min(0).max(FEEDBACK_MAX_FILES),
    })
    .optional(),

/** POST /feedback/:id/files: one request per file. */
export const feedbackFileRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    mime: z.enum(FEEDBACK_IMAGE_MIMES),
    sizeBytes: z.number().int().positive().max(FEEDBACK_MAX_FILE_BYTES),
    width: z.number().int().positive().max(10_000),
    height: z.number().int().positive().max(20_000),
  }),
  z.object({
    kind: z.literal("document"),
    mime: z.enum(FEEDBACK_DOCUMENT_MIMES),
    sizeBytes: z.number().int().positive().max(FEEDBACK_MAX_FILE_BYTES),
    name: z.string().trim().min(1).max(160),
  }),
  z.object({
    kind: z.literal("voice"),
    mime: z.enum(FEEDBACK_VOICE_MIMES),
    sizeBytes: z.number().int().positive().max(FEEDBACK_MAX_VOICE_BYTES),
    durationSec: z.number().int().min(1).max(FEEDBACK_MAX_VOICE_SECONDS),
  }),
]);

/** Triage: `severity` → `impact` (required). */
```

`feedbackSubmitSchema`, `feedbackTriageSchema`, `feedbackBulkStatusSchema`, the comment and confirm schemas
keep their shape (with `severity` → `impact` in triage).

**Points in the form:** `points` is a `string[]`, so the server and the web share one schema.
`PointsField` registers `points.${i}` and adds or removes rows with `setValue`. It keeps a local list
of ids for React keys, because index keys lose focus when a middle row is removed.
`useFieldArray` isn't used, because it needs an array of objects.

`packages/types/src/feedback/feedback.type.ts`:

- `FeedbackSeverity` → `FeedbackImpact`.
- `FeedbackScreenshot` → `FeedbackFile = { id; kind: "image" | "document" | "voice"; name; mime; sizeBytes; url }`.
- `FeedbackDetail.screenshots` → `files`. Add `points`, `section`, `voiceSeconds` and `impact`.
- `FeedbackListItem` and `MyFeedbackItem` add `impact`, `section`, `voiceSeconds`, `imageCount`, `documentCount`.
- `FeedbackStatusInfo.screenshots` → `uploads`.

---

## 7. API changes (`apps/server/src/modules/feedback/feedback.route.ts`)

| Method | Path | Permission | Change |
| --- | --- | --- | --- |
| GET | `/feedback/status` | logged in | Returns `{ enabled, uploads }` (was `screenshots`). |
| POST | `/feedback` | logged in | New form. The server sets `title = deriveTitle(form, page)` and stores `points`, `section` and `impact`. `details` becomes `{}`. Rate limit unchanged (20/hour). |
| GET | `/feedback/mine` | logged in (own only) | Adds `impact`, `section`, `voiceSeconds` and file counts (one `groupBy` on `Attachment`). |
| GET | `/feedback/:id` | reporter or `feedback.view` | `screenshots` → `files` (all kinds, with presigned URLs). `name` is the stored `originalName`. |
| POST | `/feedback/:id/files` | reporter only | **Replaces** `/:id/screenshots`. Body: `feedbackFileRequestSchema`. Limits: at most 1 voice note (`mime` starts with `audio/`) and at most 6 other files per item, counted over rows that aren't deleted. Calls `createAttachment(input, userId, { maxBytes, mimes })`. |
| POST | `/feedback/:id/files/:attachmentId/complete` | reporter only | **Replaces** the screenshots complete route. For a voice note, it takes `{ durationSec }` and sets `Feedback.voiceSeconds`. |
| GET | `/feedback` | `feedback.view` | Adds `impact`, `section` and file counts. `filter[severity]` → `filter[impact]`. Search also matches `description`. |
| PATCH | `/feedback/:id` | `feedback.manage` | `severity` → `impact`. |
| PATCH | `/feedback/bulk` | `feedback.manage` | Unchanged. |
| GET | `/feedback/summary`, `/export/xlsx`, `/export/docx` | `feedback.view` | See §4.3 and §4.6. |
| comments / confirm | | | Unchanged. |

**Stored file names:**

- images: `picture-<w>x<h>.jpg`
- documents: the user's file name, cleaned up: path removed, characters outside `[\w .()-]` replaced, max 160, extension forced to match the mime
- voice notes: `voice-note-<seconds>s.webm`, `.m4a` or `.ogg`

**`deriveTitle`** (in `feedback.service.ts`, unit-tested):

1. The first non-empty line of `description`.
2. Otherwise the first point.
3. Otherwise `"<Type label> on <page title>"`, e.g. "Improvement on Order Board".

The result is cut to 120 chars at a word boundary, with "…" added.

**`createAttachment` change** (`apps/server/src/modules/attachments/attachment.service.ts`): add an optional
third argument `limits?: { maxBytes?: number; mimes?: readonly string[] }`. When given, it replaces the
env limits for that call. Without it, nothing changes for existing callers. The argument doesn't mention
feedback, so it doesn't need to be reverted when feedback is removed.

---

## 8. File-by-file change list

### packages

| File | Change |
| --- | --- |
| `packages/validators/src/feedback/feedback.schema.ts` | §6 |
| `packages/types/src/feedback/feedback.type.ts` | §6 types |
| `packages/ui/src/components/input.tsx` | `text-sm` → `text-base md:text-sm` (iOS zoom, §3.10). Separate commit. |

### server

| File | Change |
| --- | --- |
| `prisma/schema.prisma` + `migrations/<ts>_feedback_v2_form/` | §5 |
| `src/modules/feedback/feedback.route.ts` | §7 |
| `src/modules/feedback/feedback.service.ts` | `deriveTitle`; remove `pickDetails`; `findScreenshots` → `findFeedbackFiles` (returns `mime`); add `fileKind(mime)`; `listSelect` adds the new fields; `buildFeedbackWhere` handles `impact` and description search; `describeFilters` handles impact |
| `src/modules/feedback/feedback.export.ts` | §4.6 Excel |
| `src/modules/feedback/feedback.docx.ts` | §4.6 Word (embed `image/*` only) |
| `src/modules/feedback/feedback.archive.ts` | New fields in the archive. Check the extensions. |
| `src/modules/feedback/__tests__/feedback.test.ts` | §10 |
| `src/modules/attachments/attachment.service.ts` | Optional `limits` argument (§7) |

### web (`apps/web/features/feedback/`)

| File | Change |
| --- | --- |
| `components/FeedbackLauncher.tsx` | Icon-only below `sm`. Read `status.uploads`. |
| `components/FeedbackSheet.tsx` | New header and the two tabs. Responsive width and height (§3.10). Holds in-memory attachments in a `Map<pagePath, PendingAttachments>` (D13). Hosts the picker. |
| `components/FeedbackForm.tsx` | Rewritten around §3.3. Keeps `PageBanner`, `WhatWeAttach` and the success screen (plus Retry). |
| `components/PointsField.tsx` | **New** (§3.3, §6) |
| `components/SectionField.tsx` | **New** (§3.4) |
| `components/VoiceRecorder.tsx` | **New** (§3.5) |
| `components/AttachmentsSection.tsx` | **New**, replaces `ScreenshotSection.tsx` (§3.6). Keeps the `AnnotateDialog` use. |
| `components/FeedbackFiles.tsx` | **New** read-only voice / picture / document view, used by My feedback and admin (§4.4) |
| `components/MyFeedbackList.tsx` | Cards plus a detail view (§3.8) |
| `components/badges.tsx` | `FeedbackImpactBadge` replaces the severity badge. Category badge uses the new labels. |
| `components/CategoryFields.tsx`, `components/ChoiceField.tsx`, `components/ScreenshotSection.tsx` | **Delete** |
| `categories.ts` | Becomes the meta for the 7 types (label, hint, icon), used by the select and the badges |
| `form-values.ts` | `{ category: "", impact: "MEDIUM", section: "", description: "", points: [""], hasVoiceNote: false }` |
| `feedback.service.ts` | `requestFile` / `completeFile` replace the screenshot calls. `uploadToStorage` takes an `onProgress` callback. |
| `lib/voice.ts` | **New**: `useVoiceRecorder()` hook, `pickVoiceMime()`, `voiceSupport()` |
| `lib/files.ts` | **New**: `classifyFile(file)` (with the extension fallback), the limit checks, and the `PendingAttachment` types |
| `lib/upload.ts` | **New**: upload queue (2 at a time, progress, retry). Moved out of `FeedbackForm`. |
| `lib/page-sections.ts` | **New** (§3.4) |
| `lib/copy-as-jira.ts` | §4.6 |
| `lib/draft.ts` | Unchanged. On load, `hasVoiceNote` is reset from memory, not from the stored draft. |
| `admin/FeedbackTable.tsx`, `FeedbackFilters.tsx`, `FeedbackDetailSheet.tsx`, `TriageForm.tsx`, `FeedbackSummaryCards.tsx` | §4.2–4.5 |
| `apps/web/config/navigation.ts` | §4.1 |

### docs

| File | Change |
| --- | --- |
| `docs/FEEDBACK_GO_LIVE.md` | 5c: `FeedbackSeverity` → `FeedbackImpact` in the DROP list. 5b: the navigation row now says "the Administration → Feedback entry". Note that the `createAttachment` `limits` argument and the `Input` font change stay. |
| `docs/TRAINING_FEEDBACK_JIRA.md` | Link to this document from Epic B. |

---

## 9. Pitfalls

1. **The presigned PUT checks `Content-Type` exactly.** `MediaRecorder` reports `audio/webm;codecs=opus`, but the
   URL is signed for `audio/webm`. Build the Blob with the base type, or the upload fails with 403.
2. **Chrome's WebM recordings have no duration.** `<audio>` shows `0:00` or `Infinity` and seeking is unreliable
   until the file has loaded. Always show `voiceSeconds` / the recorder timer.
3. **Older Safari may not play WebM.** The admin player always has a Download link as a fallback. Check on the iOS version testers actually use.
4. **The microphone needs https** (or `localhost`). Opening the app by plain LAN IP (`http://192.168…`) hides voice recording, with the reason shown.
5. **iOS stops the microphone** when the screen locks or the tab is in the background. Stop recording on `visibilitychange` and keep what was recorded.
6. **Always stop the `MediaStream` tracks.** Otherwise the recording indicator stays on after the popup closes.
7. **An empty `file.type` for Office files** on some Windows setups. Fall back to the extension.
8. **No antivirus yet** (D9). Keep the format list strict, and keep downloads as `attachment`.
9. **iOS zooms** into inputs under 16 px. See §3.10.
10. **Free object URLs** (`URL.revokeObjectURL`) when a file is removed, after a successful send, and when the popup unmounts.
11. **The 12 MB limit is above the 10 MB global attachment limit.** Use the per-call `limits` (D11). Don't raise the env variable.
12. **Antivirus status:** `findFeedbackFiles` keeps filtering on `antivirusStatus: "CLEAN"`, so files will hide correctly once scanning is connected.

---

## 10. Testing

`pnpm check-types`, `pnpm lint` and `pnpm build` must pass. The server has vitest (`pnpm --filter @skerp/server test`),
but it isn't part of `turbo`, so run it by hand.

### Unit tests (`apps/server/src/modules/feedback/__tests__/feedback.test.ts`)

- `feedbackFormSchema`:
  - type required
  - the D7 rule: each of text / point / voice alone passes, none fails
  - empty points are dropped
  - more than 10 points, or a point over 300 chars, fails
- `feedbackFileRequestSchema`:
  - each kind's mime list and size limits
  - voice over 180 s fails
  - `.xls`, `.docm` and CSV mimes are rejected
- `deriveTitle`: text, then first point, then type and page; cut at 120 chars on a word boundary.
- `fileKind`: image, document and voice mimes.
- Excel: the new columns are present; a v1 item shows its old answers; a v2 item shows points numbered.
- Word: documents and voice are listed, not embedded; images are still embedded.
- `buildFeedbackWhere`: `filter[impact]`, and search matching the description.

### Manual matrix

| Device / browser | Must work |
| --- | --- |
| Windows: Chrome, Edge, Firefox (desktop widths) | Every form path, drag and drop, paste, record and play voice, admin list / detail / exports |
| Android phone: Chrome (360–412 px) | Full-screen popup, footer above the keyboard, camera from Choose files, voice record and play |
| iPhone: Safari (390 px) | Same as Android, plus: no zoom on focus, voice in `audio/mp4`, recording stops cleanly when the screen locks |
| iPad: Safari (768 / 1024 px) | Two-column layout, picker, voice |

### Scenarios

1. Send with only a voice note, then check it in My feedback and in the admin detail panel, and play it at 1.5×.
2. Send with 6 files (images and documents). A 7th file is refused, and so are a 13 MB PDF and an `.xls`.
3. Cut the network during the upload. The confirmation shows a failed count, and Retry attaches the rest.
4. Type text, close the popup, open it on another page and come back. Each page keeps its own draft.
5. Deny the microphone, and open over http. Each shows a clear message, and the rest of the form still works.
6. A migrated v1 item shows its new type and impact, plus "Answers from the old form".
7. The Feedback sidebar item is visible only to roles with `feedback.view`, and old `/settings/feedback?id=…` links still open the item.

---

## 11. Stories

Work on **one branch with one commit per story, merged as one PR**. The enum change breaks the v1 form at
compile time, so B10–B12 can't merge on their own. B12 and B16 can be built in parallel once B11 is in.

### B10 · Shared schema + data migration (3 pts)

**Summary:** Replace the five-tab schema with the single v2 form schema, and migrate existing reports.

**Description:** §5 and §6. Back up with `feedback.archive.ts` before running the migration on any shared database.

**Acceptance criteria**
- [ ] `FeedbackCategory` has the 7 new values, `FeedbackImpact` exists, and `FeedbackSeverity` is gone.
- [ ] Every existing row is mapped as in D8. No row is lost, and `details` is kept.
- [ ] `prisma migrate dev --create-only` afterwards produces an empty migration (no drift).
- [ ] Validators and types export the §6 names. The v1 per-category schemas are removed.

### B11 · Server API: submit, files and voice (5 pts)

**Summary:** Accept the v2 form, make titles, and accept documents and voice notes with per-call limits.

**Description:** §7, plus the `createAttachment` `limits` argument.

**Acceptance criteria**
- [ ] `POST /feedback` stores `impact`, `section` and `points`, with the title from `deriveTitle`.
- [ ] `POST /feedback/:id/files` enforces 1 voice note + 6 files, the size and type limits, and reporter-only access.
- [ ] Completing a voice upload sets `voiceSeconds`.
- [ ] `GET /feedback/:id` returns `files` with `kind`, and `/mine` and `/` return the counts.
- [ ] Other modules' uploads still use the env limits (no change in behaviour).

### B12 · Popup and Give feedback form, responsive (8 pts)

**Summary:** Rebuild the popup as the single v2 form, with Give feedback / My feedback tabs, on every screen size.

**Description:** §3.1–3.4, 3.7, 3.9 and 3.10. Includes `PointsField`, `SectionField`, the upload queue with retry, and the `Input` font fix.

**Acceptance criteria**
- [ ] The same form opens on every logged-in page, and the header shows that page and module.
- [ ] Type and the D7 rule are enforced with the §3.9 messages.
- [ ] Points: add, remove, Enter adds a row, Backspace on an empty row removes it, at most 10.
- [ ] Page section lists the page's headings, and "Point at it on screen…" sets the section and adds a marked picture.
- [ ] Phone: full-screen popup, one column, footer pinned above the keyboard, no zoom on focus (iOS).
- [ ] Tablet and desktop: right-hand panel, two columns at the §3.10 widths.
- [ ] Failed uploads can be retried from the confirmation screen.

### B13 · Voice recorder (5 pts)

**Summary:** Record, play back, re-record and delete one voice note of up to 3 minutes.

**Description:** §3.5 and §9 items 1–6.

**Acceptance criteria**
- [ ] Records on Chrome, Edge, Firefox, Android Chrome and iPhone Safari, and plays back before sending.
- [ ] Stops by itself at 3:00 and when the tab is hidden, keeping what was recorded.
- [ ] The microphone indicator turns off after Stop, Delete and closing the popup.
- [ ] Denied permission, no microphone and http each show their §3.9 message.
- [ ] The upload succeeds (the Content-Type matches the presigned URL).

### B14 · Images and documents (3 pts)

**Summary:** Attach up to 6 images or documents: choose, camera, paste, drag and drop, picture of the page.

**Description:** §3.6 and D9.

**Acceptance criteria**
- [ ] Images are re-encoded to JPEG and can be marked. PDF, .docx and .xlsx upload as they are.
- [ ] Refused types and sizes show the §3.9 messages, and the counter stops at 6.
- [ ] `.docx`/`.xlsx` with an empty `file.type` are recognised by extension.

### B15 · My feedback (3 pts)

**Summary:** Reporters see their own items as cards and open each one with its files, voice note and conversation.

**Description:** §3.8, using `FeedbackFiles`.

**Acceptance criteria**
- [ ] Only the caller's items are shown. The "New" markers and the button dot work as in v1.
- [ ] The detail view plays the voice note, opens pictures, downloads documents, and shows the conversation and Confirm fix.

### B16 · Admin: sidebar entry, list, filters, detail, triage (5 pts)

**Summary:** Give the inbox its own sidebar item and show the v2 fields everywhere the team works.

**Description:** §4.1–4.5.

**Acceptance criteria**
- [ ] The "Feedback" sidebar item is under Administration, visible only with `feedback.view`, and opens `/settings/feedback`.
- [ ] The list shows Type, Impact, Section, the reporter's name / role / branch, and file indicators.
- [ ] The Impact filter replaces Severity, and search finds text in the description.
- [ ] The detail panel shows everything in §4.4, including the missing-files warning and the old-form answers.
- [ ] Triage edits Impact.

### B17 · Exports, Copy as Jira, archive, docs (3 pts)

**Summary:** Bring every output and the go-live doc up to v2.

**Description:** §4.6, plus the §8 docs rows.

**Acceptance criteria**
- [ ] Excel has the §4.6 columns. Word embeds images and lists documents and the voice note.
- [ ] Copy as Jira includes impact, section, points and attachments.
- [ ] The archive writes the voice and document files with the right extensions, plus the new fields.
- [ ] `FEEDBACK_GO_LIVE.md` is updated as in §8.

**Total: 35 pts.**

---

## 12. Out of scope (later)

- Voice transcription and search.
- Telling developers about new Critical items (one-way call into the notifications module).
- "Already reported on this page" / "Me too" before sending.
- Linking duplicates (`duplicateOfId`, planned in v1 but never added).
- Antivirus scanning (needed before any wider rollout of document uploads).
- Feedback on pages outside `AppShell` (login, forgot password).
