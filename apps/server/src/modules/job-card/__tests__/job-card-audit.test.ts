import { describe, expect, it, vi } from "vitest";
import { jobCardAuditQuerySchema } from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import { getJobCardAudit, jobCardAuditCte } from "../job-card-audit.service.js";
vi.mock("../../../../prisma/prisma.js", () => ({
  db: { $transaction: vi.fn() },
}));
describe("job card finance audit", () => {
  it("validates period-only dates, date ranges and bounded pages", () => {
    expect(
      jobCardAuditQuerySchema.safeParse({ mode: "STOCK", from: "2026-11-13" })
        .success,
    ).toBe(false);
    expect(
      jobCardAuditQuerySchema.safeParse({
        mode: "POSTINGS",
        from: "2026-11-14",
        to: "2026-11-13",
      }).success,
    ).toBe(false);
    expect(jobCardAuditQuerySchema.safeParse({ size: 101 }).success).toBe(
      false,
    );
    expect(jobCardAuditQuerySchema.safeParse({ page: 1000001 }).success).toBe(
      false,
    );
  });
  it.each(["STOCK", "SETTLEMENTS", "POSTINGS", "TALLY"] as const)(
    "fails closed and parameterises filters in %s view",
    (mode) => {
      const filters = jobCardAuditQuerySchema.parse({
        mode,
        branchId: "requested",
        search: "%_' OR TRUE --",
      });
      const query = jobCardAuditCte(filters, ["assigned"]);
      expect(query.values).toEqual(
        expect.arrayContaining([
          "requested",
          "assigned",
          "%\\%\\_' OR TRUE --%",
        ]),
      );
      expect(query.strings.join("")).not.toContain("OR TRUE --");
      expect(jobCardAuditCte(filters, []).strings.join("")).toContain("FALSE");
    },
  );
  it("compares movements, batches, undo-netted card issues and record-only returns without conflating quantity and value", () => {
    const sql = jobCardAuditCte(
      jobCardAuditQuerySchema.parse({ mode: "STOCK" }),
      null,
    ).strings.join("");
    for (const marker of [
      "MOVEMENT_BALANCE",
      "BATCH_BALANCE",
      "JOBCARD_FINALISE_UNDO",
      "CARD_ISSUE_VALUE",
      "RETURN_QTY",
      "RETURN_VALUE",
      "'QTY'",
      "'PAISE'",
    ])
      expect(sql).toContain(marker);
    expect(sql).toContain("CASE WHEN r.\"lifecycleStatus\" = 'STOCKED'");
  });
  it("checks retained payment rows against counters and reversal links without double counting reversed settlements", () => {
    const sql = jobCardAuditCte(
      jobCardAuditQuerySchema.parse({ mode: "SETTLEMENTS" }),
      null,
    ).strings.join("");
    expect(sql).toContain('p."reversedAt" IS NULL');
    expect(sql).toContain('r."reversesId" = j.id');
    expect(sql).toContain('rt."journalEntryId" = r.id');
    expect(sql).toContain('p."paidPaise" + p."tdsPaise"');
    expect(sql).toContain("VOUCHER_LINK_OR_STATUS");
  });
  it("retains reversal history but excludes both halves from active period totals and exposes Tally follow-up", () => {
    const filters = jobCardAuditQuerySchema.parse({
      mode: "TALLY",
      from: "2026-11-13",
      to: "2026-11-13",
    });
    const query = jobCardAuditCte(filters, null);
    const sql = query.strings.join("");
    expect(sql).toContain("j.status = 'POSTED' AND j.\"reversesId\" IS NULL");
    expect(sql).toContain("UNLINKED_SOURCE");
    expect(sql).toContain("TALLY_FOLLOW_UP");
    expect(query.values).toContainEqual(new Date("2026-11-12T18:30:00Z"));
    expect(query.values).toContainEqual(new Date("2026-11-13T18:30:00Z"));
  });
  it("pages in SQL with exact database summaries and consistent snapshot", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ id: "page-only" }])
        .mockResolvedValueOnce([
          {
            total: 41,
            issues: 4,
            moneyDifferencePaise: "9007199254740993",
            quantityDifference: "2",
            activeExpensePaise: "0",
          },
        ]),
    };
    vi.mocked(db.$transaction).mockImplementationOnce((async (
      work: (client: unknown) => unknown,
    ) => work(tx)) as never);
    const result = await getJobCardAudit(
      jobCardAuditQuerySchema.parse({ page: 2 }),
      ["branch"],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(41);
    expect(result.summary.moneyDifferencePaise).toBe("9007199254740993");
    const page = tx.$queryRaw.mock.calls[0]![0] as Prisma.Sql;
    const total = tx.$queryRaw.mock.calls[1]![0] as Prisma.Sql;
    expect(page.values.slice(-2)).toEqual([20, 40]);
    expect(total.strings.join("")).not.toContain("LIMIT");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
      timeout: 15000,
    });
  });
});
