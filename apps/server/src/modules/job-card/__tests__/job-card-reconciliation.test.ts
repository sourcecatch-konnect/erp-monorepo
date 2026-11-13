import { describe, expect, it, vi } from "vitest";
import { jobCardReconciliationQuerySchema } from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import {
  getJobCardReconciliation,
  reconciliationCte,
} from "../job-card-reconciliation.service.js";
vi.mock("../../../../prisma/prisma.js", () => ({
  db: { $transaction: vi.fn() },
}));

describe("repair source-linked expense reconciliation", () => {
  it("defaults to issues and validates bounded requests", () => {
    expect(jobCardReconciliationQuerySchema.parse({})).toEqual({
      page: 0,
      size: 20,
      view: "ISSUES",
    });
    for (const input of [
      { kind: "PAYMENT" },
      { view: "invalid" },
      { page: 1000001 },
      { size: 101 },
    ]) {
      expect(jobCardReconciliationQuerySchema.safeParse(input).success).toBe(
        false,
      );
    }
  });
  it("applies branch scope to all source arms and never interpolates search", () => {
    const query = reconciliationCte(
      {
        page: 0,
        size: 20,
        view: "ISSUES",
        branchId: "requested",
        search: "%_' OR TRUE --",
        kind: "RETURN",
      },
      ["assigned"],
    );
    expect(query.values.filter((value) => value === "assigned")).toHaveLength(
      3,
    );
    expect(query.values.filter((value) => value === "requested")).toHaveLength(
      3,
    );
    expect(query.values).toContain("RETURN");
    expect(query.values).toContain("%\\%\\_' OR TRUE --%");
    expect(query.strings.join("")).not.toContain("OR TRUE --");
    expect(
      reconciliationCte({ page: 0, size: 20, view: "ALL" }, [])
        .strings.join("")
        .match(/FALSE/g)?.length,
    ).toBeGreaterThanOrEqual(3);
  });
  it("checks signed repair expense, source identity, branch, posting and voucher balance", () => {
    const sql = reconciliationCte(
      { page: 0, size: 20, view: "ISSUES" },
      null,
    ).strings.join("");
    expect(sql).toContain('-COALESCE(r."unitCostPaise", 0)::numeric * r."qty"');
    expect(sql).toContain("r.\"condition\" = 'REUSABLE'");
    expect(sql).toContain("gl.\"code\" = 'REPAIR_EXPENSE'");
    for (const issue of [
      "SOURCE_VALUE_MISSING",
      "MISSING_JOURNAL",
      "WRONG_BRANCH",
      "WRONG_SOURCE",
      "NOT_POSTED",
      "UNBALANCED",
      "AMOUNT_MISMATCH",
    ])
      expect(sql).toContain(issue);
    expect(sql).toContain("t.debit <> t.credit");
    expect(sql).toContain('j."sourceId" <> s."id"');
    expect(sql).toContain(
      'CASE WHEN j."branchId" = s."branchId" THEN j."voucherNumber" END',
    );
    expect(sql).toContain("WHERE issue <> 'MATCHED'");
    expect(
      reconciliationCte({ page: 0, size: 20, view: "ALL" }, null).strings.join(
        "",
      ),
    ).not.toContain("WHERE issue <> 'MATCHED'");
  });
  it("keeps source and voucher totals exact, counts zero-difference linkage issues and pages in SQL", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          { id: "source", issue: "WRONG_SOURCE", differencePaise: "0" },
        ])
        .mockResolvedValueOnce([
          {
            total: 21,
            issues: 2,
            expectedPaise: "9007199254740993",
            recordedPaise: "9007199254740993",
            absoluteDifferencePaise: "200",
          },
        ]),
    };
    vi.mocked(db.$transaction).mockImplementationOnce((async (
      work: (client: unknown) => unknown,
    ) => work(tx)) as never);
    const result = await getJobCardReconciliation(
      { page: 1, size: 20, view: "ALL" },
      ["branch"],
    );
    expect(result.total).toBe(21);
    expect(result.summary.issues).toBe(2);
    expect(result.summary.expectedPaise).toBe("9007199254740993");
    expect(result.rows).toHaveLength(1);
    const page = tx.$queryRaw.mock.calls[0]![0] as Prisma.Sql;
    const totals = tx.$queryRaw.mock.calls[1]![0] as Prisma.Sql;
    expect(page.values.slice(-2)).toEqual([20, 20]);
    expect(totals.strings.join("")).not.toContain("LIMIT");
    expect(totals.strings.join("")).toContain("SUM(ABS(expected - recorded))");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
  });
});
