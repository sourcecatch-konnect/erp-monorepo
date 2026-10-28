# In-app feedback: go-live switch-off and removal (B9)

The feedback button is for the testing phase only (Jira label
`remove-before-prod`). This is the runbook for turning it off at go-live and
deleting it afterwards. Do the steps in order; each one can be undone until
step 5.

| Step | When | Undo |
| --- | --- | --- |
| 1. Archive | Go-live day, before anything else | Nothing to undo |
| 2. Switch off | Go-live day | Set the two flags back to `"true"` |
| 3. Check it's off | Straight after step 2 | — |
| 4. Wait | About 30 days of normal running | — |
| 5. Remove | One PR after the wait | Only from the archive (step 1) |

The **training copy** (see `TRAINING_ENVIRONMENT.md`) also uses feedback.
Steps 2–3 are per deployment, so the training copy can keep it on after
production goes live. Step 5 removes it from every deployment.

---

## 1. Archive everything

Run on the production server (or anywhere with the production
`DATABASE_URL` **and** `AWS_S3_BUCKET` / AWS credentials, so the pictures,
documents and voice notes can be downloaded):

```bash
cd apps/server
pnpm exec tsx src/modules/feedback/feedback.archive.ts /path/to/release-docs
```

It is read-only and works whether feedback is on or off. It writes
`skerp-feedback-archive-YYYY-MM-DD/` containing:

| File | What |
| --- | --- |
| `feedback.xlsx` | Every item, no row limit, plus the By page / By status sheets |
| `feedback-report-N.docx` | Developer report by module → page, 300 items per file, pictures embedded, documents and voice notes listed |
| `feedback.json` | Every stored field and the full conversation (lossless) |
| `attachments/` | Every file reporters attached (pictures, documents, voice notes), named after the item (`FB-0042-1.jpg`, `FB-0042-2.webm`) |
| `README.txt` | Counts and what is where |

Check `README.txt`: **Attachments** must say `N saved of N`. If it doesn't,
fix S3 access and run again. Step 5 deletes the S3 files, so this archive is
the only copy afterwards. Store the folder with the release docs.

## 2. Switch off (go-live day)

| Where | Change | Takes effect |
| --- | --- | --- |
| Server env | `FEEDBACK_ENABLED="false"` (or remove it), restart | Immediately: every `/feedback/*` returns 404, and the web button hides itself because `GET /feedback/status` 404s |
| Web build env | `NEXT_PUBLIC_FEEDBACK_ENABLED="false"` | Next web build: the button and the Administration → Feedback sidebar item are not built at all |

Switching off never deletes data. The tables, files and permissions stay
until step 5, so turning the flags back on restores everything.

## 3. Check it's off

- `curl -i https://<api-host>/feedback/status` → `404`.
- Signed in as an admin: no **Feedback** button in the top bar, no
  **Feedback** item under Administration in the sidebar, and `/settings/feedback` shows "not found"
  (after the web rebuild).
- Browser dev tools → Network, reload any page: no request to `/feedback/status`
  and no feedback chunk (after the web rebuild).

## 4. Wait

Run normally for about 30 days. If testers still need to report something
urgent, switching the flags back on is safe (step 2 in reverse).

## 5. Remove (one PR)

Branch from `main`, then do all of the following in **one** PR.

### 5a. Delete the five feedback folders

```
apps/server/src/modules/feedback/
apps/web/features/feedback/
apps/web/app/(dashboard)/settings/feedback/
packages/validators/src/feedback/
packages/types/src/feedback/
```

> **Do not delete `apps/web/components/feedback/`.** Despite the name it is
> unrelated: it holds the shared `ReasonDialog`, `ConfirmDialog`,
> `CloseTripDialog` and `DispatchTripDialog` used by Orders, Trips, LRs,
> MR/RR, VP screens and the Log Slip workbench.

### 5b. Revert the touch points

Every one is marked `remove-before-prod` in the code.

