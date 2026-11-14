# Job Card - Finance Flow and Implementation Plan

Date: 2026-11-12  
Status: Implementation in progress; completed slices and remaining work packages are recorded below. Baseline sections describe the original inspection.

### Implementation progress - 2026-11-12

The first implementation slice adds Finance navigation to the shared job card register, 400 ms debounced server search (card number, vehicle, driver), status filtering, and backend page requests. Filter changes reset to page zero without an intermediate request for the old page. Requests consume cancellation signals; the register does not prefetch pages or paginate a complete client-side dataset.

The backend list now selects only table fields, applies deterministic creation-date/ID ordering, and intersects requested filters with branch scope. Detail and batch lookup enforce branch access. A migration adds creation-date/ID and branch/creation-date/ID indexes; deployment must apply it before relying on those indexes. Substring search remains database filtering and is not accelerated by these ordering indexes; measure representative data before introducing a dedicated search index.

The second slice extracts finalisation into `job-card.service.ts`. Finalise claims a draft using status/version, validates completion time and aggregate batch demand, restricts batches to the job branch, and uses conditional atomic decrements for batch and branch quantities. Draft editing and cancellation also use conditional version/status guards; undo claims the finalised card and restores branch quantities with atomic increments. Services remain unposted until billing, and the batch-cost policy is unchanged.

Unit coverage exercises repeated-batch demand, running balances, stale finalise attempts, invalid dates/KM, branch/part mismatches, insufficient stock, services-only completion, and propagation of posting failures. Real database concurrency/rollback verification remains required before treating this as production concurrency certification. Create-and-finalise request-key idempotency and downstream billing/removed-part coordination are still pending; the status/version guard protects repeat finalisation of an existing card, not duplicate creation requests.

Payment approval integration, remaining lifecycle concurrency hardening, return lifecycle changes, and financial reporting remain subsequent phases. These slices do not change valuation or historical postings.

The third slice hardens service billing. Bill creation revalidates branch/provider/finalised status, claims source job cards by version, and conditionally claims unbilled lines in one transaction. Cancellation transitions only an unpaid, unchanged posted bill, checks payment history, releases active source claims, reverses the journal, and retains original bill lines. Direct payment reserves cash-plus-TDS settlement using the same bill version guard before creating the payment/voucher. Undo-finalise rechecks active billing after claiming the job card.

The history migration backfills immutable JSON service snapshots, changes source references to nullable with `ON DELETE SET NULL`, and permits a source service to appear on historical cancelled bills and a later replacement bill. Detail responses use snapshots, so correcting a reopened job card cannot rewrite an old bill's displayed quantities/rates/service. Existing bill lines deleted by older cancellations cannot be reconstructed by this migration. Apply `20261112010000_service_bill_history` before deploying the new server; Prisma generation alone does not update the database.

The eligible-services picker now uses 20-row backend pages and debounced search, retains only explicit selections across pages (maximum 500 per bill), and resets selection when branch/provider/cutoff changes. The bill register has debounced backend search and omits line histories from list payloads. Database indexes support register ordering and provider/unbilled filtering. Unit coverage includes eligibility, conflicting claims, snapshots, discounts, unpaid cancellation, and payment reservation; live database race/rollback/migration verification remains outstanding. Shared approval workflow, duplicate provider-invoice policy, and vehicle-level discount allocation remain later work.

### Repair cost reporting implementation - 2026-11-13

The sixth slice adds Finance -> Repair Cost Report, grouped by finalised job card with vehicle and branch references. Search uses the shared 400 ms debounced hook. Page navigation requests bounded backend rows; filtering resets the page and outstanding requests consume cancellation signals. Database queries calculate the full-filter summary separately from page rows within a repeatable-read transaction. Branch scope applies to both queries, with deterministic completion-date/ID ordering.

Current posted repair cost equals posted parts expense plus net posted service-bill allocations minus posted reusable-return credits. Unbilled service estimates and costs awaiting journal posting appear separately. Payments do not add expense. Date filters select job completion dates in India time, including the entire end date. Later bills and returns update a completed card's current cost; this is not a historical posting-period ledger report. The existing operational vehicle P&L remains unchanged.

Service bill lines now retain integer-paise discount/net allocations and immutable job/vehicle references. Proportional allocation uses largest remainders, with source-line ID as the deterministic rounding tie-breaker. Line discounts sum exactly to the bill discount; line net amounts sum to the bill net expense. Bill detail displays gross, discount, and net values.

Apply `20261112040000_job_card_cost_allocations` before deploying this slice. It backfills retained bill lines without reposting vouchers, adds reporting indexes and an allocation amount constraint, and aborts on inconsistent historical totals or posted job/vehicle attribution. Deleted historical cancellation rows cannot be reconstructed. Prisma generation does not apply this migration.

Validation passed: 115 targeted tests across job cards, service bills, vendor payments, and settlement ledger lines; server/web type checks and lint; Prisma schema validation. Tests cover allocation precision/rounding, validation, India date boundaries, branch scope, parameterised search, posted-source selection, and backend pagination/summary query contracts. Live PostgreSQL migration/query execution, representative-volume query plans, ledger reconciliation and Finance UAT remain required. Provider ageing, historical posting-period reporting, payment reversals, and rollout reconciliation remain later work.

### Provider outstanding implementation - 2026-11-13

The seventh slice adds Finance -> Provider Outstanding and `GET /service-bill/reports/outstanding`. It lists unpaid service bills with provider/shop, invoice, branch, bill date, net billed, settled cash-plus-TDS, remaining liability, and age. Bill links open the existing detail/payment workflow. Only POSTED bills with POSTED payable journals and a positive remaining balance qualify; cancelled, fully settled, and unposted-journal bills are excluded. The authoritative cumulative bill settlement counter includes historical direct payments and shared-engine cash/TDS payments, so the query does not duplicate liability by joining payment rows.

Age is the difference between the current India calendar date and bill date converted from stored UTC to India time. Buckets are future dated, 0–30, 31–60, 61–90, and over 90 days. Service bills have no due-date/payment-term field, so these are bill-age buckets rather than contractual overdue measures. Balances reflect current settlements; the report does not reconstruct an arbitrary past balance.

Search covers provider/shop, service bill number, and provider invoice. The UI uses the existing 400 ms debounced hook, resets pagination on search/bucket/page-size changes, consumes request cancellation, and requests bounded backend pages without prefetching a full dataset. Both page rows and full-filter bucket totals use the same parameterised filters and branch scope within a repeatable-read transaction. Explicit branch/provider filters are supported by the API; requested branch access is checked before intersecting assigned scope. Page order is oldest bill date then ID. Amounts remain integer paise in PostgreSQL and strings in responses, preserving values beyond JavaScript's safe-integer range.

