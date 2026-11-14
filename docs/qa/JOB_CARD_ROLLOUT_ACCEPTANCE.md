# Job card release acceptance and rollout

Prepared: 2026-11-14. **Release status: NOT APPROVED.** Step 16 preparation is complete; business acceptance and deployment are pending. This document records no implicit approvals.

References: [flow/implementation plan](../JOB_CARD_FINANCE_FLOW_PLAN.md), [operating guide](../JOB_CARD_OPERATING_GUIDE.md), [automated verification](JOB_CARD_VERIFICATION.md), [read-only preflight](job-card-db-readiness.json).

## Policy decision register

| Decision | Current implementation / decision needed | Owner | Status |
|---|---|---|---|
| Issue valuation | Existing batch cost snapshots; confirm inventory/GL valuation policy and opening reconciliation | Finance + Inventory | Pending |
| Internal labour | No new payroll allocation or fictitious external payable; approve informational versus allocated cost policy | Finance | Pending |
| Tax and discount | Net service expense, exact paise discount allocation, cash/TDS settlement; no new GST split. Confirm supported invoice/tax scope | Finance | Pending |
| Periods/backdating | Shared ledger has no closed-period enforcement for this workflow. Approve operational controls or require period-lock implementation before release | Finance + Engineering | Pending |
| Repair release | Approve five inspection checks, evidence retention and roadworthy sign-off; manage starts, finalise permission clears | Operations | Pending |
| Removed-part custody | Approve recoverable values, independent approvers, receipt and scrap/disposal evidence | Inventory + Finance | Pending |
| Approval limits | Confirm shared payment thresholds, role grants, maker/approver separation and funding accounts | Finance + Admin | Pending |
| Legacy history | Review active draft repairs, missing old cancelled-bill lines, ambiguous returns and migration exceptions; no fabricated evidence | Operations + Finance | Pending |
| Tally | Confirm actual import/export path, reversal policy and voucher matching. Stored sync state alone is insufficient | Finance | Pending |

## Execute UAT on staging

Use separate named accounts for workshop maker, return reviewer, bill maker, payment approver, cashier, read-only Finance user and a user limited to another branch. Grant only required permissions through the existing RBAC screens; do not use an all-permission admin as proof of role enforcement. Record actor, branch, document/voucher IDs, expected/actual amounts, evidence link, date and reviewer for each row. All rows below are **Not run by business users**.

| ID | Scenario and expected result | Owner |
|---|---|---|
| U01 | Save/edit planning draft: no stock/GL/hold; invalid dates/KM and cross-branch references rejected | Operations |
| U02 | Start HO repair: inspection/evidence required, dispatch blocked. Two cards: clearing one retains hold, clearing both permits dispatch | Operations |
| U03 | Start in-transit repair: trip remains active; checklist/release history identifies actor. Cancel repair only after roadworthy clearance | Operations |
| U04 | Parts-only, services-only and mixed completion: correct stock batch costs, one parts voucher, no duplicated service expense | Inventory + Finance |
| U05 | Concurrent finalisations with scarce stock and timeout retry: one permitted issue, no negative quantities or duplicate card/voucher | Engineering + Inventory |
| U06 | Multi-card discounted bill: line net amounts sum exactly to bill; duplicate invoice across branches rejected; cancellation/rebill retains snapshots | Finance |
| U07 | Submit/approve/disburse partial cash+TDS and TDS-only: permissions/thresholds enforced, pending reduced exactly, no zero cash GL line | Finance |
| U08 | Concurrent oversettlement rejected; reversal retried once, retained contra balances provider/cash/TDS and reopens correct pending amount | Finance |
| U09 | Reusable return: maker cannot approve own valuation; approval creates stock/credit once. Repairable/scrap never inflate usable stock; verify physical custody/receipt | Inventory |
| U10 | Undo/cancel dependency guards and posting failure: no partial stock, status, payment or journal changes; retained correction chain | Finance + Engineering |
| U11 | All registers/history: debounce, page reset, loading/error/retry/empty states; browser Network shows bounded backend pages on Next | Engineering + Users |
| U12 | Direct-ID/API access, all reports and actions reject another branch/insufficient role; hidden buttons alone are not sufficient | Admin + Engineering |
| U13 | Repair cost, outstanding, unbilled and audit views reconcile to sampled stock, bills, payments, original/reversal journals; check India date boundaries | Finance |
| U14 | Actual Tally import/export and reversal reconcile by voucher/source and exact amounts; retain accepted/rejected evidence | Finance |
| U15 | Production-sized staging dataset: measure search/page/report latency and query plans at agreed concurrency; record p50/p95, DB load and agreed limits | Engineering |
| U16 | Legacy drafts/returns/bills reviewed; new and historical flows reconcile after upgrade without reposting historical vouchers | Operations + Finance |

