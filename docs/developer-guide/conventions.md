# Conventions (rules every developer must follow)

> Last checked: 2026-10-09 · Audience: developers

These rules keep the money correct and the system safe. A new feature must follow them.

## Money

- **All money is stored in paise** as `BigInt` (column names end in `Paise`, e.g. `amountPaise`). ₹1 = 100 paise. Never use floating-point numbers for money.
- Send money to the browser as a **string**, and convert on screen.

## Accounting (the books)

- **Every money action posts a voucher** through `src/modules/ledger/posting.service.ts`. Never write `JournalEntry` / `JournalLine` rows anywhere else.
- A voucher must **balance**: total debit = total credit (`postJournal` checks this).
- **One voucher per source document:** the `(voucherType, sourceType, sourceId)` unique key stops duplicates.
- **Never delete or edit a posted voucher.** Correct it with `reverseJournal`, a new voucher in the opposite direction.
- Drafts (draft bills, salary runs, slips) **never** post. Posting happens on approve, finalise or pay.

## Never do the same money action twice

- Every "save money" request from the website sends a **`clientRequestId`** (unique). A retry or double click with the same ID returns the first result instead of creating a second one.
- A source document can't be claimed twice (e.g. a Vendor Payment line has a database rule on active sources).
- Status changes check the current status and **`version`**, so two people can't approve the same thing.

## Locks and transactions

- Money for one driver, or out of one cash/bank account, is serialised with **advisory locks** (e.g. `lockDriver`, `lockDrivers`, `lockDriverAndCash`). Take locks in a **fixed, sorted order** to avoid deadlocks.
- Keep transactions **short**: do the reads and checks **before** the transaction, and only the writes inside it. Reserve document numbers outside it.
- The database is far away in development (~130 ms per query), so **every extra query is slow**. Run independent reads in parallel (`Promise.all`), and write many rows with **one** statement, not one per row.

## Permissions

- Every route has `can(PERMS.<AREA>.<ACTION>)`.
- Keys live in `packages/types/src/permissions.ts`. **A new key also needs a readable name** in `packages/types/src/permission-labels.ts`, otherwise the build fails on purpose.
- Use `branchFilter(req)` on lists and `assertBranchAccess(req, branchId)` on writes for branch-limited users.
- After adding keys, run `seed-admin` to sync the permission list. Admin gets new keys automatically; other roles must be granted them.

## Validation

- The shapes of inputs are **Zod schemas in `packages/validators`**, used by both the website and the server. The server **never trusts amounts from the browser**: it recalculates them from the source records.

## Document numbers

- Use `nextSequence` + `formatDocNumber` (`_shared/doc-number.ts`). Numbers are per branch and financial year (e.g. `SKT/DSADV/JAL/26-27/00012`). A gap after a failed save is fine.

## Dates

- Store dates in UTC. Financial year = `fyCodeFor(date)`.

## Database changes

- Change `prisma/schema.prisma`, then run `pnpm db:migrate` to create a migration.
- Migrations must be **additive and safe for existing data**: add columns as optional or with defaults, and back-fill in the migration.
- Hand-written SQL (partial unique indexes, checks) goes into the migration file, with a comment in the schema.

## Notifications and audit

- Raise events with `publishNotificationEvent(...)` and a **`dedupeKey`**, so the same alert is never sent twice.
- Record important actions with `recordAuditEntry(...)`. It never throws, so it can't break the action.

## Secrets

- Secrets only in `.env` files that are **not committed**. `.env.example` holds **placeholders only**.
- Never log or print passwords, tokens or full database URLs.

## Before a pull request

1. `pnpm check-types`, `pnpm lint`, `pnpm test` all pass.
2. New permission → readable name added.
3. New migration → safe for existing data.
4. **Docs page updated** for the feature.