The report reuses the service-bill query-key prefix, so existing billing, cancellation, and shared settlement mutations invalidate it. A Refresh action updates balances/date on demand. No schema change or new migration is needed for this slice; existing service-bill branch/status and provider/status indexes remain available. Representative-volume query plans and search indexing still require measurement.

Validation passed: 82 targeted service-bill, vendor-payment, and settlement-ledger tests; server/web type checks and lint; validators build and diff whitespace checks. Coverage includes bounded query validation, branch/search isolation, posted and positive-balance eligibility, calendar-age SQL boundaries, exact string amounts, and backend pagination/full-filter summary contracts. Live PostgreSQL date-boundary/query checks, historical balance reconciliation, representative-volume performance checks, and Finance UAT remain required. Next reporting work includes a cross-provider unbilled-services register and source/GL reconciliation; settlement reversals remain a separate workflow change.

### Unbilled register and expense reconciliation - 2026-11-13

Steps eight and nine add Finance -> Unbilled Services and Finance -> Repair Reconciliation.

The cross-provider unbilled register reads FINALISED job cards whose service lines have no active bill claim. It shows provider, service/part, job card, vehicle, branch, completion date, quantity, and the pre-discount operational estimate. Search covers provider, card, vehicle, and part. An optional completion cutoff includes the entire selected India calendar day. These are currently unbilled lines, including those released by cancelled bills; the cutoff does not reconstruct historical unbilled status. Database totals count services, distinct cards/providers, and exact integer-paise estimates across all matching rows. API branch/provider filters remain optional, enabling a cross-provider view.

The reconciliation report checks current finalised parts issues, POSTED service bills, and reusable returns against each source's linked journal. It compares signed repair expense using the stable REPAIR_EXPENSE ledger code, requires matching journal branch/source/voucher type, checks posting status and debit/credit balance, and reports missing return valuation or missing vouchers. Reusable returns are negative expense. Issues-only is the default; users can select all records or one source type. The summary counts structural issues even when monetary difference is zero and sums absolute differences so opposite errors do not cancel. Source links open existing documents and voucher numbers/Tally sync state support follow-up. Wrong-branch voucher details and amounts are withheld. A record displays its first applicable issue; resolving it can reveal another.

Reconciliation requires job-card view, service-bill view, and ledger view permissions on the server and page. The source branch scope applies independently to every union arm. It checks current linked expense vouchers only: orphan journals, cancelled-source reversal chains, inventory balances, provider settlements, replacement credit notes, historical posting-period balances, and Tally export validation remain separate work. Neither report changes postings or repairs data automatically.

Both screens use the shared 400 ms debounce hook, request cancellation, filter-driven page resets, and backend LIMIT/OFFSET pages. Full-filter totals and page rows share one repeatable-read transaction. Money is aggregated in PostgreSQL and returned as strings. They reuse the job-card query-key prefix, which existing finalise/undo, removed-part, service-bill creation and cancellation actions invalidate; Refresh also rechecks current data. No schema migration is introduced. Existing foreign-key/order/filter indexes support the source lookups; representative-volume plans and substring-search indexing still require measurement.

Validation passed: 127 targeted tests across job cards, service bills, vendor payments, and settlement-ledger lines; server/web type checks and lint; validators build and diff whitespace checks. New query-contract tests cover completion cutoffs, branch/provider scope, escaped parameterised search, fail-closed empty scope, signed expense, structural reconciliation issues, exact response amounts, backend pages, and unpaged summaries. These mocked query-contract tests do not execute SQL against PostgreSQL; live query/date-boundary checks remain part of step 15.

### Create-request and provider-invoice safety - 2026-11-13

Step ten adds a required UUID clientRequestId to job-card create and create-and-finalise. A transaction-scoped advisory lock serialises matching UUIDs before lookup; both routes explicitly use READ COMMITTED so a waiter sees the preceding committed request. New cards persist the UUID and a SHA-256 fingerprint covering the parsed payload, actor, and action, with canonical object-key ordering and exact bigint serialisation. A matching retry returns the original card's current record without repeating numbering, creation, stock issue, or voucher posting. A changed payload/action/actor or a card moved to another branch produces a conflict. Responses recheck the current branch before returning details. UUID uniqueness is also database-enforced, and request metadata commits or rolls back with the card and its effects.

The form retains one lazily generated request UUID while mounted, including after failed/uncertain responses, and disables Save and Finalise while either is pending. It deliberately does not rotate the UUID merely because a user edits after an uncertain result: the server detects an already-committed changed request instead of creating a duplicate. A newly opened form creates a new identity; request recovery across browser reloads is not implemented. Draft editing does not require or modify the original create identity. Old clients without a valid UUID must be refreshed before creating cards.

The invoice policy is one active service bill per provider, financial year derived from billDate, and case-insensitive provider invoice number after trimming surrounding SQL spaces, across branches. Punctuation and internal whitespace remain significant; invoice dates do not define this key. CANCELLED bills retain history and do not reserve the key, allowing a replacement. An exact normalised database lookup provides an early conflict without disclosing another branch's bill details. A partial functional unique index prevents concurrent duplicates, and a unique violation on bill header creation becomes a conflict while the enclosing transaction rolls back source claims and numbering.

Apply `20261113010000_job_card_create_safety` before deploying the new server/client. Existing job cards retain null request metadata, with a constraint requiring both metadata fields together for new keyed rows. The migration aborts if active historical invoice duplicates exist; it never cancels, deletes or renumbers history automatically. No historical stock or voucher is reposted. Prisma generation alone does not apply this migration. Live PostgreSQL lock-wait/replay, uniqueness, rollback, and migration tests remain part of step 15.

Validation passed: 138 targeted tests across job cards, service bills, vendor payments, and settlement-ledger lines; server/web type checks and lint; validators build, Prisma generation/schema validation, and diff whitespace checks. New unit tests cover UUID validation, canonical exact-value fingerprints, repeated draft/finalise requests, payload/action/actor/branch conflicts, callback failure propagation, normalised invoice lookup, early duplicate rejection, and concurrent uniqueness error handling. They do not substitute for live database race/rollback verification.

### Settlement reversal and wider audit reports - 2026-11-13

Steps eleven and twelve implement job-card settlement reversals, TDS-only settlements, and Finance -> Job Card Finance Audit.

