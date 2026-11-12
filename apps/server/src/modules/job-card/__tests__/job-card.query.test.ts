import { describe, expect, it } from "vitest";
import { jobCardListQuerySchema } from "@skerp/validators";
import { jobCardListWhere } from "../job-card.query.js";

describe("job card register query", () => {
  it("defaults to a bounded first page and parses requested backend pages", () => {
    expect(jobCardListQuerySchema.parse({})).toMatchObject({
      page: 0,
      size: 10,
    });
    expect(
      jobCardListQuerySchema.parse({
        page: "2",
        size: "20",
        search: "  MH12  ",
      }),
    ).toMatchObject({ page: 2, size: 20, search: "MH12" });
  });

  it.each([
    { page: -1 },
    { page: 1.5 },
    { size: 0 },
    { size: 101 },
    { search: "x".repeat(201) },
    { status: "PAID" },
  ])("rejects invalid or unbounded list input %j", (input) => {
    expect(jobCardListQuerySchema.safeParse(input).success).toBe(false);
  });

  it("intersects explicit branch requests with assigned scope", () => {
    const scope = { branchId: { in: ["assigned-branch"] } };
    const where = jobCardListWhere(scope, {
      branchId: "other-branch",
      status: "DRAFT",
    });
    expect(where.AND).toEqual([
      scope,
      { branchId: "other-branch", status: "DRAFT" },
    ]);
  });

  it("searches card number, vehicle and driver without bypassing scope or status", () => {
    const scope = { branchId: { in: [] } };
    const where = jobCardListWhere(scope, {
      search: "truck",
      status: "FINALISED",
    });
    expect(where.AND).toEqual([
      scope,
      {
        status: "FINALISED",
        OR: [
          { jobCardNumber: { contains: "truck", mode: "insensitive" } },
          {
            vehicle: {
              vehicleNumber: { contains: "truck", mode: "insensitive" },
            },
          },
          { driver: { name: { contains: "truck", mode: "insensitive" } } },
        ],
      },
    ]);
  });
});
