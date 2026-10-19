import { describe, expect, it } from "vitest";

import { assertNotOnVendorSlip, sameValue } from "../source-lock.js";

type Claim = { slip: { slipNumber: string; status: string } };

/** Fake client: records the query and returns the given active claims. */
const clientWith = (claims: Claim[]) => {
  const calls: unknown[] = [];
  const client = {
    vendorPaymentSlipLine: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return claims;
      },
    },
  };
  return { client: client as never, calls };
};

describe("assertNotOnVendorSlip", () => {
  it("passes when no active slip line claims the source", async () => {
    const { client, calls } = clientWith([]);
    await expect(
      assertNotOnVendorSlip(client, "GRN_HAMALI", ["grn1"], "cancel this GRN"),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        where: { sourceType: "GRN_HAMALI", sourceId: { in: ["grn1"] }, isActive: true },
        select: { slip: { select: { slipNumber: true, status: true } } },
      },
    ]);
  });

  it("throws naming each slip once when the source is claimed", async () => {
    const { client } = clientWith([
      { slip: { slipNumber: "SKT/VPAY/JAL/2627/0001", status: "APPROVED" } },
      { slip: { slipNumber: "SKT/VPAY/JAL/2627/0001", status: "APPROVED" } },
    ]);
    await expect(
      assertNotOnVendorSlip(client, "LR", ["lr1", "lr2"], "undo this delivery"),
    ).rejects.toThrow(
      "Cannot undo this delivery: it is on vendor payment slip SKT/VPAY/JAL/2627/0001 (APPROVED). Remove it from that slip or cancel the slip first.",
    );
  });

  it("skips the query for an empty id list", async () => {
    const { client, calls } = clientWith([]);
    await assertNotOnVendorSlip(client, "LR", [], "change this truck");
    expect(calls).toHaveLength(0);
  });
});

describe("sameValue", () => {
  it("treats null and undefined as the same empty value", () => {
    expect(sameValue(null, undefined)).toBe(true);
    expect(sameValue<bigint>(null, 0n)).toBe(false);
  });

  it("compares bigints by value", () => {
    expect(sameValue(BigInt(500000), 500000n)).toBe(true);
    expect(sameValue(400000n, 500000n)).toBe(false);
  });
});
