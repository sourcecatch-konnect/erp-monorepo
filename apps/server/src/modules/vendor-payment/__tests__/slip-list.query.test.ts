import { describe, expect, it } from "vitest";
import { vendorPaymentSlipListQuerySchema } from "@skerp/validators";

import { SLIP_LIST_ORDER_BY, buildSlipListWhere } from "../slip-list.query.js";

const parse = (query: Record<string, string>) =>
  vendorPaymentSlipListQuerySchema.parse(query);

describe("vendorPaymentSlipListQuerySchema", () => {
  it("splits a comma-separated status list", () => {
    expect(parse({ status: "APPROVED,PARTIALLY_PAID" }).status).toEqual([
      "APPROVED",
      "PARTIALLY_PAID",
    ]);
  });

  it("tolerates whitespace and treats a missing or empty status as no filter", () => {
    expect(parse({ status: " APPROVED , PAID " }).status).toEqual(["APPROVED", "PAID"]);
    expect(parse({}).status).toBeUndefined();
    expect(parse({ status: "" }).status).toBeUndefined();
  });

  it("rejects an unknown status instead of passing it to the database", () => {
    expect(
      vendorPaymentSlipListQuerySchema.safeParse({ status: "APPROVED,BOGUS" }).success,
    ).toBe(false);
  });

  it("trims the search term", () => {
    expect(parse({ search: "  speedy  " }).search).toBe("speedy");
  });
});

describe("buildSlipListWhere", () => {
  const scope = { branchId: { in: ["b1", "b2"] } };

  it("is just the branch scope when no filter is given", () => {
    expect(buildSlipListWhere({ status: undefined }, scope)).toEqual(scope);
  });

  it("filters several statuses with a single IN clause", () => {
    const where = buildSlipListWhere(
      { status: ["APPROVED", "PARTIALLY_PAID"] },
      scope,
    );
    expect(where.status).toEqual({ in: ["APPROVED", "PARTIALLY_PAID"] });
    expect(where.branchId).toEqual(scope.branchId);
  });

  it("searches slip number and both vendor names case-insensitively in the database", () => {
    const where = buildSlipListWhere({ status: undefined, search: "speedy" }, scope);
    expect(where.OR).toEqual([
      { slipNumber: { contains: "speedy", mode: "insensitive" } },
      { transport: { name: { contains: "speedy", mode: "insensitive" } } },
      { labour: { name: { contains: "speedy", mode: "insensitive" } } },
    ]);
  });

  it("never lets a search widen the caller's branch scope", () => {
    const where = buildSlipListWhere({ status: undefined, search: "x" }, scope);
    expect(where.branchId).toEqual(scope.branchId);
  });

  it("ignores a blank search", () => {
    expect(buildSlipListWhere({ status: undefined, search: "   " }, scope).OR).toBeUndefined();
  });
});

describe("SLIP_LIST_ORDER_BY", () => {
  it("ends in a unique tiebreak so load-more chunks never repeat or skip rows", () => {
    expect(SLIP_LIST_ORDER_BY.at(-1)).toEqual({ id: "desc" });
  });
});