JOBCARD disbursements now allow zero cash when TDS is positive. The resulting voucher debits the provider and credits TDS payable; it contains no zero-valued cash line. Cash plus TDS must be positive and nonnegative individually. Other vendor-payment types still require positive cash and do not accept settlement TDS. A valid funding account/mode remains required as payment metadata even for TDS-only entries, but receives no posting.

Payment-cancel permission authorises a reasoned reversal of an individual JOBCARD disbursement or legacy direct service-bill payment. Original payment records remain, with reversal date, actor snapshot, reason and a unique reversal-voucher reference. A payment can be reversed once; repeated requests return the stored result. Shared reversals take the same slip advisory lock as disbursement/cancellation and conditionally update bill/slip versions and balances in one READ COMMITTED transaction. Cash plus TDS reopens the payable; a fully reversed slip returns to APPROVED, otherwise PARTIALLY_PAID, retaining its original approval. The source reservation stays active until the unpaid slip is cancelled. Legacy reversal requires releasing any active slip first and coordinates through the bill version claim. Bill cancellation ignores fully reversed legacy payments while retaining their history.

Reversal checks include source identity, branch, posted journal state, provider debit, cash-account/funding credit, TDS credit, and balanced voucher amounts. Missing, inconsistent, or externally reversed vouchers require reconciliation instead of a second automated reversal. The existing reverseJournal helper posts the contra on the reversal day and derives its financial year from that date. Period-close enforcement remains unavailable in the shared ledger and must be addressed in rollout policy; this implementation does not invent a closed-period check. All changes roll back if posting or version claims fail. Reversal actions and both voucher references are visible in shared payment history; legacy direct history now has bounded backend pages and debounced reference/account search.

The finance audit report has four views:

- Stock: compares branch stock-ledger quantities to signed movement totals and remaining batch totals; checks job-card issue quantities/values net of undo movements, and removed-part return quantities/values. Repairable/scrap expect no usable-stock movement. Opening balances without movement evidence are flagged for review rather than adjusted automatically.
- Settlements: reconciles bill/slip cumulative settled counters with active cash-plus-TDS payment records; compares provider postings to payment amounts and verifies retained reversal links. Reversed original and contra provider lines must net to zero. It covers legacy and shared JOBCARD payments.
- Posting-period audit: displays job-card/service-bill and known JOBCARD settlement journals, reversal history, unlinked source identities, and unbalanced entries. India date filters select the full posting days. Per the standing rule in reversal-date.ts, expense totals include only POSTED originals with no reversesId, so both halves of reversal pairs are excluded. This is current active expense dated within a period, not reconstruction of balances as they stood at a historical date.
- Tally follow-up: adds stored NOT_SYNCED/FAILED state to the posting audit checks. The screen does not send messages or export to Tally; matching actual Tally imports remains a Finance UAT task. Vendor-payment journals with no discoverable JOBCARD source cannot be classified as job-card payments and require the general ledger orphan review.

Audit page rows and full-filter summaries run inside one repeatable-read transaction with backend pagination and 400 ms debounced search. Source aggregates are grouped before joining counters/stock keys, avoiding per-row scans of materialised movement/payment histories. Quantity and paise differences remain distinct; absolute differences can describe the same underlying fault across multiple checks and are not a single financial adjustment. Access requires job-card view, service-bill view, ledger view and payment view, with branch scope enforced before source aggregation. Reports are read-only. The shared job-card query prefix and reversal invalidation refresh related reports.

Apply `20261113020000_job_card_settlement_reversal` before deployment. It retains historical records, adds reversal references/completeness constraints and a positive cash-plus-TDS constraint, and does not infer reversal metadata from previously inconsistent history. Existing external/manual reversals must be reviewed through reconciliation. No migration has been applied as part of implementation. Live SQL execution, lock-wait/rollback testing, representative query plans and Finance/Tally reconciliation remain in steps 15–16.

Validation passed: 157 targeted tests across job cards, service bills, vendor payments and settlement-ledger lines; server/web type checks and lint; validators build, Prisma generation/schema validation, and diff whitespace checks. New unit tests cover withholding-only balanced entries, zero/negative settlement rejection, reversal replay, source/branch guards, original voucher amount validation, legacy reservation blocking, version conflicts, posting-error propagation, and audit query filters/pagination/aggregation contracts. Query-contract tests use mocked database calls; they do not certify live PostgreSQL SQL execution, transaction rollback, concurrent writers, or Tally imports.

### Removed-part custody and valuation approvals - 2026-11-13

Step thirteen adds a custody lifecycle and approval boundary before recovered parts become usable inventory. New entries require a custody location and provenance/inspection reference. Reusable entries store a proposed recoverable unit value (entered explicitly or proposed from the linked issue) and start PENDING_APPROVAL; repairable/scrap entries start HELD. Logging no longer creates a batch, usable stock, movement, or expense credit. The original removed condition and quantity remain immutable.

The actions are whole-lot transitions: log separate lots when quantities need different treatment. Held repairable parts can be dispatched with a repair reference (IN_REPAIR), then received with receipt evidence and a proposed recoverable value (PENDING_APPROVAL). A received repairable part can be rejected to HELD and resubmitted or dispatched again. Held/in-repair parts can be declared scrap (SCRAP_HELD); scrap in custody can be submitted for disposal (DISPOSAL_PENDING), and a reviewer confirms evidenced physical handover to DISPOSED. Rejected disposal proposals return to SCRAP_HELD. These custody actions do not increase usable inventory or post sale proceeds/repair charges. Those transactions require their normal finance documents; the proposed value is not automatically increased by repair invoices.

Stock and disposal approval/rejection require the new workshop.jobcard.return_approve permission. The approver must differ from both the original recorder and the latest submitter. Stock approval requires an explicitly confirmed positive recoverable unit value, reason, evidence reference, and custody destination; repairable parts also require a recorded repair receipt. The linked replacement issue cost remains only a proposal, not proof of recoverable value. No automatic fair-value formula or upper limit is invented. Finance must validate the valuation evidence/policy in UAT. A stocked lot is terminal in this workflow; subsequent inventory consumption, adjustment, or disposal must use the relevant inventory controls rather than replaying return actions.

Approval atomically claims the parent card and the removed-part version/state, creates one batch and signed return movement, updates branch stock with the existing quantity/cost guard, and posts the existing inventory-debit/repair-expense-credit journal. Repaired parts retain condition REPAIRABLE but become STOCKED, and repair-cost/reconciliation/stock audit queries now use lifecycle status so approved repair receipts are counted and pending proposals are excluded. Historical return values and vouchers are not revalued or reposted.

