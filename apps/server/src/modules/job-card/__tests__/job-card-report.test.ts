import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../../generated/prisma/index.js";
import { jobCardRepairCostQuerySchema } from "@skerp/validators";
import {
  repairCostCte,
  repairCostDateBounds,
} from "../job-card-report.query.js";
import { getJobCardRepairCosts } from "../job-card-report.service.js";
import { db } from "../../../../prisma/prisma.js";

vi.mock("../../../../prisma/prisma.js", () => ({
  db: { $transaction: vi.fn() },
}));

describe("repair cost query", () => {
  it("validates calendar dates, order and backend page size", () => {
    expect(jobCardRepairCostQuerySchema.parse({})).toMatchObject({
      page: 0,
      size: 20,
    });
    expect(
      jobCardRepairCostQuerySchema.safeParse({ from: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      jobCardRepairCostQuerySchema.safeParse({
        from: "2026-11-13",
        to: "2026-11-12",
      }).success,
    ).toBe(false);
    expect(jobCardRepairCostQuerySchema.safeParse({ size: 101 }).success).toBe(
      false,
    );
  });
  it("uses inclusive India business dates and an exclusive next-day boundary", () => {
    const bounds = repairCostDateBounds({
      from: "2026-11-12",
      to: "2026-11-12",
    });
    expect(bounds.from?.toISOString()).toBe("2026-11-11T18:30:00.000Z");
    expect(bounds.toExclusive?.toISOString()).toBe("2026-11-12T18:30:00.000Z");
  });
  it("keeps assigned scope and explicit branch together and parameterises search", () => {
    const query = repairCostCte(
      { page: 0, size: 20, branchId: "other", search: "100%_' OR TRUE --" },
      ["assigned"],
    );
    expect(query.values).toContain("assigned");
    expect(query.values).toContain("other");
    expect(query.values).toContain("%100\\%\\_' OR TRUE --%");
    expect(query.strings.join("")).not.toContain("OR TRUE --");
    expect(repairCostCte({ page: 0, size: 20 }, []).strings.join("")).toContain(
      "FALSE",
    );
  });
  it("excludes drafts/cancelled bills and keeps unbilled amounts out of posted services", () => {
    const sql = repairCostCte({ page: 0, size: 20 }, null).strings.join("");
    expect(sql).toContain("jc.\"status\" = 'FINALISED'");
    expect(sql).toContain("b.\"status\" = 'POSTED'");
    expect(sql).toContain("j.\"status\" = 'POSTED'");
    expect(sql).toContain('l."billedInServiceBillId" IS NULL');
    expect(sql).not.toContain('"VendorPaymentDisbursement"');
  });
  it("fetches only a backend page and database-wide totals in one consistent snapshot", async () => {
    const summary = {
      total: 41,
      partsPaise: "2000",
      servicesPaise: "900",
      returnsPaise: "100",
      netCostPaise: "2800",
      unbilledServicesPaise: "500",
      unpostedCostPaise: "0",
    };
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ id: "only-this-page" }])
        .mockResolvedValueOnce([summary]),
    };
    vi.mocked(db.$transaction).mockImplementationOnce((async (
      work: (client: unknown) => unknown,
    ) => work(tx)) as never);
    const result = await getJobCardRepairCosts({ page: 2, size: 20 }, [
      "assigned",
    ]);
    expect(result.total).toBe(41);
    expect(result.rows).toHaveLength(1);
    expect(result.summary.netCostPaise).toBe("2800");
    const pageSql = tx.$queryRaw.mock.calls[0]![0] as Prisma.Sql;
    const totalSql = tx.$queryRaw.mock.calls[1]![0] as Prisma.Sql;
    expect(pageSql.strings.join("")).toContain(
      'ORDER BY "outDateTime" DESC NULLS LAST, "id" DESC LIMIT',
    );
    expect(pageSql.values.slice(-2)).toEqual([20, 40]);
    expect(totalSql.strings.join("")).not.toContain("LIMIT");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });
});