| File | Remove |
| --- | --- |
| `apps/server/src/index.ts` | The `feedbackRoute` / `isFeedbackEnabled` import and the `if (isFeedbackEnabled()) app.use("/feedback", …)` line |
| `apps/server/eslint.config.js` | The `no-restricted-imports` block guarding `modules/feedback` |
| `apps/server/prisma/schema.prisma` | The whole "In-app feedback — TESTING PHASE ONLY" block: `Feedback`, `FeedbackComment` and the five `Feedback*` enums. No other model has a relation to them |
| `apps/server/.env.example` | `FEEDBACK_ENABLED` and its comment |
| `apps/web/components/layout/AppShell.tsx` | The `FeedbackLauncher` import and `<FeedbackLauncher />` |
| `apps/web/config/navigation.ts` | The `NEXT_PUBLIC_FEEDBACK_ENABLED` Feedback item in the Administration section (and the `IconMessageReport` import if nothing else uses it) |
| `apps/web/eslint.config.js` | The `no-restricted-imports` block guarding `@/features/feedback` |
| `apps/web/.env.example` | `NEXT_PUBLIC_FEEDBACK_ENABLED` and `NEXT_PUBLIC_APP_VERSION` (only feedback reads it) with their comments |
| `packages/types/src/permissions.ts` | `FeedbackPermissionKey` (type and its use in the `PermissionKey` union) and the `PERMS.FEEDBACK` group |
| `packages/types/src/index.ts` | `export * from "./feedback/feedback.type.js"` |
| `packages/validators/src/index.ts` | `export * from "./feedback/feedback.schema.js"` |
| `packages/validators/package.json` | The `"./feedback"` subpath export |
| `turbo.json` | `FEEDBACK_ENABLED`, `NEXT_PUBLIC_FEEDBACK_ENABLED`, `NEXT_PUBLIC_APP_VERSION` in `globalEnv` |
| `apps/web/Dockerfile` | The `NEXT_PUBLIC_FEEDBACK_ENABLED` `ARG` and its `ENV` line |
| `.github/workflows/production.yml` | The `NEXT_PUBLIC_FEEDBACK_ENABLED` build-arg (then delete the repo variable of the same name) |
| `deploy/docker-compose.prod.yml` | `FEEDBACK_ENABLED` in the server `environment` |
| `deploy/.env.example` | The "In-app feedback" block (and `FEEDBACK_ENABLED` in the host's real `.env`) |
| `docs/TRAINING_ENVIRONMENT.md` | The Feedback paragraph and the two `FEEDBACK` lines in the env blocks |

Keep the three existing migrations (`…_feedback_testing_phase`,
`…_feedback_comments`, `…_feedback_v2_form`): they are history and must stay.

Two changes made for feedback v2 are generic and **stay**: the optional
`limits` argument of `createAttachment` (attachment.service.ts) and the
`text-base md:text-sm` font size on the shared `Input` (stops iOS zooming into
fields). Neither mentions feedback.

### 5c. Migration

After editing `schema.prisma`, generate the migration without applying it:

```bash
cd apps/server
pnpm exec prisma migrate dev --create-only --name remove_feedback
```

Check that the generated `migration.sql` drops exactly the two tables and the
five enums, then add the two `DELETE` statements at the end. Expected result:

```sql
-- Remove in-app feedback (B9). Archived beforehand with feedback.archive.ts.
DROP TABLE "FeedbackComment";
DROP TABLE "Feedback";
DROP TYPE "FeedbackCommentKind";
DROP TYPE "FeedbackCommentSide";
DROP TYPE "FeedbackCategory";
DROP TYPE "FeedbackStatus";
DROP TYPE "FeedbackImpact";

-- The permission seed only adds keys, never deletes them. RolePermission and
-- UserPermission rows go with these (ON DELETE CASCADE).
DELETE FROM "PermissionDef" WHERE "key" IN ('feedback.view', 'feedback.manage');

-- Picture records. Nothing references Attachment rows; the S3 files are
-- deleted separately (5d).
DELETE FROM "Attachment" WHERE "entityType" = 'Feedback';
```

Then `pnpm db:generate`.

### 5d. S3 files

Only after the archive shows every attachment saved (step 1), delete the
prefix in the production bucket (and the training bucket if it has one):

```bash
aws s3 rm "s3://<bucket>/attachments/Feedback/" --recursive
```

### 5e. Check

- `pnpm build:packages`, `pnpm check-types`, `pnpm lint`, `pnpm build` all pass.
- This prints nothing except the Prisma migration history, the generic
  `apps/web/components/feedback/` dialogs and their imports:
  ```bash
  git grep -n -i feedback -- apps packages turbo.json ':!*.md'
  ```
- Smoke test on staging: Order → LR → Trip → Bill → Receipt, plus
  cancelling an order and closing a trip (both use the `components/feedback`
  dialogs).
- Mark B9 done in `TRAINING_FEEDBACK_JIRA.md`.
