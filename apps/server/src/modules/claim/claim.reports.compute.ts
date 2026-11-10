import type {
  ClaimAgeingBucket,
  ClaimCostGroupBy,
  ClaimCostSummaryRow,
} from "@skerp/types";

/**
 * C8 — claims reports, pure (no DB) so the arithmetic is unit-tested:
 * ageing of open claims and the damage-cost summary.
 */

const DAY_MS = 86_400_000;

export const AGEING_BUCKETS: { key: ClaimAgeingBucket["key"]; label: string; maxDays: number }[] = [
  { key: "D0_15", label: "0–15 days", maxDays: 15 },
  { key: "D16_30", label: "16–30 days", maxDays: 30 },
  { key: "D31_60", label: "31–60 days", maxDays: 60 },
  { key: "D60_PLUS", label: "Over 60 days", maxDays: Infinity },
];

/** Whole days since the claim was raised. */
export const daysOpen = (createdAt: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / DAY_MS));

/**
 * Open (pending + active) claims by days since they were raised. Every claim
 * lands in exactly one bucket, so the buckets add up to the open count.
 */
export const ageClaims = (
  claims: { createdAt: Date; claimedAmountPaise: bigint }[],
  now: Date,
): ClaimAgeingBucket[] => {
  const buckets = AGEING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: 0,
    claimedAmountPaise: 0n,
  }));
  for (const claim of claims) {
    const days = daysOpen(claim.createdAt, now);
    const bucket = buckets[AGEING_BUCKETS.findIndex((b) => days <= b.maxDays)]!;
    bucket.count += 1;
    bucket.claimedAmountPaise += claim.claimedAmountPaise;
  }
  return buckets.map((bucket) => ({
    ...bucket,
    claimedAmountPaise: Number(bucket.claimedAmountPaise),
  }));
};

/** One settled claim, reduced to what the cost summary needs. */
export type CostClaim = {
  settledAmountPaise: bigint;
  /** Approved + received recoveries. */
  recoveredAmountPaise: bigint;
  cause: string | null;
  customer: { id: string; name: string };
  /** Market transporter; null for our own fleet truck. */
  transporter: { id: string; name: string } | null;
  /** Loading → unloading city, or booking → delivery branch when a city is missing. */
  route: string;
};

const CAUSE_LABEL: Record<string, string> = {
  TRANSPORTER: "Transporter",
  LABOUR: "Labour",
  RAILWAY: "Railway",
  CUSTOMER: "Customer",
  DRIVER: "Driver",
  INSURED_EVENT: "Insured event",
  UNKNOWN: "Unknown",
};

const keyOf = (claim: CostClaim, groupBy: ClaimCostGroupBy): { key: string; label: string } => {
  switch (groupBy) {
    case "cause":
      return claim.cause
        ? { key: claim.cause, label: CAUSE_LABEL[claim.cause] ?? claim.cause }
        : { key: "NONE", label: "Not assessed" };
    case "customer":
      return { key: claim.customer.id, label: claim.customer.name };
    case "transporter":
      return claim.transporter
        ? { key: claim.transporter.id, label: claim.transporter.name }
        : { key: "OWN_FLEET", label: "Own fleet" };
    case "route":
      return { key: claim.route, label: claim.route };
  }
};

/**
 * Settled, recovered and net loss per group, biggest net loss first, plus
 * the totals — which are the plain sums over the same claims, so they always
 * reconcile with the claims register for the same filters.
 */
export const summariseCost = (claims: CostClaim[], groupBy: ClaimCostGroupBy) => {
  const groups = new Map<string, { label: string; claims: number; settled: bigint; recovered: bigint }>();
  for (const claim of claims) {
    const { key, label } = keyOf(claim, groupBy);
    const group = groups.get(key) ?? { label, claims: 0, settled: 0n, recovered: 0n };
    group.claims += 1;
    group.settled += claim.settledAmountPaise;
    group.recovered += claim.recoveredAmountPaise;
    groups.set(key, group);
  }
  const rows: ClaimCostSummaryRow[] = [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      claims: group.claims,
      settledAmountPaise: Number(group.settled),
      recoveredAmountPaise: Number(group.recovered),
      netLossPaise: Number(group.settled - group.recovered),
    }))
    .sort((a, b) => b.netLossPaise - a.netLossPaise || a.label.localeCompare(b.label));

  const settled = claims.reduce((sum, claim) => sum + claim.settledAmountPaise, 0n);
  const recovered = claims.reduce((sum, claim) => sum + claim.recoveredAmountPaise, 0n);
  return {
    rows,
    totals: {
      claims: claims.length,
      settledAmountPaise: Number(settled),
      recoveredAmountPaise: Number(recovered),
      netLossPaise: Number(settled - recovered),
    },
  };
};

/** "Pune → Nagpur", or the branches when a city is missing. */
export const routeLabel = (input: {
  fromCity: string | null;
  toCity: string | null;
  fromBranch: string;
  toBranch: string;
}) =>
  input.fromCity && input.toCity
    ? `${input.fromCity} → ${input.toCity}`
    : `${input.fromBranch} → ${input.toBranch}`;
