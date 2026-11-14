# Job-card verification

Verified on 2026-11-14. Automated evidence supports steps 14–15; Finance acceptance and deployment remain step 16.

- 185 targeted unit tests passed across job cards, service bills, vendor payments and settlement ledger lines.
- Server/web type checks and lint, and Prisma schema validation passed.
- [PostgreSQL evidence](job-card-database-verification.json): 20 checks passed, nine finance migrations exercised, generated schema removed, application data unchanged.
- [Readiness evidence](job-card-db-readiness.json): PostgreSQL 17.6; nine finance migrations still pending in the application schema. A successful isolated test does not apply them.

The database verifier clones existing pre-finance-upgrade schema metadata and custom CHECK definitions into a uniquely named schema, then inserts synthetic fixtures. It does not copy business rows. Tests execute real transaction services, concurrent requests, rollback/retry cases and raw report SQL. The reporting fixture includes 10,000 cards/service lines. Three EXPLAIN ANALYZE/BUFFERS plans are retained in the JSON. Smaller payment/inventory fixtures are correctness checks, not production-load benchmarks.

No Docker image is built or pulled and no additional service is required. Existing `erp-redis` answered PONG. PostgreSQL verification uses the already configured connection; Redis cannot execute SQL migrations.

## Reproduce on a compatible pre-upgrade database

Run from the repository root in PowerShell. The readiness command is read-only and intentionally exits 2 while migrations are pending. Credentials are read from server configuration and omitted from evidence.

```powershell
pnpm --filter @skerp/server verify:job-card:readiness
pnpm --filter @skerp/server exec prisma migrate diff --from-empty --to-config-datasource --script --output prisma/job-card-verification-baseline.tmp.sql
$env:JOBCARD_ALLOW_ISOLATED_SCHEMA_TEST='1'
try {
  pnpm --filter @skerp/server verify:job-card:database
} finally {
  Remove-Item Env:JOBCARD_ALLOW_ISOLATED_SCHEMA_TEST -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath 'apps/server/prisma/job-card-verification-baseline.tmp.sql' -ErrorAction SilentlyContinue
}
```

The configured database role must be able to create/drop its isolated test schema. The verifier restricts schema names and schema-qualifies test-table analysis; cleanup drops only its generated schema. Verify `testSchemaDropped: true` in the artifact. The temporary baseline is metadata, must remain untracked, and is removed after verification.

This harness exercises the nine listed finance migrations on the current pre-upgrade baseline, rather than replaying the entire repository migration history from an empty database. After deployment, use a compatible archived baseline or test database for migration replay; do not reset application data to rerun it.

## Remaining acceptance

Use the [rollout and acceptance pack](JOB_CARD_ROLLOUT_ACCEPTANCE.md) to record actual role-based UAT, policy decisions and deployment evidence, and the [operating guide](../JOB_CARD_OPERATING_GUIDE.md) for user training. The readiness command also reports aggregate duplicate-invoice/bill-total blockers, draft review count and missing cancelled-bill histories. These selected checks do not certify complete historical reconciliation. Exit 2 includes pending migrations or DATA_REVIEW_REQUIRED; a schema-ready result does not grant business approval.

Step 16 requires Finance approval of tax, internal labour, valuation and period policy; browser testing with real roles; physical inspection/custody evidence; actual Tally import reconciliation; representative production-volume measurements; permission synchronisation; legacy draft review; backups and reviewed migration deployment. The verifier does not perform these business approvals or deploy migrations.