Every action uses a UUID plus a fingerprint binding action payload, version, record, and actor. Request and record advisory locks, READ COMMITTED reads, version claims, and one encompassing transaction prevent replayed effects and stale transitions. Posting/event failures roll back state and stock together. Append-only lifecycle events retain the original proposal, transitions, evidence, custody destination, approved values, reason, actor, and time. The history endpoint resolves names for the requested page only, applies parent/branch access, and uses database pagination and debounced action/reason search. Actions and history are on each removed-part row in job-card detail; existing removed-part register search/pagination remain server-backed. Stock/ledger/report caches refresh after successful actions.

Apply 20261113030000_removed_part_lifecycle before deploying the new server/client. Existing rows with stock/voucher evidence become STOCKED; unposted reusable rows become PENDING_APPROVAL; other custody records become HELD. A LEGACY_BASELINE event records this migration without fabricating approval/evidence. Historic partial or inconsistent stock/voucher links remain visible for reconciliation. For a legacy pending return, the first real approval can supply the missing provenance reference from the review evidence. Old clients without custody/provenance fields must refresh. Synchronise the permission catalogue through the existing RBAC workflow and grant return_approve to designated independent reviewers; this change does not automatically expand existing users' permissions.

Live PostgreSQL migration, concurrent action/rollback tests, permissions-role UAT, physical custody/receipt checks, and valuation-policy sign-off remain in steps 15–16. Partial-lot lifecycle transitions, automated scrap-sale revenue, repair-cost capitalisation and external attachment storage are outside this custody workflow; evidence references are required and must point to retained business records.

Validation passed: 174 targeted tests across job cards, service bills, vendor payments and settlement-ledger lines; server/web type checks and lint; shared types/validators builds, Prisma generation/schema validation, and diff whitespace checks. New tests verify pending reusable logging has no stock/GL effects, independent reviewers, approval values, action replay/payload conflicts, custody transition rules, repair-receipt gates, stale parent/record claims, duplicate-post guards, and propagation of stock/posting errors. These are mocked service/query tests; live database rollback/concurrency and physical evidence acceptance remain outstanding.

### Repair clearance and database verification - 2026-11-14

Step fourteen adds inspection and replacement intent, explicit repair start, roadworthy clearance, and append-only repair history. Saving a planning draft creates no vehicle hold. Starting repair sets a separate maintenance hold; release or cancellation requires a clearance checklist. Vehicle-row locks coordinate concurrent repairs and dispatch: the hold remains until every active repair is cleared. In-transit repairs preserve the active trip and ON_TRIP status. Dispatch paths reject held vehicles without changing their trip state.

Inspection records brakes, steering, tyres, lights and leaks, with evidence reference and notes for attention items. Release requires passing/not-applicable checks, evidence and roadworthy confirmation. Start requires job-card manage permission; release/cancel requires finalise permission. Branch scope, expected versions and fingerprinted UUID retries apply on the server. Repair history uses bounded backend pages and the shared 400 ms debounce hook; actors are resolved for the requested page only.

New cards require repair clearance before financial finalisation. Create-and-finalise requires completed inspection/clearance snapshots and does not clear another card's hold. Existing cards retain legacy eligibility without invented inspections or holds; review active legacy drafts and explicitly start their real repairs during rollout. After repair starts or is released, vehicle/branch/repair-mode changes are blocked unless that repair control was cancelled. Financial undo does not reopen physical repair; explicitly start again when actual work resumes. Completion checks use minute precision to match the form, and local datetime fields now preserve the browser timezone.

Apply `20261113040000_job_card_repair_controls` with the preceding finance migrations before deploying these changes. Old clients must refresh for the new completion contract. No separate Docker image or service is added; the existing `erp-redis` container was checked with PING/PONG.

Step fifteen executed all nine pending finance migrations against an isolated schema on the existing PostgreSQL 17.6 connection, using cloned schema metadata and synthetic records only. All **20 database checks passed**: backfill/duplicate-history guards, exact discount allocation, create replay, concurrent stock issues and invoice claims, posting rollback, return approval replay, cash/TDS reversals and over-settlement, concurrent repair holds, branch isolation, backend pagination, India end-day cutoffs and every ageing boundary. The generated test schema was removed; application data and deployed migration state were unchanged.

The report queries ran against 10,000 synthetic cards/service lines with EXPLAIN ANALYZE/BUFFERS evidence for repair cost, unbilled services and settlement audit. This establishes a measured synthetic baseline, not production-volume performance certification. The live application still has **nine pending finance migrations**. Production-size tuning, browser/role acceptance, physical custody evidence, actual Tally reconciliation and Finance policy approval remain rollout work. See [verification runbook](qa/JOB_CARD_VERIFICATION.md), [database evidence](qa/job-card-database-verification.json) and [read-only readiness evidence](qa/job-card-db-readiness.json).

Validation: 185 targeted unit tests, server/web type checks and lint, and Prisma schema validation. Earlier progress sections retain the limitations recorded when those slices were implemented; this section records the subsequent live PostgreSQL verification.

### Remaining work packages after step fifteen

Authorised development cutover - 2026-11-14: the user selected the configured Supabase development database. After a public-schema/data backup, Prisma applied all nine finance migrations. Read-only postchecks preserved 14 job cards, 7 bills, 299 journals and 63 stock movements; checked allocations, snapshots, legacy return baselines and repair defaults passed. No pending local migrations, checksum mismatches or unfinished records remain. The unrelated missing receivables migration source is preserved and still flagged for review. See [cutover evidence](qa/job-card-development-cutover.json). This supersedes earlier pending-development-migration notes; production release and Finance acceptance remain pending.

Technical cutover follow-up - 2026-11-14: the configured development database is hosted Supabase, not localhost. Full migration-history inspection found applied `20261113000000_receivable_integrity_phase1` absent from this checkout/local Git history. The readiness command now checks all local/applied migrations, checksums and unfinished records and returns `MIGRATION_HISTORY_REVIEW_REQUIRED` for this mismatch. No history was rewritten and no migrations were applied. Reconcile the original migration and confirm the intended environment before cutover; see the [acceptance pack](qa/JOB_CARD_ROLLOUT_ACCEPTANCE.md).

Step sixteen preparation - 2026-11-14: added the [operating guide](JOB_CARD_OPERATING_GUIDE.md) and [rollout/acceptance pack](qa/JOB_CARD_ROLLOUT_ACCEPTANCE.md), covering policy owners, 16 role-based UAT scenarios, migration/backup/recovery sequence and explicit sign-off records. Read-only live preflight found zero active duplicate invoice groups and zero inconsistent bill-total groups, two draft cards requiring operational review, and one cancelled bill without retained lines requiring historical reconciliation. No application data, permissions or migration state changed. Business UAT, policy decisions and deployment remain pending; preparation is not Finance acceptance.

