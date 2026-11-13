import { describe, expect, it, vi } from "vitest";
import { unbilledServiceReportQuerySchema } from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import { db } from "../../../../prisma/prisma.js";
import {
  getUnbilledServiceReport,
  unbilledReportCte,
} from "../unbilled-service-report.service.js";
vi.mock("../../../../prisma/prisma.js", () => ({
  db: { $transaction: vi.fn() },
}));

describe("cross-provider unbilled service register", () => {
  it("allows all providers and validates dates and bounded pagination", () => {
    expect(unbilledServiceReportQuerySchema.parse({})).toEqual({
      page: 0,
      size: 20,
    });
    for (const query of [
      { size: 101 },
      { page: -1 },
      { page: 1000001 },
      { completedTo: "2026-02-30" },
    ]) {
      expect(unbilledServiceReportQuerySchema.safeParse(query).success).toBe(
        false,
      );
    }
  });
  it("requires finalised unclaimed services and applies a full India-day cutoff", () => {
    const query = unbilledReportCte(
      { page: 0, size: 20, completedTo: "2026-11-13" },
      null,
    );
    expect(query.strings.join("")).toContain(
      'c."status" = \'FINALISED\' AND l."billedInServiceBillId" IS NULL',
    );
    expect(query.values).toContainEqual(new Date("2026-11-13T18:30:00.000Z"));
    expect(query.strings.join("")).toContain('c."outDateTime" <');
    expect(query.strings.join("")).not.toContain('"ServiceBillLine"');
  });
  it("intersects assigned branch and provider filters and parameterises wildcard search", () => {
    const query = unbilledReportCte(
      {
        page: 0,
        size: 20,
        branchId: "requested",
        serviceProviderId: "provider",
        search: "%_\\' OR TRUE --",
      },
      ["assigned"],
    );
    expect(query.values).toEqual(
      expect.arrayContaining([
        "assigned",
        "requested",
        "provider",
        "%\\%\\_\\\\' OR TRUE --%",
      ]),
    );
    expect(query.strings.join("")).not.toContain("OR TRUE --");
    expect(
      unbilledReportCte({ page: 0, size: 20 }, []).strings.join(""),
    ).toContain("FALSE");
  });
  it("returns one backend page and exact full-filter estimates in one snapshot", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ id: "line" }])
        .mockResolvedValueOnce([
          {
            total: 61,
            amountPaise: "9007199254740993",
            jobCards: 30,
            providers: 4,
          },
        ]),
    };
    vi.mocked(db.$transaction).mockImplementationOnce((async (
      work: (client: unknown) => unknown,
    ) => work(tx)) as never);
    const result = await getUnbilledServiceReport({ page: 2, size: 20 }, [
      "branch",
    ]);
    expect(result.rows).toEqual([{ id: "line" }]);
    expect(result.total).toBe(61);
    expect(result.summary).toEqual({
      amountPaise: "9007199254740993",
      jobCards: 30,
      providers: 4,
    });
    const page = tx.$queryRaw.mock.calls[0]![0] as Prisma.Sql;
    const totals = tx.$queryRaw.mock.calls[1]![0] as Prisma.Sql;
    expect(page.strings.join("")).toContain(
      'ORDER BY "completedAt" ASC NULLS LAST, "id" ASC LIMIT',
    );
    expect(page.values.slice(-2)).toEqual([20, 40]);
    expect(totals.strings.join("")).not.toContain("LIMIT");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
  });
});
