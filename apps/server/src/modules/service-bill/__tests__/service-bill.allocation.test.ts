import { describe, expect, it } from "vitest";
import { allocateServiceDiscount } from "../service-bill.allocation.js";

describe("service discount allocation", () => {
  it("allocates proportional discounts and reconciles every paise", () => {
    const shares = allocateServiceDiscount(
      [
        { id: "a", amountPaise: 1000n },
        { id: "b", amountPaise: 2000n },
      ],
      100n,
    );
    expect(shares.get("a")).toEqual({
      discountPaise: 33n,
      netAmountPaise: 967n,
    });
    expect(shares.get("b")).toEqual({
      discountPaise: 67n,
      netAmountPaise: 1933n,
    });
    expect(
      [...shares.values()].reduce((sum, line) => sum + line.netAmountPaise, 0n),
    ).toBe(2900n);
  });
  it("breaks equal remainders by source ID independently of input order", () => {
    const lines = [
      { id: "c", amountPaise: 1n },
      { id: "b", amountPaise: 1n },
      { id: "a", amountPaise: 1n },
    ];
    const shares = allocateServiceDiscount(lines, 2n);
    expect(shares.get("a")?.discountPaise).toBe(1n);
    expect(shares.get("b")?.discountPaise).toBe(1n);
    expect(shares.get("c")?.discountPaise).toBe(0n);
    expect(
      [...allocateServiceDiscount([...lines].reverse(), 2n)].sort(),
    ).toEqual([...shares].sort());
  });
  it("handles zero and full discounts, zero-value lines and large amounts exactly", () => {
    expect(
      allocateServiceDiscount([{ id: "a", amountPaise: 0n }], 0n).get("a"),
    ).toEqual({ discountPaise: 0n, netAmountPaise: 0n });
    const shares = allocateServiceDiscount(
      [
        { id: "a", amountPaise: 9007199254740993n },
        { id: "b", amountPaise: 2n },
      ],
      9007199254740995n,
    );
    expect(
      [...shares.values()].every((line) => line.netAmountPaise === 0n),
    ).toBe(true);
  });
  it("rejects excessive, negative or ambiguous allocations", () => {
    expect(() =>
      allocateServiceDiscount([{ id: "a", amountPaise: 1n }], 2n),
    ).toThrow();
    expect(() =>
      allocateServiceDiscount([{ id: "a", amountPaise: -1n }], 0n),
    ).toThrow();
    expect(() =>
      allocateServiceDiscount([{ id: "a", amountPaise: 1n }], -1n),
    ).toThrow();
    expect(() =>
      allocateServiceDiscount(
        [
          { id: "a", amountPaise: 1n },
          { id: "a", amountPaise: 1n },
        ],
        1n,
      ),
    ).toThrow();
  });
});
