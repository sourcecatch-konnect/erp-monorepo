import type { ClaimRecoveryStatus } from "@skerp/types";

/**
 * Recoveries that reduce the loss: APPROVED (the party has agreed to pay) and
 * RECEIVED. FILED is only a hope and REJECTED never arrives.
 */
export const COUNTED_RECOVERY_STATUSES: readonly ClaimRecoveryStatus[] = ["APPROVED", "RECEIVED"];

export type ClaimMoneyInput = {
  settledAmountPaise: bigint | null;
  recoveries: readonly { status: ClaimRecoveryStatus; amountPaise: bigint }[];
};

/**
 * Net loss = settled − (approved + received recoveries). Null until the claim
 * is settled: before that there is no loss to measure yet.
 */
export const claimMoneyTotals = ({ settledAmountPaise, recoveries }: ClaimMoneyInput) => {
  const recoveredAmountPaise = recoveries
    .filter((recovery) => COUNTED_RECOVERY_STATUSES.includes(recovery.status))
    .reduce((sum, recovery) => sum + recovery.amountPaise, 0n);
  return {
    recoveredAmountPaise,
    netLossPaise: settledAmountPaise === null ? null : settledAmountPaise - recoveredAmountPaise,
  };
};