There is **one grouped step remaining** for the currently planned module scope. Unresolved policy decisions in section 8 can change scope.

| Step | Remaining package | Completion condition |
|---|---|---|
| 16 | Finance UAT, policy sign-off and rollout | Remaining tax/internal-labour/valuation/period decisions are signed off, end-to-end scenarios reconcile, user guidance is updated, and deployment/migration checks are completed. |

## 1. Purpose and scope

### Removed-part safety implementation - 2026-11-12

The fifth slice extracts removed-part writes into `job-card-removed-part.service.ts`. New entries require a FINALISED card, a spare-part item, and a UUID request identity. A stored payload fingerprint binds retries to the original card, part, quantity, condition, issue link, entered cost, and remarks. Matching retries return the original entry; reusing a key for another payload is rejected. A conditional parent version/status claim coordinates return creation with undo-finalise, billing, and other return writes.

Where an issue line is linked, the service validates its job/part and caps cumulative removed quantities across all conditions at that line's issued quantity. The optional issue link remains optional: manually valued unlinked old parts still follow the existing policy and do not acquire an invented issue-quantity limit. Finance must still define recoverable valuation/approval and provenance rules for those entries. Reusable valuation remains explicit entered positive cost, otherwise the linked issue cost; this slice does not establish that replacement-part cost equals the recoverable value of an old part.

Reusable entries create a new batch, a stock return movement, and an inventory-debit/repair-expense-credit voucher in one transaction. Branch stock updates compare the read quantity and average cost before incrementing quantity and updating the average, so a changed balance causes rollback instead of an overwrite. Repairable/scrap entries remain custody records only: they do not increase usable stock or post an expense credit. Negative branch stock blocks reusable posting pending reconciliation. Cross-module stock concurrency still needs live database verification.

The history endpoint now returns bounded backend pages with database search, condition filtering support, deterministic ordering, and total counts. The UI uses a 400 ms debounced history search, requests the next page only on navigation, and exposes return vouchers even on a card without an original parts voucher. The reusable cost input and optional issue-line selector now match backend validation. Request identities are retained for retry within the same submission and reset for a new dialog entry.

Apply `20261112030000_job_card_return_safety` before deploying this slice. Existing rows retain null request identities and are not revalued or reposted. New clients must send `clientRequestId`; stale clients without it are rejected rather than creating non-idempotent returns. Unit tests cover guards, quantity/provenance checks, retry replay, return costs, stock conflicts, and record-only conditions. PostgreSQL race/rollback tests, return valuation approval policy, repair receipts, scrap disposal, checklists, and vehicle-status automation remain outstanding.

### Payment workflow implementation - 2026-11-12

The fourth slice connects posted service bills to the common vendor-payment engine. `POST /service-bill/:id/payment-slip` prepares or opens the bill's active JOBCARD slip. This first integration uses one service bill per slip; its amount is the server-calculated remaining liability, including any historical direct settlements. The bill register remains the paginated/searchable entry point. Source reservations prevent a second active slip and block cancellation of a reserved bill. JOBCARD drafts use the bill's frozen balance; changing the request requires cancelling the unpaid slip and preparing a replacement.

Submit, configured threshold/approval decisions, reject-to-draft, cancellation, approval queues, branch access, and disbursement permissions reuse the shared engine. Makers need `accounts.payment.create`; viewing/approval/disbursement use the existing corresponding shared permissions. Roles are not changed automatically. Generic slip creation does not accept JOBCARD; the service-bill entry point establishes its bill/payee/branch references.

JOBCARD approval posts no accrual because service-bill posting already recognised expense and provider payable. Disbursement debits that provider payable, credits cash/bank and (when entered) TDS payable, and atomically increments the bill's settled amount. A slip's `paidPaise` represents cash plus TDS settled; each disbursement's `paidPaise` records cash and its new `tdsPaise` field records withholding separately. The approved amount is total liability settlement; the cashier records the cash/TDS split at disbursement. Partial payments retain the active reservation. Cancelled unpaid slips release it without reversing the original bill journal; partially/fully paid slips remain non-cancellable under the existing shared workflow.

The direct `/service-bill/:id/pay` endpoint rejects new payments, including requests from stale clients. Historical `ServiceBillPayment` records and their legacy history endpoint remain readable; new payment history/vouchers are on the linked vendor payment slip. Idempotent disbursement uses the shared client request ID, rechecked under request/slip locks before status and amount validation, including retries of a final payment. The frontend refreshes balances and creates a new attempt ID only after success.

Apply `20261112020000_job_card_payment_approval` before deploying this slice; it adds the service-bill source, slip bill FK/payee constraint, and disbursement TDS column. Prisma generation does not apply the migration. Unit coverage includes authoritative outstanding amounts, source reuse, conflicting/cancelled bills, partial cash/TDS settlement, and balanced provider/funding/TDS entries. Live PostgreSQL race/rollback/migration tests and full Finance UAT remain outstanding. Multi-bill slips, payment reversals, TDS-only disbursements, and approval policy changes beyond the existing shared configuration are outside this slice.

Provide one traceable flow from a vehicle repair to spare consumption, outside service liability, payment, accounting, and vehicle repair cost reporting. Finance must be able to trace every amount back to a job card, vehicle, provider, stock movement, and voucher.

Job cards already exist under Workshop. The proposed Finance entry point should reuse those records and services. A second job card model or independent stock/payment implementation would create reconciliation problems.

Scope includes parts-only, services-only, and mixed jobs; HO repairs and in-transit repairs; reusable/repairable/scrap removed parts; provider billing across job cards; partial settlement; cancellation and correction; ledger and Tally handoff. Purchasing remains a supporting inventory flow, not a mandatory one-to-one purchase order for each job card.

## 2. Source references and diagram interpretation

The requested diagram folder is [`docs/diagrams`](diagrams/README.md).

