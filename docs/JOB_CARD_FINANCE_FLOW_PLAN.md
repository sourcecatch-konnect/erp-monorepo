# Job Card - Finance Flow and Implementation Plan

Date: 2026-11-12  
Status: Planning document; existing behaviour and proposed changes are distinguished below.

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

Use targeted validator/service tests for these business rules, database integration tests for atomicity/concurrency, and Finance UAT for the complete repair-to-settlement journey. This planning change does not implement or execute those checks.
