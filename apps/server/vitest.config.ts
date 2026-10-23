import { defineConfig } from "vitest/config";

/**
 * Server unit tests. Pure-function only (no DB) so CI needs no Postgres — the
 * ledger reconciliation math (ACCT-R7) is exercised against fixture arrays.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