| Source | Flow or requirement used |
|---|---|
| [Operational data flow](diagrams/erp-data-flow.drawio) | `w1` to `w6`: Purchase Order -> Inward Stock -> Inventory -> Job Card -> Service Bill -> Service Payment -> Ledger. Inventory-to-job-card arrow is explicitly labelled parts consumed. Workshop owns repair activity; Accounts owns financial settlement. |
| [Business flow A3](diagrams/erp-business-flow-a3.drawio) | Maintenance and inventory support the main transport business; maintenance feeds Accounts. |
| [Detailed module flow](diagrams/erp-flow-v2.drawio) | Vehicle status -> Job Card; inventory consumption; service bill/payment; shared payment workflow labelled Slip -> Entry -> Approval -> Disbursed; moving-average inventory intent. |
| [Module plan, sections 5.3 and 6](ERP_MODULE_PLAN_V2.md) | Shared vendor payment workflow, maintenance/checklist/replacement intent, HO stock with branch-ready schema, vehicle costs, and Tally bridge/fallback. |
| [Accounts module map, section 4.4](ACCOUNTS_MODULE_MAP.md) | Shared payment primitive with `JOBCARD` discriminator and permission-based approval. |
| [Workshop user guide](easy-guide/19-workshop.md) | Operator-facing repair, stock, service billing, and removed-parts context. Some status descriptions differ from current routes; use the implementation baseline below for current behaviour. |

The diagrams describe business intent. They do not establish that every approval, report, or vehicle-status integration is implemented.

## 3. Current implementation baseline

Inspected source:

- [Job card routes](../apps/server/src/modules/job-card/job-card.route.ts), [validation](../packages/validators/src/workshop/job-card.schema.ts), and [web screens](../apps/web/features/job-card).
- [Service bill routes](../apps/server/src/modules/service-bill/service-bill.route.ts) and [web screens](../apps/web/features/service-bill).
- [Prisma models](../apps/server/prisma/schema.prisma), [posting helpers](../apps/server/src/modules/ledger/posting.service.ts), and [navigation](../apps/web/config/navigation.ts).

| Area | Present in inspected code | Remaining work or difference |
|---|---|---|
| Job card | Create/edit draft, finalise, atomic create-and-finalise, undo finalise, cancel draft | Reuse and strengthen for Finance; do not rebuild CRUD. |
| Fields | Branch, vehicle, driver, HO/in-transit status, in/out times, opening/closing KM, remarks, part/service lines, optional mechanics | Checklist, maintenance reason, and operational vehicle-status coordination need a defined scope. |
| Part issue | Draft has no issue; finalise snapshots selected batch cost, decreases stock, records movements, posts parts voucher | Older plan says moving average. Agree valuation before changing postings or historical reports. |
| Service lines | Provider, spare part, quantity, rate, amount; included in job total | Current input requires provider and spare part; free-form labour and internal labour need explicit modelling. |
| Service billing | Select unbilled finalised lines for a provider; submit creates a POSTED bill, net of discount | Current route does not use a separate draft/post interaction. |
| Settlement | Direct payment, partial payments, cash/bank account, reference and TDS; payment voucher | Shared Slip -> Entry -> Approval -> Disbursed flow is a planned integration, not current service-bill behaviour. |
| Removed parts | Reusable creates stock batch, movement, and return voucher; repairable/scrap are record-only | Separate repair, disposal, and valuation controls remain to be designed. |
| Corrections | Undo restores issued quantities and reverses journal; blocked after billing or any removed-parts activity | Add complete settlement-aware reversal and immutable audit evidence. |
| Access | Workshop permission constants and branch helpers exist | Review every detail, lookup, filter override, and mutation for consistent branch enforcement. |

This is a source inspection baseline, not a runtime certification or full security audit.

## 4. End-to-end business flow

```text
Spare supplier -> Purchase Order -> Inward posting -> Available stock/batches
                                                         |
Vehicle repair need -> Draft Job Card -> Parts + Services |
                              |              |           |
                              +---- Finalise +-----------+ (issue parts)
                                      |
                        +-------------+-------------------+
                        |                                 |
                Parts expense voucher          Unbilled provider services
                        |                                 |
                        |                       Provider Service Bill
                        |                       Expense + payable voucher
                        |                                 |
                        |                      Payment slip / entry [planned]
                        |                      Approval [planned]
                        |                      Disbursement / settlement
                        |                                 |
                        +---------- Ledger + audit -------+
                                      |
                           Tally handoff + reconciliation
                           Vehicle repair cost reports

Removed parts -> Reusable: stock return + expense credit
              -> Repairable: repair tracking [record-only currently]
              -> Scrap: disposal tracking [record-only currently]
```

### 4.1 Prerequisites and responsibility

| Owner | Responsibility |
|---|---|
| Workshop | Identify vehicle/driver, record complaint and work, select parts/mechanic/provider, complete repair, capture removed parts. |
| Stores | Receive stock, verify batch availability and physical issues/returns, reconcile movements. |
| Finance entry user | Verify provider invoice and eligible service lines; prepare bill and payment request. |
| Approver | Review payment according to configured permission and threshold policy. |
| Cashier/accounts | Disburse approved amounts, record account/reference/TDS, reconcile ledger and Tally. |

Required masters are branch, vehicle, driver, spare part, supplier/service provider, optional mechanic, cash/bank accounts, and configured GL mappings. Stock must be received before a stock part can be issued. One HO workshop is the current business scope; all access and stock keys remain branch-aware.

### 4.2 Create and maintain the job card

1. Choose branch, vehicle, driver, and truck location (`AT_HO` or `IN_TRANSIT`). Record in date/time, opening KM, and repair remarks.
2. Add parts by spare part, branch batch, positive quantity, optional mechanic, and description. Show remaining batch stock and source inward/returned-stock origin.
3. Add services by provider, part/work reference, quantity, rate, optional mechanic, and description. Group by provider for later billing.
4. Save as DRAFT. No inventory movement or finance voucher occurs. Available stock displayed on a draft is not a reservation.
5. Permit edits only while DRAFT. Preserve document identity and audit changes; define whether branch/date changes affecting numbering should be prohibited after numbering.

### 4.3 Complete and finalise

1. Enter out date/time and closing KM. Require at least one part or service line, closing KM >= opening KM, and out time >= in time.
2. Revalidate all references, branch ownership, quantities, availability, and document version inside the transaction.
3. Aggregate demand per batch, including repeated lines. Atomically claim quantities so simultaneous finalisations cannot overdraw stock.
4. Snapshot issue costs; update batch and branch balances; append issue movements; post the parts voucher; store totals and finalisation actor/time.
5. Commit all effects together and mark FINALISED. A failure must leave no partial issue or voucher. Services-only jobs create no parts voucher.
6. Support the existing create-and-finalise convenience operation with the same business rules and one transaction.

Service amounts are recorded on the job card but do not create a provider payable until service billing. Completing repair and paying the provider are separate events.

### 4.4 Removed parts and stock return