The 185 unit tests and 20 isolated PostgreSQL checks are supporting evidence, not completed business UAT. Synthetic 10,000-card query plans do not establish production latency targets. Record targets and measurements before signing U15.

## Deployment sequence

1. Record release revision, environment, owners, maintenance window and signed decisions/UAT evidence. Resolve all failed/pending release gates. Confirm no unrelated pending migration will be applied unexpectedly.
2. Run `pnpm --filter @skerp/server verify:job-card:readiness` with the intended database configuration. It uses a read-only transaction and reports aggregate counts only. Exit 2 means schema migrations pending, exit 1 means the check failed, and exit 0 means schema ready; none grants release approval. Review duplicate invoice groups and inconsistent bill totals as known migration blockers. Draft count requires operational review; missing cancelled-bill lines require historical reconciliation. These are selected checks, not a complete data audit.
3. Rehearse against a recent staging restore, retain before/after control totals, and test backup restoration. Capture stock quantities/values, source/voucher links, provider payable, pending cash/TDS and retained bill lines. Keep backups under existing retention/access policy.
4. Pause affected writes/dispatch during the migration cutover. Use the repository's existing deployment process and shared services; **do not add a job-card image or Redis instance**. Preserve existing `erp-redis` configuration and data.
5. Apply the reviewed pending migrations using the existing migration deployment job (`pnpm --filter @skerp/server db:deploy` for an approved direct deployment). This applies all pending repository migrations, not only job-card migrations. Do not use `migrate dev`, reset, or automatic resolve to bypass failures. Refresh Prisma/server/web from the same revision, and force old browser clients to refresh.
6. Use the existing `seed-admin` permission/ledger synchronisation procedure described in [deployment guidance](../developer-guide/deployment.md); review its scope before execution. Grant job-card view/manage/finalise, independent `workshop.jobcard.return_approve`, service-bill and shared payment permissions to approved roles. No role is expanded by this runbook.
7. Rerun readiness: require SCHEMA_READY, no known blockers, and no unresolved Prisma migration failure. Complete branch/role smoke checks, held-vehicle dispatch, one approved end-to-end staging/pilot sample and stock/provider/GL control totals. Record actual results.
8. Reopen writes only after operational and Finance approval. Monitor API errors, lock waits, query latency, negative stock exceptions, failed postings and reconciliation/Tally queues against agreed targets. Assign an owner and rollback decision time for the pilot.

## Failure and recovery

On migration failure, keep affected writes paused, retain the error and inspect Prisma migration state. Some earlier migrations are not wrapped as one transaction: do not assume every DDL change rolled back. Restore the rehearsed backup or prepare a reviewed forward repair. Do not mark a migration applied merely to unblock deployment.

An application image rollback does not reverse schema or data changes. After financial writes, account for every new stock movement, bill/payment and voucher before any restore; retain/export evidence under the recovery plan. Prefer reviewed forward corrections when a database restore would discard accepted business transactions. Never delete journals or manually zero counters as recovery.

## Sign-off record

| Gate | Required evidence | Result / signer / date |
|---|---|---|
| Policy | All decisions approved or explicitly scoped out | Pending |
| User acceptance | U01-U16 evidence and defects resolved | Pending |
| Reconciliation | Stock/provider/expense/Tally control totals approved | Pending |
| Recovery | Recent backup and successful restore rehearsal | Pending |
| Release | Revision, migration status, role grants, pilot and monitoring owners | Pending |

Step 16 is complete only when these records are signed and deployment checks have passed. This preparation does not apply migrations, change grants, send messages, or approve financial policy.
