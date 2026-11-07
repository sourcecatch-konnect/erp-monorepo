import { describe, expect, it } from "vitest";

import {
  ackRequiredFrom,
  isPayableWithoutApproval,
} from "../ack-requirement.js";

/**
 * L5 — Q8 (approval mandatory) and Q10 (grandfather what came before).
 *
 * The risk being tested is asymmetric. Wrongly requiring an approval strands
 * a delivered challan and somebody complains; wrongly waiving it lets an
 * unchecked broker claim through. But stranding every in-flight challan on
 * deploy day is also real, which is why the cutover ships unset.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const CUTOVER = d("2026-12-01");

describe("ackRequiredFrom", () => {
  it("is null when unset — the requirement ships dark", () => {
    expect(ackRequiredFrom(undefined)).toBeNull();
    expect(ackRequiredFrom("")).toBeNull();
  });

  it("parses an ISO date", () => {
    expect(ackRequiredFrom("2026-12-01")?.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("treats a malformed value as unset rather than throwing", () => {
    // A typo in an env var must not take the server down, and the fail-safe
    // direction is "do not block payments".
    expect(ackRequiredFrom("not-a-date")).toBeNull();
  });
});

describe("isPayableWithoutApproval", () => {
  it("lets an approved challan through whatever the cutover says", () => {
    expect(
      isPayableWithoutApproval(
        { issuedAt: d("2027-01-15"), hasApproval: true },
        CUTOVER,
      ),
    ).toBe(true);
  });

  it("blocks an unapproved challan issued after the cutover (Q8)", () => {
    expect(
      isPayableWithoutApproval(
        { issuedAt: d("2026-12-02"), hasApproval: false },
        CUTOVER,
      ),
    ).toBe(false);
  });

  it("grandfathers an unapproved challan issued before the cutover (Q10)", () => {
    expect(
      isPayableWithoutApproval(
        { issuedAt: d("2026-11-30"), hasApproval: false },
        CUTOVER,
      ),
    ).toBe(true);
  });

  it("requires approval from the cutover instant itself, not the day after", () => {
    expect(
      isPayableWithoutApproval(
        { issuedAt: CUTOVER, hasApproval: false },
        CUTOVER,
      ),
    ).toBe(false);
  });

  it("blocks nothing when no cutover is configured", () => {
    expect(
      isPayableWithoutApproval(
        { issuedAt: d("2027-06-01"), hasApproval: false },
        null,
      ),
    ).toBe(true);
  });
});
