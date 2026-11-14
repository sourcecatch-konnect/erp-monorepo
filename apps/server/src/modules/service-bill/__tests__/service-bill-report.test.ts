import { describe, expect, it, vi } from "vitest";
import { serviceBillOutstandingQuerySchema } from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import {
  getServiceBillOutstanding,
  outstandingBillsCte,
} from "../service-bill-report.service.js";

vi.mock("../../../../prisma/prisma.js", () => ({
  db: { $transaction: vi.fn() },
}));

describe("service provider outstanding", () => {
  it("bounds paging and rejects unsupported age buckets", () => {
    expect(serviceBillOutstandingQuerySchema.parse({})).toEqual({
      page: 0,
      size: 20,
    });
    for (const input of [
      { size: 101 },
      { page: -1 },
      { page: 1000001 },
      { bucket: "overdue" },
      { search: "x".repeat(201) },
    ]) {
      expect(serviceBillOutstandingQuerySchema.safeParse(input).success).toBe(
        false,
      );
    }
  });
  it("intersects branch scope and requested filters without interpolating user text", () => {
    const query = outstandingBillsCte(
      {
        page: 0,
        size: 20,
        branchId: "requested",
        serviceProviderId: "provider",
        search: "100%_' OR TRUE --",
        bucket: "31_60",
      },
      ["assigned"],
    );
    expect(query.values).toEqual(
      expect.arrayContaining([
        "assigned",
        "requested",
        "provider",
        "31_60",
        "%100\\%\\_' OR TRUE --%",
      ]),
    );
    expect(query.strings.join("")).not.toContain("OR TRUE --");
    expect(
      outstandingBillsCte({ page: 0, size: 20 }, []).strings.join(""),
    ).toContain("FALSE");
  });
  it("uses current posted liability net of cash and TDS with exhaustive calendar-age buckets", () => {
    const sql = outstandingBillsCte({ page: 0, size: 20 }, null).strings.join(
      "",
    );
    expect(sql).toContain(
      'b."netAmountPaise" - b."paidAmountPaise" AS outstanding',
    );
    expect(sql).toContain('b."netAmountPaise" > b."paidAmountPaise"');
    expect(sql).toContain("b.\"status\" = 'POSTED'");
    expect(sql).toContain("j.\"status\" = 'POSTED'");
    expect(sql).toContain("AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'");
    expect(sql).toContain("age < 0 THEN 'FUTURE' WHEN age <= 30 THEN '0_30'");
    expect(sql).toContain(
      "age <= 60 THEN '31_60' WHEN age <= 90 THEN '61_90' ELSE '90_PLUS'",
    );
    expect(sql).not.toContain('"VendorPaymentDisbursement"');
  });
  it("pages only in the backend while summarising all matching bills in a consistent snapshot", async () => {
    const totals = {
      total: 41,
      reportDate: "2026-11-13",
      outstandingPaise: "9007199254740993",
      futurePaise: "0",
      days0To30Paise: "9007199254740993",
      days31To60Paise: "0",
      days61To90Paise: "0",
      daysOver90Paise: "0",
    };
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ id: "page-row" }])
        .mockResolvedValueOnce([totals]),
    };
    vi.mocked(db.$transaction).mockImplementationOnce((async (
      work: (client: unknown) => unknown,
    ) => work(tx)) as never);
    const result = await getServiceBillOutstanding({ page: 2, size: 20 }, [
      "branch",
    ]);
    expect(result.rows).toEqual([{ id: "page-row" }]);
    expect(result.total).toBe(41);
    expect(result.summary.outstandingPaise).toBe("9007199254740993");
    expect(result.reportDate).toBe("2026-11-13");
    const page = tx.$queryRaw.mock.calls[0]![0] as Prisma.Sql;
    const summary = tx.$queryRaw.mock.calls[1]![0] as Prisma.Sql;
    expect(page.strings.join("")).toContain(
      'ORDER BY "billDate" ASC, "id" ASC LIMIT',
    );
    expect(page.values.slice(-2)).toEqual([20, 40]);
    expect(summary.strings.join("")).not.toContain("LIMIT");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
  });
});