- Record spare part, quantity, condition, optional related issue line, remarks, actor, and date.
- REUSABLE: verify return quantity and provenance, approve its recoverable cost, create a distinct return batch, append a RETURN movement, and post inventory debit/repair expense credit atomically.
- Current reusable valuation accepts an entered cost or related finalised issue cost. The replacement part's issue price is not automatically evidence of the old part's recoverable value; define the valuation policy before expanding this path.
- REPAIRABLE: retain the record and planned repair/provider reference. Do not increase usable stock until a defined repair receipt is posted.
- SCRAP: retain condition and custody; disposal proceeds/write-offs require a separate approved accounting flow. Current logging alone does not post stock or GL effects.
- Current route allows removed-part entry on non-cancelled cards. Proposed rule: post inventory-affecting returns only against FINALISED cards, with duplicate and cumulative quantity controls.

### 4.5 Provider service bill

1. Select branch, provider, and completion cutoff; fetch finalised, unbilled service lines.
2. Select eligible lines from one or several job cards for that provider and branch. Show job card/vehicle against every line.
3. Enter bill date, provider invoice number/date, discount, and remarks. Validate unique selected lines and duplicate invoice policy.
4. Calculate gross = sum of selected service amounts; net = gross - discount. Discount cannot exceed gross.
5. Atomically claim still-unbilled lines, create bill and line snapshots, link each source service line, and post provider payable. Current submit produces POSTED directly.
6. Maintain traceability when one bill covers multiple vehicles; allocate bill-level discount deterministically to source lines for vehicle reporting.

### 4.6 Finance payment and settlement

Current path: POSTED service bill -> direct Pay -> settlement voucher. Proposed target from the detailed diagram:

```text
Posted bill -> Payment slip -> Payment entry -> Approval -> Disbursement
                                      ^          |
                                      +-- return/reject with reason
```

Reuse the shared vendor payment primitive with `type = JOBCARD` once its actual implementation and integration contract are verified. Suggested payment states are DRAFT, SUBMITTED, APPROVED, REJECTED, PARTIALLY_DISBURSED, DISBURSED, and CANCELLED; map these to the shared engine rather than introducing competing enums.

- Resolve payee and outstanding bill allocations from posted provider bills. Define one-bill versus multi-bill allocation support in that engine.
- Show gross/net bill amount, prior cash paid, prior TDS, pending amount, requested settlement, cash component, TDS component, payment mode/account/date/reference, and supporting invoice.
- Enforce approval permission and thresholds, record approver/time, and invalidate approval when material payment details change.
- Reserve approved allocations or lock balances so multiple active requests cannot collectively exceed the liability.
- At disbursement, recheck approval, bill status, available balance, account access, and idempotency; create settlement and voucher atomically.
- Cash paid + TDS withheld = liability settled. Sum of settlements must not exceed net payable. Keep TDS values explicit; this document defines system flow, not statutory rates or applicability.
- Display UNPAID / PARTIALLY_PAID / PAID as derived settlement indicators. They are separate from repair and bill status.
- During migration, each bill must have one active payment path. Do not leave direct Pay available as an approval bypass.

## 5. Statuses, cancellation, and correction

| Record/action | Current rule | Target control |
|---|---|---|
| Job card DRAFT -> FINALISED | Issue stock and post parts expense | Version check, stock concurrency protection, idempotent posting. |
| Job card DRAFT -> CANCELLED | Reason required; no issue to reverse | Preserve all audit evidence; block if any inventory-affecting dependent activity exists. |
| Job card FINALISED -> DRAFT | Undo with reason; blocked by billed service lines or any removed-part record | Recheck dependencies under lock; restore original batches and costs through compensating movements and journal reversal. |
| Finalised job correction after billing | Undo blocked | Reverse dependent settlement/billing through permitted workflows first, or use an explicit adjustment document. |
| Service bill POSTED -> CANCELLED | Releases service lines, deletes bill-line rows, reverses bill journal | Block while active payments/approved allocations exist; retain historical line snapshots instead of losing billing evidence. |
| Payment cancellation/reversal | Dedicated reversal flow is not established by inspected routes | Reverse settlement voucher and allocation with reason/permission; never silently delete a payment. |

Cancelled records are terminal. Reversals must respect accounting period locks and the existing Tally correction/export policy. Rebilling released service lines must retain links to prior cancelled documents for audit.

## 6. Accounting and reconciliation

The following matches the inspected posting helpers; proposed changes must preserve balanced vouchers and source links.

| Event | Debit | Credit | Amount |
|---|---|---|---|
| Job card parts finalise | Repair & Maintenance Expense | Spare Parts Inventory | Issued quantity x snapshotted cost |
| Reusable removed-part return | Spare Parts Inventory | Repair & Maintenance Expense | Returned quantity x accepted return cost |
| Service bill posting | Repair & Maintenance Expense | Provider payable ledger | Net bill after discount |
| Service settlement | Provider payable ledger | Cash/Bank and TDS Payable | Liability reduction = cash + TDS |
| Permitted reversal | Mirror original journal | Mirror original journal | Original posted amounts |

Example: parts cost INR 2,000; services gross INR 1,000; bill discount INR 100. Parts finalise posts INR 2,000 expense; service bill posts INR 900 expense/payable. Cash INR 800 plus TDS INR 100 settles the INR 900 liability. Total recognised repair expense is INR 2,900 before any reusable return. Job card operational total before bill discount is INR 3,000; reports must explain that difference.

Store money as integer paise and use deterministic allocation/rounding. Do not expense the complete job total again when creating a service bill or payment.

Reconciliation requirements:

- Stock balance equals opening balance plus signed movements; each job issue/return links to source and valuation.
- Provider outstanding equals posted net bills minus valid cash/TDS settlements and adjustments.
- Recognised vehicle repair cost equals parts expense minus reusable return credits plus allocated net posted services, adjusted for reversals.
- Operational service totals, unbilled services, billed expense, and cash paid remain distinct measures. Identify unbilled completed services at period end for Finance review.
- Maintain vehicle/source-line attribution for multi-vehicle service bills. Current posting helper arguments do not establish vehicle tags on these journal lines; verify reporting joins or add durable allocation dimensions.
- Use the existing ledger-to-Tally mechanism. Track pending/synced/rejected vouchers, retries, source identity, and reversal links; a retry must not duplicate a voucher.

## 7. Finance screens and data/API plan

Proposed navigation: Finance -> Job Cards, with linked Service Bills, Payments, and Repair Cost reports. Keep shared Workshop access to the same records; exact menu placement can follow the existing finance navigation conventions.

| Screen | Required information/actions |
|---|---|
| Job card register | Number, date, branch, vehicle, driver, repair status, parts/services totals, billed/unbilled services, settlement summary; branch/date/vehicle/status/provider filters. |
| Job card detail | Header, parts/batches, services grouped by provider, removed parts, timeline, movements, bill allocations, payments, voucher/Tally links; permitted finalise/undo/cancel actions. |
| Provider billing | Eligible unbilled lines with vehicle/card references, invoice details, discount allocation, totals and posting confirmation. |
| Payment workbench | Outstanding bills, slip/entry, approval queue, rejection reason, disbursement, partial settlement history and reversal links. |
| Reports | Vehicle/date/branch repair costs; provider outstanding/ageing; unbilled services; stock issues/returns; workshop downtime when operational timestamps/status are reliable. |

Reuse `JobCard`, `JobCardPartLine`, `JobCardServiceLine`, `JobCardRemovedPart`, `ServiceBill`, `ServiceBillLine`, `ServiceBillPayment`, stock models, and journal models. Add shared payment links, immutable bill/allocation snapshots, audit events, and vehicle cost dimensions only where the verified models need them.

Existing job-card route operations include list/detail, batch lookup, create/update, create-and-finalise, finalise, undo-finalise, cancel, and removed-parts list/create. Existing service-bill operations include eligible unbilled lines, list/detail, create, cancel, payment history, and direct pay. Reuse these contracts behind shared services; add approval/disbursement APIs through the common payment engine.

Every list, lookup, detail, export, and mutation must enforce branch access on both parent and referenced records. Separate view/manage/finalise/bill/approve/disburse/reverse permissions. Use row locking or conditional updates, database uniqueness, expected versions, and idempotency keys where required; a transaction plus a read alone does not prevent every race.

## 8. Decisions to resolve before financial behaviour changes

| Decision | Recommended starting point |
|---|---|
| Batch versus moving-average issue valuation | Preserve current batch snapshots until Finance agrees a policy and migration. Reconcile inventory GL against that policy; do not silently revalue history. |
| Internal labour | Define whether it is informational, allocated payroll cost, or a separately posted cost. Avoid creating a fictitious external payable or counting payroll twice. |
| Service description | Decide whether non-part labour needs its own service master or nullable spare-part link. |
| Vehicle availability | Define repair start/end events and concurrent-job rules before automating InMaintenance/Available transitions; in-transit repair must not accidentally close a trip. |
| Pre-job checklist/replacement intent | Decide minimum required checklist and replacement records; they are in the module plan but not established by the inspected job-card inputs. |
| Payment workflow | Verify common engine readiness, approval thresholds, maker/approver separation, and direct-pay retirement strategy. |
| Tax/discount adjustments | Confirm invoice/tax fields and accounting policy with Finance. Current service-bill posting uses net amount without a GST split. |
| Dates and periods | Define business-date cutoff, fiscal-year numbering across repair start/end, backdating, and locked-period rules. |
| Removed-part lifecycle | Confirm recoverable valuation, return quantity provenance, repair receipts, scrap custody and disposal. |

## 9. Implementation phases

| Phase | Work | Exit criteria |
|---|---|---|
| J0 - Baseline and decisions | Review existing models/routes, Finance menus and shared payment engine; resolve valuation, internal labour, permissions and period policy | Agreed transition/accounting matrix and migration scope; existing records sampled and reconciled. |
| J1 - Reliable shared job card | Extract shared transaction services; harden branch/reference/date checks, aggregated batch demand, concurrency, versioning, idempotency and audit | Parts-only/services-only/mixed jobs work; failed or repeated requests cannot duplicate stock or journals. |
| J2 - Finance access and billing | Add Finance entry points to shared screens; provider bill eligibility, cross-branch rejection, unique claims, discount/vehicle allocation, immutable cancellation evidence | Each billed service is traceable once; bill cancellation and rebilling preserve history. |
| J3 - Controlled settlement | Connect JOBCARD to shared slip/entry/approval/disbursement; partial cash/TDS allocation; reversal; retire bypass for migrated bills | Only approved eligible amounts disburse; outstanding reconciles under retries and concurrent requests. |
| J4 - Returns and operations | Enforce removed-part lifecycle, valuation/custody controls; add agreed checklist and vehicle-status integration | Returns reconcile; repairable/scrap do not inflate usable stock; repair completion does not disrupt active trips. |
| J5 - Reporting and rollout | Vehicle/provider/unbilled reports, stock/GL/Tally reconciliation, migration, Finance UAT and user documentation | Historical and new records reconcile; approved scenarios pass; users can trace card -> bill -> settlement -> voucher. |

Migration should first inventory existing drafts, finalised cards, unbilled lines, posted/cancelled bills, settlements, returns, and voucher links. Backfill references/allocations from existing evidence without reposting historical expense or settlement. Preserve existing document numbers and actor history. Flag ambiguous or missing data for reconciliation rather than manufacturing stock movements or payments.

## 10. Acceptance and verification scenarios

1. Saving/editing/cancelling a draft produces no stock issue or expense; unavailable and cross-branch references are rejected.
2. Parts-only finalise issues correct batches and one balanced voucher; service-only finalise creates no parts voucher; mixed finalise does not post service expense twice.
3. Duplicate lines drawing from one batch use aggregate demand; concurrent finalisations cannot make batch or branch stock negative.
4. Invalid date/KM, missing mapping, insufficient stock, or posting failure rolls the whole operation back. Retried create/finalise requests do not duplicate effects.
5. Provider billing excludes draft/cancelled/already-billed lines; enforces provider/branch consistency; concurrent billing claims each service line once.
6. A multi-card/multi-vehicle bill allocates discount exactly, including rounding; vehicle totals reconcile to net bill expense.
7. Partial cash/TDS payments reduce pending by their combined settlement amount; repeated/concurrent disbursements cannot overpay; rejected or unapproved requests cannot disburse.
8. Undo before dependent activity restores original batches and reverses the original expense; billed/returned cards block undo. Correction/re-finalisation keeps the voucher chain and avoids source-number collisions.
9. Paid bills cannot be cancelled until settlements are validly reversed; permitted bill cancellation releases lines for rebilling while retaining historical evidence.
10. Reusable returns post only approved recoverable value and quantity once; repairable/scrap logging does not increase usable stock or create an unsupported expense credit.
11. Branch-restricted users cannot access another branch through direct IDs, filters, batch lookups, provider selections, exports, or payment accounts. Permission boundaries apply at the server.
12. Existing cards/bills/payments remain usable after migration; no historical voucher is reposted. Stock, provider balance, vehicle cost, and Tally status reconcile across reversals and retries.

Use targeted validator/service tests for these business rules, database integration tests for atomicity/concurrency, and Finance UAT for the complete repair-to-settlement journey. The progress sections record completed automated checks; they do not certify live database behaviour or Finance acceptance.
